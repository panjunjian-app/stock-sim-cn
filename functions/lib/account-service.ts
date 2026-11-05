/**
 * account-service.ts — 开户 / 账户查询 / 入金 / 总览基础值 / 属主校验
 */
import { ApiError, CODE } from './response';
import { INIT_CASH_MAX, INIT_CASH_MIN, checkInitCash, checkQuantity } from '../../shared/validate';
import { beijingDateKey } from '../../shared/trading-calendar';
import type { Cents } from '../../shared/types';
import type { D1Database } from './env';

export const MAX_ACCOUNTS_PER_USER = 5;

export interface AccountRow {
  id: number;
  user_id: number;
  name: string;
  cash_available: number;
  frozen_cash: number;
  init_cash: number;
  status: 'active' | 'deleted';
  created_at: string;
  contest_id: number | null;
}

export interface PositionRow {
  id: number;
  account_id: number;
  symbol: string;
  symbol_name: string;
  qty: number;
  available_qty: number;
  frozen_qty: number;
  avg_cost: number;
  settled_date: string;
  updated_at: string;
}

export interface CashFlowRow {
  id: number;
  account_id: number;
  type: 'deposit' | 'buy' | 'sell' | 'penalty';
  amount: number;
  balance_after: number;
  ref_id: number | null;
  remark: string;
  created_at: string;
}

export interface AccountListItem extends AccountRow {
  contest_name: string | null;
  /** 所属比赛状态（比赛账户才有）：进行中/pending 不可删，finished/cancelled（历史）可删 */
  contest_status: string | null;
  /** 昨日收市总资产基准（早于今天的最近收市快照；开赛/开户第一天为 null → 当日盈亏=累计收益） */
  prev_settled_total: number | null;
  positions_count: number;
  total_deposit: number;
  position_symbols: Array<{ symbol: string; symbolName: string; qty: number; avgCost: number }>;
}

/** 属主校验：账户存在、active、且属于当前用户 */
export async function requireOwnedAccount(db: D1Database, userId: number, accountId: number): Promise<AccountRow> {
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new ApiError(CODE.BAD_PARAM, '账户 ID 不合法');
  }
  const acc = await db.prepare('SELECT * FROM trade_accounts WHERE id = ?1').bind(accountId).first<AccountRow>();
  if (!acc || acc.status !== 'active') {
    throw new ApiError(CODE.ACCOUNT_NOT_FOUND, '账户不存在');
  }
  if (acc.user_id !== userId) {
    throw new ApiError(CODE.NOT_OWNER, '无权访问该账户');
  }
  return acc;
}

/** 开户：每用户上限 5 个；初始资金写入可用资金并生成入金流水 */
export async function openAccount(
  db: D1Database,
  userId: number,
  name: string,
  initCash: Cents,
): Promise<AccountRow> {
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0 || trimmed.length > 20) {
    throw new ApiError(CODE.BAD_PARAM, '账户名称需为 1~20 个字符');
  }
  if (!checkInitCash(initCash).ok) {
    throw new ApiError(CODE.CASH_RANGE, '初始资金不能低于 10 元（范围：10 元 ~ 1000 万元）');
  }
  const cnt = await db
    .prepare("SELECT COUNT(*) AS c FROM trade_accounts WHERE user_id = ?1 AND status = 'active' AND contest_id IS NULL")
    .bind(userId)
    .first<{ c: number }>();
  if ((cnt?.c ?? 0) >= MAX_ACCOUNTS_PER_USER) {
    throw new ApiError(CODE.ACCOUNT_LIMIT, `每个账号最多开立 ${MAX_ACCOUNTS_PER_USER} 个交易账户`);
  }
  const nowIso = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO trade_accounts (user_id, name, cash_available, frozen_cash, init_cash, status, created_at)
       VALUES (?1, ?2, ?3, 0, ?3, 'active', ?4)`,
    )
    .bind(userId, trimmed, initCash, nowIso)
    .run();
  const id = result.meta?.row_id ?? result.meta?.last_row_id;
  const created = await db.prepare('SELECT * FROM trade_accounts WHERE id = ?1').bind(id as number).first<AccountRow>();
  if (!created) {
    throw new ApiError(500, '开户失败', 500);
  }
  await db
    .prepare(
      `INSERT INTO cash_flows (account_id, type, amount, balance_after, ref_id, remark, created_at)
       VALUES (?1, 'deposit', ?2, ?2, NULL, '开户注入初始资金', ?3)`,
    )
    .bind(created.id, initCash, nowIso)
    .run();
  return created;
}

/** 软删除账户 */
export async function softDeleteAccount(db: D1Database, accountId: number): Promise<void> {
  await db
    .prepare("UPDATE trade_accounts SET status = 'deleted' WHERE id = ?1")
    .bind(accountId)
    .run();
}

/** 模拟入金（仅增加，无出金；amount > 0，上限 1000 万元/笔） */
export async function deposit(
  db: D1Database,
  accountId: number,
  amount: Cents,
): Promise<CashFlowRow> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ApiError(CODE.BAD_PARAM, '入金金额必须大于 0');
  }
  if (amount > INIT_CASH_MAX) {
    throw new ApiError(CODE.CASH_RANGE, '单笔入金不可超过 1000 万元');
  }
  const acc = await db.prepare('SELECT * FROM trade_accounts WHERE id = ?1').bind(accountId).first<AccountRow>();
  if (!acc || acc.status !== 'active') {
    throw new ApiError(CODE.ACCOUNT_NOT_FOUND, '账户不存在');
  }
  const nowIso = new Date().toISOString();
  // 原子增量更新（防并发读改写丢更新）；入金只增不减，无需条件判断
  await db
    .prepare('UPDATE trade_accounts SET cash_available = cash_available + ?2 WHERE id = ?1')
    .bind(accountId, amount)
    .run();
  const updated = await db
    .prepare('SELECT cash_available FROM trade_accounts WHERE id = ?1')
    .bind(accountId)
    .first<{ cash_available: number }>();
  const newBalance = updated?.cash_available ?? amount;
  await db
    .prepare(
      `INSERT INTO cash_flows (account_id, type, amount, balance_after, ref_id, remark, created_at)
       VALUES (?1, 'deposit', ?2, ?3, NULL, '模拟入金', ?4)`,
    )
    .bind(accountId, amount, newBalance, nowIso)
    .run();
  const flow = await db
    .prepare('SELECT * FROM cash_flows WHERE account_id = ?1 ORDER BY id DESC LIMIT 1')
    .bind(accountId)
    .first<CashFlowRow>();
  if (!flow) {
    throw new ApiError(500, '入金流水写入失败', 500);
  }
  return flow;
}

/** 账户列表（含持仓统计与累计入金，供列表页合并行情计算总资产） */
export async function listAccounts(db: D1Database, userId: number): Promise<AccountListItem[]> {
  const accounts = (
    await db
      .prepare("SELECT * FROM trade_accounts WHERE user_id = ?1 AND status = 'active' ORDER BY id ASC")
      .bind(userId)
      .all<AccountRow>()
  ).results ?? [];

  // 比赛账户补充比赛名与状态
  const contestIds = [...new Set(accounts.map((a) => a.contest_id).filter((x): x is number => x !== null))];
  const contestMeta = new Map<number, { name: string; status: string }>();
  if (contestIds.length > 0) {
    const cRes = await db
      .prepare(`SELECT id, name, status FROM contests WHERE id IN (${contestIds.join(',')})`)
      .all<{ id: number; name: string; status: string }>();
    for (const c of cRes.results ?? []) {
      contestMeta.set(c.id, { name: c.name, status: c.status });
    }
  }

  const items: AccountListItem[] = [];
  for (const acc of accounts) {
    const positions = (
      await db
        .prepare('SELECT * FROM positions WHERE account_id = ?1 AND qty > 0')
        .bind(acc.id)
        .all<PositionRow>()
    ).results ?? [];
    const depositSum = await db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM cash_flows WHERE account_id = ?1 AND type = 'deposit'")
      .bind(acc.id)
      .first<{ s: number }>();
    // 昨日收市基准：早于今天的最近收市快照（15:05 覆盖口径）；无 → 开赛/开户第一天
    const prev = await db
      .prepare('SELECT total_assets FROM daily_snapshots WHERE account_id = ?1 AND date < ?2 ORDER BY date DESC LIMIT 1')
      .bind(acc.id, beijingDateKey())
      .first<{ total_assets: number }>();
    items.push({
      ...acc,
      contest_name: acc.contest_id !== null ? contestMeta.get(acc.contest_id)?.name ?? null : null,
      contest_status: acc.contest_id !== null ? contestMeta.get(acc.contest_id)?.status ?? null : null,
      prev_settled_total: prev?.total_assets ?? null,
      positions_count: positions.length,
      // 累计入金 = Σ deposit 流水（开户时的 init_cash 已写入为首笔 deposit 流水）
      total_deposit: depositSum?.s ?? 0,
      position_symbols: positions.map((p) => ({
        symbol: p.symbol,
        symbolName: p.symbol_name,
        qty: p.qty,
        avgCost: p.avg_cost,
      })),
    });
  }
  return items;
}

/** 累计入金 = Σ deposit 流水（init_cash 已作为首笔 deposit 流水写入） */
export async function totalDeposit(db: D1Database, accountId: number): Promise<Cents> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM cash_flows WHERE account_id = ?1 AND type = 'deposit'")
    .bind(accountId)
    .first<{ s: number }>();
  return row?.s ?? 0;
}

/** 持仓列表 */
export async function listPositions(db: D1Database, accountId: number): Promise<PositionRow[]> {
  return (
    (await db.prepare('SELECT * FROM positions WHERE account_id = ?1 AND qty > 0 ORDER BY id ASC').bind(accountId).all<PositionRow>())
      .results ?? []
  );
}

/** 校验数量合法性（供下单端点复用） */
export function ensureQuantity(quantity: number): void {
  if (!checkQuantity(quantity).ok) {
    throw new ApiError(CODE.BAD_PARAM, '委托数量须为 100 股整数倍（1 手 = 100 股）');
  }
}

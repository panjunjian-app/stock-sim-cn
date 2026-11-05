/**
 * functions/lib/contest.ts — 炒炒乐大比拼核心业务
 * 规则：含发起人共 3 人上限；每用户进行中（pending+active）比赛 ≤3；拒绝即作废；
 *       全员同意当日开始（非交易日顺延下一交易日），结束 = 开始 + N 个自然月；
 *       比赛账户复用 trade_accounts（contest_id 标记），禁止入金/删除，结束后禁止交易。
 */
import { marketData } from './market-data';
import { ApiError, CODE } from './response';
import { isTradingDay, beijingDateKey } from '../../shared/trading-calendar';
import type { D1Database } from './env';

export const CONTEST_MAX_OCCUPIED = 3; // 每用户进行中比赛上限
export const CONTEST_MAX_PARTICIPANTS = 3; // 含发起人
export const CONTEST_INIT_MIN = 1_000_000; // 1 万元（分）
export const CONTEST_INIT_MAX = 1_000_000_000; // 1000 万元（分）
export const CONTEST_DURATIONS = [1, 3, 6, 12] as const;

export interface ContestRow {
  id: number;
  name: string;
  creator_id: number;
  init_cash: number;
  duration_months: number;
  status: 'pending' | 'active' | 'finished' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface ParticipantRow {
  contest_id: number;
  user_id: number;
  role: 'creator' | 'invitee';
  invite_status: 'pending' | 'accepted' | 'declined';
  account_id: number | null;
  final_total: number | null;
  is_winner: number;
}

// ---------------- 日期工具（北京时间） ----------------

/** 日期键加 N 个自然月（月末截断） */
export function addMonths(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  const mm = String(nm).padStart(2, '0');
  const dd = String(nd).padStart(2, '0');
  return `${ny}-${mm}-${dd}`;
}

/** key 当日或之后的下一个交易日 */
export function tradingDayOnOrAfter(key: string): string {
  let k = key;
  for (let i = 0; i < 30; i++) {
    if (isTradingDay(k)) {
      return k;
    }
    const [y, m, d] = k.split('-').map((x) => parseInt(x, 10));
    k = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  }
  return k;
}

/** 全员同意 → 比赛起止日期 */
export function computeContestDates(durationMonths: number, todayKey = beijingDateKey()): { startDate: string; endDate: string } {
  const startDate = tradingDayOnOrAfter(todayKey);
  return { startDate, endDate: addMonths(startDate, durationMonths) };
}

// ---------------- 数据访问 ----------------

/** 每用户进行中（pending+active）比赛数 */
export async function countOccupiedContests(db: D1Database, userId: number): Promise<number> {
  const r = await db
    .prepare(
      `SELECT COUNT(DISTINCT c.id) AS n FROM contests c JOIN contest_participants p ON p.contest_id = c.id
       WHERE p.user_id = ?1 AND c.status IN ('pending', 'active')`
    )
    .bind(userId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/** 开赛：写起止日期、置 active、为每个参与者创建比赛账户 */
export async function activateContest(db: D1Database, contest: ContestRow): Promise<void> {
  const { startDate, endDate } = computeContestDates(contest.duration_months);
  const nowIso = new Date().toISOString();
  await db
    .prepare("UPDATE contests SET status = 'active', start_date = ?2, end_date = ?3, updated_at = ?4 WHERE id = ?1")
    .bind(contest.id, startDate, endDate, nowIso)
    .run();

  const parts = await db
    .prepare('SELECT p.id, p.user_id, u.email, u.nickname FROM contest_participants p JOIN users u ON u.id = p.user_id WHERE p.contest_id = ?1')
    .bind(contest.id)
    .all<{ id: number; user_id: number; email: string; nickname: string }>();

  const accName = `比拼·${contest.name}`.slice(0, 20);
  for (const p of parts.results ?? []) {
    const ins = await db
      .prepare(
        `INSERT INTO trade_accounts (user_id, name, cash_available, frozen_cash, init_cash, status, created_at, contest_id)
         VALUES (?1, ?2, ?3, 0, ?3, 'active', ?4, ?5)`
      )
      .bind(p.user_id, accName, contest.init_cash, nowIso, contest.id)
      .run();
    const accId = ins.meta?.last_row_id ?? ins.meta?.row_id;
    await db.batch([
      db.prepare("UPDATE contest_participants SET account_id = ?2 WHERE id = ?1").bind(p.id, accId as number),
      db.prepare(
        "INSERT INTO cash_flows (account_id, type, amount, balance_after, ref_id, remark, created_at) VALUES (?1, 'deposit', ?2, ?2, NULL, '比赛账户初始资金', ?3)"
      ).bind(accId as number, contest.init_cash, nowIso),
    ]);
  }
}

/** 结算到期比赛（懒触发）：以 end_date 当日（或其前最近交易日）快照定格成绩 */
export async function finishDueContests(db: D1Database): Promise<void> {
  const today = beijingDateKey();
  const due = await db
    .prepare("SELECT * FROM contests WHERE status = 'active' AND end_date IS NOT NULL AND end_date < ?1")
    .bind(today)
    .all<ContestRow>();
  for (const c of due.results ?? []) {
    const parts = await db
      .prepare('SELECT p.*, a.cash_available + a.frozen_cash AS cash FROM contest_participants p JOIN trade_accounts a ON a.id = p.account_id WHERE p.contest_id = ?1 AND p.account_id IS NOT NULL')
      .bind(c.id)
      .all<ParticipantRow & { id: number; cash: number }>();
    const rows = parts.results ?? [];
    if (rows.length === 0) {
      await db.prepare("UPDATE contests SET status = 'finished', updated_at = ?2 WHERE id = ?1").bind(c.id, new Date().toISOString()).run();
      continue;
    }
    // 各参与者定格总资产：优先 end_date 当日或之前最近快照，缺失用当前现金+持仓估值兜底
    const totals: Array<{ participantId: number; total: number }> = [];
    for (const p of rows) {
      const snap = await db
        .prepare('SELECT total_assets FROM daily_snapshots WHERE account_id = ?1 AND date <= ?2 ORDER BY date DESC LIMIT 1')
        .bind(p.account_id as number, c.end_date as string)
        .first<{ total_assets: number }>();
      let total = snap?.total_assets;
      if (total === undefined) {
        // 无快照（异常兜底）：现金 + 持仓按摊薄成本估值
        const mv = await db
          .prepare('SELECT COALESCE(SUM(qty * avg_cost), 0) AS mv FROM positions WHERE account_id = ?1 AND qty > 0')
          .bind(p.account_id as number)
          .first<{ mv: number }>();
        total = (p as unknown as { cash: number }).cash + (mv?.mv ?? 0);
      }
      totals.push({ participantId: p.id, total });
    }
    const maxTotal = Math.max(...totals.map((t) => t.total));
    const nowIso = new Date().toISOString();
    const stmts = [
      db.prepare("UPDATE contests SET status = 'finished', updated_at = ?2 WHERE id = ?1").bind(c.id, nowIso),
      ...totals.map((t) =>
        db.prepare('UPDATE contest_participants SET final_total = ?2, is_winner = ?3 WHERE id = ?1').bind(
          t.participantId,
          t.total,
          t.total === maxTotal && maxTotal > 0 ? 1 : 0
        )
      ),
    ];
    await db.batch(stmts);
  }
}

// ---------------- 排行（实时总资产 + 昨日盈亏） ----------------

const priceCache = new Map<string, { ts: number; price: number }>();
const PRICE_TTL_MS = 5_000;

export interface Standing {
  userId: number;
  nickname: string;
  email: string;
  role: 'creator' | 'invitee';
  inviteStatus: 'pending' | 'accepted' | 'declined';
  accountId: number | null;
  isWinner: boolean;
  finalTotal: number | null;
  currentTotal: number | null;
  yesterdayPnl: number | null;
}

/** 某比赛的参与者排行（active：实时总资产+最新快照日盈亏；finished：定格成绩；pending：邀请状态） */
export async function contestStandings(db: D1Database, contest: ContestRow): Promise<Standing[]> {
  const rows = await db
    .prepare(
      `SELECT p.user_id, p.role, p.invite_status, p.account_id, p.is_winner, p.final_total,
              u.email, COALESCE(NULLIF(u.nickname, ''), u.email) AS nickname, u.avatar
       FROM contest_participants p JOIN users u ON u.id = p.user_id
       WHERE p.contest_id = ?1 ORDER BY p.id`
    )
    .bind(contest.id)
    .all<{
      user_id: number; role: 'creator' | 'invitee'; invite_status: 'pending' | 'accepted' | 'declined';
      account_id: number | null; is_winner: number; final_total: number | null; email: string; nickname: string; avatar: string;
    }>();
  const parts = rows.results ?? [];

  if (contest.status === 'finished') {
    return parts.map((p) => ({
      userId: p.user_id, nickname: p.nickname, email: p.email, avatar: p.avatar, role: p.role, inviteStatus: p.invite_status,
      accountId: p.account_id, isWinner: p.is_winner === 1, finalTotal: p.final_total, currentTotal: null, yesterdayPnl: null,
    }));
  }

  // active：实时估值（现金 + 持仓×现价）与最近快照日盈亏
  const accountIds = parts.map((p) => p.account_id).filter((x): x is number => x !== null);
  const posMap = new Map<number, Array<{ symbol: string; qty: number; avg_cost: number }>>();
  const cashMap = new Map<number, number>();
  const symbols = new Set<string>();
  if (accountIds.length > 0) {
    const posRes = await db
      .prepare(`SELECT account_id, symbol, qty, avg_cost FROM positions WHERE account_id IN (${accountIds.join(',')}) AND qty > 0`)
      .all<{ account_id: number; symbol: string; qty: number; avg_cost: number }>();
    for (const r of posRes.results ?? []) {
      if (!posMap.has(r.account_id)) posMap.set(r.account_id, []);
      posMap.get(r.account_id)!.push(r);
      symbols.add(r.symbol);
    }
    const accRes = await db
      .prepare(`SELECT id, cash_available + frozen_cash AS cash FROM trade_accounts WHERE id IN (${accountIds.join(',')})`)
      .all<{ id: number; cash: number }>();
    for (const a of accRes.results ?? []) cashMap.set(a.id, a.cash);
  }

  const priceMap = new Map<string, number>();
  const uniq = [...symbols];
  if (uniq.length > 0) {
    const now = Date.now();
    const missing = uniq.filter((s) => {
      const c = priceCache.get(s);
      return !(c && now - c.ts < PRICE_TTL_MS);
    });
    if (missing.length > 0) {
      try {
        const quotes = await marketData.fetchQuotes(missing as never);
        for (const q of quotes) {
          priceCache.set(q.symbol, { ts: now, price: q.price });
        }
      } catch {
        // 行情失败用摊薄成本兜底
      }
    }
    for (const s of uniq) {
      priceMap.set(s, priceCache.get(s)?.price ?? NaN);
    }
  }

  const snapPnl = new Map<number, number | null>();
  for (const accId of accountIds) {
    const s = await db
      .prepare('SELECT day_pnl FROM daily_snapshots WHERE account_id = ?1 ORDER BY date DESC LIMIT 1')
      .bind(accId)
      .first<{ day_pnl: number }>();
    snapPnl.set(accId, s ? s.day_pnl : null);
  }

  return parts.map((p) => {
    let currentTotal: number | null = null;
    if (p.account_id !== null) {
      let total = cashMap.get(p.account_id) ?? 0;
      for (const pos of posMap.get(p.account_id) ?? []) {
        const price = priceMap.get(pos.symbol);
        total += pos.qty * (Number.isFinite(price) ? price! : pos.avg_cost);
      }
      currentTotal = total;
    }
    return {
      userId: p.user_id, nickname: p.nickname, email: p.email, avatar: p.avatar, role: p.role, inviteStatus: p.invite_status,
      accountId: p.account_id, isWinner: p.is_winner === 1, finalTotal: p.final_total,
      currentTotal, yesterdayPnl: p.account_id !== null ? snapPnl.get(p.account_id) ?? null : null,
    };
  });
}

// ---------------- 交易护栏 ----------------

/** 比赛账户资金护栏：禁止入金/删除（资金金额比赛期间锁定） */
export function guardContestAccount(acc: { contest_id: number | null }): void {
  if (acc.contest_id !== null && acc.contest_id !== undefined) {
    throw new ApiError(CODE.BAD_PARAM, '比赛账户资金已锁定，不能修改金额');
  }
}

/** 比赛账户交易护栏：仅 active 比赛可交易 */
export async function guardContestTrading(db: D1Database, contestId: number | null): Promise<void> {
  if (contestId === null || contestId === undefined) {
    return;
  }
  const c = await db.prepare('SELECT status FROM contests WHERE id = ?1').bind(contestId).first<{ status: ContestRow['status'] }>();
  if (!c) {
    throw new ApiError(CODE.BAD_PARAM, '比赛不存在');
  }
  if (c.status === 'pending') {
    throw new ApiError(CODE.NOT_TRADING, '比赛尚未开始，不能交易');
  }
  if (c.status !== 'active') {
    throw new ApiError(CODE.NOT_TRADING, '比赛已结束，不能再交易');
  }
}

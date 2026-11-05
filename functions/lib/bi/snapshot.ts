/**
 * functions/lib/bi/snapshot.ts — 账户每日资产快照（幂等 upsert + 短路）
 * 上游成本约束：每账户每天最多 2 次行情调用（盘中首次 + 15:05 收盘覆盖）。
 */
import { marketData } from '../market-data';
import { beijingDateKey, getBeijingParts, isTradingDayTs } from '../../../shared/trading-calendar';
import type { D1Database } from '../env';
import type { Symbol as StockSymbol } from '../../../shared/types';

interface AcctRow {
  id: number;
  cash_available: number;
  frozen_cash: number;
}
interface PosRow {
  account_id: number;
  symbol: string;
  qty: number;
  avg_cost: number;
}
interface SnapRow {
  account_id: number;
  total_assets: number;
  snapshotted_at: string;
}

/** 北京时间当日 'HH:mm' 是否已过给定时刻 */
function passed(hhmm: string): boolean {
  const p = getBeijingParts();
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return p.hour * 60 + p.minute >= h * 60 + m;
}

/** 当日 15:05（北京时间）的 ISO 时间戳 */
function todayCloseCoverIso(): string {
  const p = getBeijingParts();
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 7, 5, 0)).toISOString(); // UTC 07:05 = 北京 15:05
}

export interface SnapshotOutcome {
  date: string;
  accounts: Array<{ accountId: number; action: 'created' | 'updated' | 'skipped' }>;
}

/**
 * 对用户全部活跃账户做当日快照（幂等）。
 * 返回各账户动作；非交易日返回空 accounts；行情全失败抛错（由端点转 1501）。
 */
export async function takeSnapshot(db: D1Database, userId: number): Promise<SnapshotOutcome> {
  const today = beijingDateKey();
  if (!isTradingDayTs()) {
    return { date: today, accounts: [] };
  }
  const accountsRes = await db
    .prepare("SELECT id, cash_available, frozen_cash FROM trade_accounts WHERE user_id = ?1 AND status = 'active'")
    .bind(userId)
    .all<AcctRow>();
  const accounts = accountsRes.results ?? [];
  if (accounts.length === 0) {
    return { date: today, accounts: [] };
  }

  // 持仓（positions 无 user_id 列，经 trade_accounts 归属过滤）
  const posRes = await db
    .prepare(
      'SELECT p.account_id, p.symbol, p.qty, p.avg_cost FROM positions p JOIN trade_accounts t ON t.id = p.account_id WHERE t.user_id = ?1 AND p.qty > 0'
    )
    .bind(userId)
    .all<PosRow>();
  const positions = posRes.results ?? [];

  // 当日已有快照 + 上一交易日快照（day_pnl 基准）
  const todaySnaps = await db
    .prepare('SELECT account_id, total_assets, snapshotted_at FROM daily_snapshots WHERE user_id = ?1 AND date = ?2')
    .bind(userId, today)
    .all<SnapRow>();
  const todayMap = new Map<number, SnapRow>((todaySnaps.results ?? []).map((r) => [r.account_id, r]));

  // 短路判定：决定哪些账户本次需要写入
  const coverIso = todayCloseCoverIso();
  const nowIso = new Date().toISOString();
  const afterClose = passed('15:05');
  const pending: Array<{ acct: AcctRow; action: 'created' | 'updated' }> = [];
  const skipped: SnapshotOutcome['accounts'] = [];
  for (const acct of accounts) {
    const existing = todayMap.get(acct.id);
    if (!existing) {
      pending.push({ acct, action: 'created' });
    } else if (!afterClose) {
      skipped.push({ accountId: acct.id, action: 'skipped' });
    } else if (existing.snapshotted_at < coverIso) {
      pending.push({ acct, action: 'updated' }); // 收盘覆盖（每账户每天仅此一次：覆盖后 snapshotted_at ≥ coverIso）
    } else {
      skipped.push({ accountId: acct.id, action: 'skipped' });
    }
  }

  const out: SnapshotOutcome['accounts'] = [...skipped];
  if (pending.length === 0) {
    return { date: today, accounts: out };
  }

  // 需要现价的 symbols（一次批量拉取）
  const pendingAcctIds = new Set(pending.map((p) => p.acct.id));
  const relPos = positions.filter((p) => pendingAcctIds.has(p.account_id));
  const symbols = [...new Set(relPos.map((p) => p.symbol))] as StockSymbol[];
  const priceMap = new Map<string, number>();
  if (symbols.length > 0) {
    const quotes = await marketData.fetchQuotes(symbols); // 失败抛错 → 端点转 1501
    for (const q of quotes) {
      priceMap.set(q.symbol, q.price);
    }
  }

  // 上一交易日快照（day_pnl 基准）
  const prevRows = await db
    .prepare(
      'SELECT account_id, MAX(date) AS d, total_assets FROM daily_snapshots WHERE user_id = ?1 AND date < ?2 GROUP BY account_id'
    )
    .bind(userId, today)
    .all<{ account_id: number; total_assets: number }>();
  const prevMap = new Map<number, number>((prevRows.results ?? []).map((r) => [r.account_id, r.total_assets]));

  const stmt = db.prepare(
    `INSERT INTO daily_snapshots (user_id, account_id, date, total_assets, cash, market_value, day_pnl, snapshotted_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT (user_id, account_id, date) DO UPDATE SET
       total_assets = excluded.total_assets, cash = excluded.cash, market_value = excluded.market_value,
       day_pnl = excluded.day_pnl, snapshotted_at = excluded.snapshotted_at`
  );
  const batch: ReturnType<D1Database['prepare']>[] = [];
  for (const { acct, action } of pending) {
    const cash = acct.cash_available + acct.frozen_cash;
    let mv = 0;
    for (const p of relPos) {
      if (p.account_id !== acct.id) {
        continue;
      }
      const price = priceMap.get(p.symbol) ?? p.avg_cost; // 停牌/无行情用摊薄成本兜底
      mv += p.qty * price;
    }
    const total = cash + mv;
    const prev = prevMap.get(acct.id);
    const dayPnl = prev === undefined ? 0 : total - prev;
    batch.push(stmt.bind(userId, acct.id, today, total, cash, mv, dayPnl, nowIso));
    out.push({ accountId: acct.id, action });
  }
  await db.batch(batch);
  return { date: today, accounts: out };
}

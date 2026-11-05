/**
 * functions/lib/bi/replay.ts — 历史快照回放补齐
 * 原理：按交易日遍历，用 trades 回放每日 EOD 持仓、cash_flows 回放每日现金，
 *       收盘价取免费日线（marketData.fetchKline），缺失日用最近已知收盘价兜底。
 */
import { marketData } from '../market-data';
import { beijingDateKey } from '../../../shared/trading-calendar';
import type { D1Database, D1PreparedStatement } from '../env';
import type { Symbol as StockSymbol } from '../../../shared/types';

/** 单次回放封顶交易日数（超出返回 complete:false，前端稍后重试续补） */
export const REPLAY_DAY_CAP = 120;

export interface TradeRow {
  symbol: string;
  symbol_name: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  fee_commission: number;
  fee_stamp: number;
  fee_transfer: number;
  net_amount: number;
  traded_at: string;
}

export interface WalkResult {
  /** 每 symbol 累计已实现盈亏（全历史） */
  realizedBySymbol: Map<string, number>;
  realizedTotal: number;
  /** 每日 EOD 持仓（仅调用方传入的日期序列会逐日记录） */
  eodQty: Map<string, Map<string, number>>; // date -> symbol -> qty
  /** 每日 EOD 摊薄成本（date -> symbol -> W，用于兜底价） */
  eodCost: Map<string, Map<string, number>>;
  finalQty: Map<string, number>;
  finalName: Map<string, string>;
}

/**
 * 时序推进（摊薄成本法）：买入更新成本基数；卖出先算已实现再按 W 摊薄。
 * realizedSince（ISO）：仅统计该时刻之后的卖出盈亏（区间口径）。
 * markDates（升序日期键）：在这些交易日边界记录 EOD 快照。
 */
export function walkTrades(
  rows: TradeRow[],
  opts: { realizedSince?: string; markDates?: string[] } = {}
): WalkResult {
  const qty = new Map<string, number>();
  const costSum = new Map<string, number>();
  const name = new Map<string, string>();
  const realizedBySymbol = new Map<string, number>();
  let realizedTotal = 0;
  const eodQty = new Map<string, Map<string, number>>();
  const eodCost = new Map<string, Map<string, number>>();

  const marks = [...(opts.markDates ?? [])];
  let mi = 0;
  const recordUpTo = (iso: string) => {
    while (mi < marks.length && beijingDateKey(Date.parse(iso)) > marks[mi]) {
      const d = marks[mi];
      const qm = new Map<string, number>();
      const cm = new Map<string, number>();
      for (const [s, q] of qty) {
        if (q > 0) {
          qm.set(s, q);
          cm.set(s, Math.round((costSum.get(s) ?? 0) / q));
        }
      }
      eodQty.set(d, qm);
      eodCost.set(d, cm);
      mi++;
    }
  };

  const sorted = [...rows].sort((a, b) => (a.traded_at < b.traded_at ? -1 : 1));
  for (const t of sorted) {
    recordUpTo(t.traded_at);
    name.set(t.symbol, t.symbol_name);
    const q = qty.get(t.symbol) ?? 0;
    const cs = costSum.get(t.symbol) ?? 0;
    if (t.side === 'buy') {
      qty.set(t.symbol, q + t.quantity);
      costSum.set(t.symbol, cs + Math.abs(t.net_amount)); // 买入净支出（含三费）
    } else {
      const fees = t.fee_commission + t.fee_stamp + t.fee_transfer;
      const W = q > 0 ? cs / q : 0;
      const realized = Math.round((t.price - W) * t.quantity - fees);
      if (!opts.realizedSince || t.traded_at >= opts.realizedSince) {
        realizedBySymbol.set(t.symbol, (realizedBySymbol.get(t.symbol) ?? 0) + realized);
        realizedTotal += realized;
      }
      const remain = q - t.quantity;
      qty.set(t.symbol, Math.max(0, remain));
      costSum.set(t.symbol, remain > 0 ? Math.round(W * remain) : 0);
    }
  }
  // 收尾：把剩余 mark 日期全部落上最终持仓
  if (mi < marks.length) {
    const lastIso = sorted.length > 0 ? sorted[sorted.length - 1].traded_at : new Date().toISOString();
    for (let i = mi; i < marks.length; i++) {
      const d = marks[i];
      const qm = new Map<string, number>();
      const cm = new Map<string, number>();
      for (const [s, q] of qty) {
        if (q > 0) {
          qm.set(s, q);
          cm.set(s, Math.round((costSum.get(s) ?? 0) / q));
        }
      }
      eodQty.set(d, qm);
      eodCost.set(d, cm);
    }
    void lastIso;
  }

  const finalQty = new Map([...qty].filter(([, q]) => q > 0));
  return { realizedBySymbol, realizedTotal, eodQty, eodCost, finalQty, finalName: name };
}

/** symbol → dateKey → 收盘价（分） */
type CloseMap = Map<string, Map<string, number>>;

/** 拉取回放期各 symbol 日线收盘价（串行 + 150ms 间隔，防上游风控） */
async function fetchCloses(symbols: string[], daysNeeded: number): Promise<CloseMap> {
  const out: CloseMap = new Map();
  for (const s of symbols) {
    try {
      const bars = await marketData.fetchKline({ symbol: s as StockSymbol, period: 'day', count: Math.min(daysNeeded + 60, 800) });
      const m = new Map<string, number>();
      for (const b of bars) {
        m.set(b.date, Math.round(b.close * 100)); // 元 → 分
      }
      out.set(s, m);
    } catch {
      // 单 symbol 失败不阻塞整体（后续用摊薄成本兜底）
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}

export interface ReplayOutcome {
  triggered: boolean;
  filledDays: number;
  complete: boolean;
}

/**
 * 补齐指定账户在 needDays（升序交易日键）中缺失的快照。
 * 封顶 REPLAY_DAY_CAP 天；今日不补（由心跳负责）。
 */
export async function replayGaps(
  db: D1Database,
  userId: number,
  accountIds: number[],
  needDays: string[]
): Promise<ReplayOutcome> {
  if (accountIds.length === 0 || needDays.length === 0) {
    return { triggered: false, filledDays: 0, complete: true };
  }
  const today = beijingDateKey();
  const days = needDays.filter((d) => d < today);
  if (days.length === 0) {
    return { triggered: false, filledDays: 0, complete: true };
  }

  const first = days[0];
  const last = days[days.length - 1];
  const existing = await db
    .prepare('SELECT DISTINCT account_id, date FROM daily_snapshots WHERE user_id = ?1 AND date BETWEEN ?2 AND ?3')
    .bind(userId, first, last)
    .all<{ account_id: number; date: string }>();
  const have = new Set<string>((existing.results ?? []).map((r) => `${r.account_id}|${r.date}`));

  const targets: Array<{ acctId: number; days: string[] }> = [];
  let overflow = false;
  for (const acctId of accountIds) {
    const miss = days.filter((d) => !have.has(`${acctId}|${d}`));
    if (miss.length > REPLAY_DAY_CAP) {
      miss.splice(0, miss.length - REPLAY_DAY_CAP); // 只补最近 120 天
      overflow = true;
    }
    if (miss.length > 0) {
      targets.push({ acctId, days: miss });
    }
  }
  if (targets.length === 0) {
    return { triggered: false, filledDays: 0, complete: !overflow };
  }

  const upsert = db.prepare(
    `INSERT INTO daily_snapshots (user_id, account_id, date, total_assets, cash, market_value, day_pnl, snapshotted_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     ON CONFLICT (user_id, account_id, date) DO NOTHING`
  );
  const nowIso = new Date().toISOString();
  let filled = 0;

  for (const { acctId, days: miss } of targets) {
    // 全历史成交与资金流水（该账户）
    const tradesRes = await db
      .prepare(
        `SELECT t.symbol, t.symbol_name, t.side, t.price, t.quantity, t.fee_commission, t.fee_stamp, t.fee_transfer, t.net_amount, t.traded_at
         FROM trades t WHERE t.account_id = ?1 ORDER BY t.traded_at ASC`
      )
      .bind(acctId)
      .all<TradeRow>();
    const trades = tradesRes.results ?? [];
    if (trades.length === 0 && miss.length > 0) {
      continue; // 无成交历史，无可回放数据（心跳会从今天开始积累）
    }
    const flowsRes = await db
      .prepare('SELECT amount, created_at FROM cash_flows WHERE account_id = ?1 ORDER BY created_at ASC')
      .bind(acctId)
      .all<{ amount: number; created_at: string }>();
    const flows = (flowsRes.results ?? []).map((f) => ({ amount: f.amount, day: beijingDateKey(Date.parse(f.created_at)) }));

    // 回放所需交易日序列（从首个缺失日往前多取 1 天做 day_pnl 基准）
    const allMarks = miss;
    const walk = walkTrades(trades, { markDates: allMarks });

    // 收盘价批量获取
    const symbols = [...new Set(trades.map((t) => t.symbol))];
    const spanDays = Math.max(10, Math.ceil((Date.parse(last) - Date.parse(first)) / 86400000) + 5);
    const closes = await fetchCloses(symbols, spanDays);

    // 每账户首个缺失日之前的快照基准（day_pnl 起点）
    const prevRow = await db
      .prepare('SELECT total_assets FROM daily_snapshots WHERE user_id = ?1 AND account_id = ?2 AND date < ?3 ORDER BY date DESC LIMIT 1')
      .bind(userId, acctId, miss[0])
      .first<{ total_assets: number }>();
    let prevTotal: number | null = prevRow?.total_assets ?? null;

    // 现金前缀：flowDay ≤ D 的 Σamount
    const stmts: D1PreparedStatement[] = [];
    for (const d of miss) {
      let cash = 0;
      for (const f of flows) {
        if (f.day <= d) {
          cash += f.amount;
        }
      }
      const qm = walk.eodQty.get(d) ?? new Map<string, number>();
      const cm = walk.eodCost.get(d) ?? new Map<string, number>();
      let mv = 0;
      for (const [s, q] of qm) {
        const hist = closes.get(s);
        let price: number | undefined = hist?.get(d);
        if (price === undefined && hist) {
          // 最近已知收盘价（≤ d）
          for (const [k, v] of hist) {
            if (k <= d) {
              price = v;
            }
          }
        }
        if (price === undefined) {
          price = cm.get(s) ?? 0; // 全缺用摊薄成本兜底
        }
        mv += q * price;
      }
      const total = cash + mv;
      const dayPnl = prevTotal === null ? 0 : total - prevTotal;
      prevTotal = total;
      stmts.push(upsert.bind(userId, acctId, d, total, cash, mv, dayPnl, nowIso));
      filled++;
      if (stmts.length >= 50) {
        await db.batch(stmts);
        stmts.length = 0;
      }
    }
    if (stmts.length > 0) {
      await db.batch(stmts);
    }
  }

  return { triggered: true, filledDays: filled, complete: !overflow };
}

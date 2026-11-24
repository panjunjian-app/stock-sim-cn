/**
 * overview.ts — 账户总览计算：后端基础值 + 持仓 + 行情快照 → 完整 AccountOverview
 */
import type { AccountOverview, Cents, Position, Quote, Symbol as StockSymbol } from '../../shared/types';

export interface OverviewBase {
  accountId: number;
  name: string;
  cashAvailable: Cents;
  frozenCash: Cents;
  totalDeposit: Cents;
  /** 昨日收市总资产基准（分）；开赛/开户第一天为 null/undefined → 当日盈亏=累计盈亏 */
  prevSettledTotal?: Cents | null;
}

/** 合并行情快照计算总览（市值/总资产/当日盈亏/累计盈亏）
 *  当日盈亏 = 实时总资产 − 昨日收市总资产基准；无基准（开赛/开户第一天）→ 等于累计盈亏 */
export function computeOverview(
  base: OverviewBase,
  positions: Position[],
  quotes: Record<StockSymbol, Quote>,
): AccountOverview {
  let marketValue: Cents = 0;
  for (const p of positions) {
    const q = quotes[p.symbol];
    const last = q ? q.price : p.avgCost; // 无快照时以成本兜底
    marketValue += p.qty * last;
  }
  const totalAsset = base.cashAvailable + base.frozenCash + marketValue;
  const totalPnl = totalAsset - base.totalDeposit;
  const totalPnlPct = base.totalDeposit > 0 ? Number(((totalPnl / base.totalDeposit) * 100).toFixed(2)) : 0;
  const hasPrev = base.prevSettledTotal != null;
  const dayPnl = hasPrev ? totalAsset - (base.prevSettledTotal as Cents) : totalPnl;
  const dayPnlBase = hasPrev ? (base.prevSettledTotal as Cents) : base.totalDeposit;
  const dayPnlPct = dayPnlBase > 0 ? Number(((dayPnl / dayPnlBase) * 100).toFixed(2)) : 0;
  return {
    ...base,
    marketValue,
    totalAsset,
    dayPnl,
    dayPnlPct,
    totalPnl,
    totalPnlPct,
  };
}

/** 持仓合并快照（lastPrice/marketValue/pnl/pnlPct + 当日盈亏 prevClose/dayPnl/dayPnlPct）
 *  当日盈亏分两部分：昨日持有部分 = (最新价 − 昨收) × 昨持量；今日买入部分 = (最新价 − 摊薄成本) × 今日买入量
 *  （摊薄成本已含费用摊入，与汇总资金口径近似对齐）。
 *  当日盈亏比例：有昨持部分时基于昨收计算；全部为今日买入时基于买入成本计算，让用户仍能看到比例。
 *  无行情快照时 prevClose/dayPnl/dayPnlPct 均为 undefined（前端展示「—」） */
export function mergePositions(positions: Position[], quotes: Record<StockSymbol, Quote>): Position[] {
  return positions.map((p) => {
    const q = quotes[p.symbol];
    const lastPrice = q ? q.price : p.avgCost;
    const marketValue = p.qty * lastPrice;
    const pnl = marketValue - p.qty * p.avgCost;
    const pnlPct = p.avgCost > 0 ? Number(((pnl / (p.qty * p.avgCost)) * 100).toFixed(2)) : 0;
    // 当日盈亏：仅在有行情快照且昨收有效时可计算
    const prevClose = q ? q.prevClose : undefined;
    let dayPnl: Cents | undefined;
    let dayPnlPct: number | undefined;
    if (prevClose !== undefined) {
      const todayBuyQty = p.todayBuyQty ?? 0;
      const preHeld = p.qty - todayBuyQty; // 昨日持有量
      // 昨持部分：现价对昨收（prevClose=0 时按差值算金额，仅比例不可算）
      dayPnl = ((lastPrice - prevClose) * preHeld) as Cents;
      if (preHeld > 0 && prevClose > 0) {
        dayPnlPct = Number((((lastPrice - prevClose) / prevClose) * 100).toFixed(2));
      }
      // 今日买入部分：现价对摊薄成本（avgCost 已含费用摊入，与汇总资金口径近似对齐）
      if (todayBuyQty > 0 && p.avgCost > 0) {
        dayPnl = (dayPnl + (lastPrice - p.avgCost) * todayBuyQty) as Cents;
        if (preHeld <= 0) {
          // 全部为今日买入：无昨收基准，用买入成本作为比例基准
          dayPnlPct = Number((((lastPrice - p.avgCost) / p.avgCost) * 100).toFixed(2));
        }
      }
    }
    return { ...p, lastPrice, marketValue, pnl, pnlPct, prevClose, dayPnl, dayPnlPct };
  });
}

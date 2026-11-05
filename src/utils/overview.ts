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

/** 持仓合并快照（lastPrice/marketValue/pnl/pnlPct） */
export function mergePositions(positions: Position[], quotes: Record<StockSymbol, Quote>): Position[] {
  return positions.map((p) => {
    const q = quotes[p.symbol];
    const lastPrice = q ? q.price : p.avgCost;
    const marketValue = p.qty * lastPrice;
    const pnl = marketValue - p.qty * p.avgCost;
    const pnlPct = p.avgCost > 0 ? Number(((pnl / (p.qty * p.avgCost)) * 100).toFixed(2)) : 0;
    return { ...p, lastPrice, marketValue, pnl, pnlPct };
  });
}

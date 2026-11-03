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
}

/** 合并行情快照计算总览（市值/总资产/当日盈亏/累计盈亏） */
export function computeOverview(
  base: OverviewBase,
  positions: Position[],
  quotes: Record<StockSymbol, Quote>,
): AccountOverview {
  let marketValue: Cents = 0;
  let prevValue: Cents = 0;
  for (const p of positions) {
    const q = quotes[p.symbol];
    const last = q ? q.price : p.avgCost; // 无快照时以成本兜底
    marketValue += p.qty * last;
    prevValue += p.qty * (q ? q.prevClose : p.avgCost);
  }
  const totalAsset = base.cashAvailable + base.frozenCash + marketValue;
  const dayPnl = marketValue - prevValue;
  const dayPnlPct = prevValue > 0 ? Number(((dayPnl / prevValue) * 100).toFixed(2)) : 0;
  const totalPnl = totalAsset - base.totalDeposit;
  const totalPnlPct = base.totalDeposit > 0 ? Number(((totalPnl / base.totalDeposit) * 100).toFixed(2)) : 0;
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

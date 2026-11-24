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
 *  当日盈亏分两部分：昨日持有部分 = (最新价 − 昨收) × 昨持量；今日买入部分 = 最新价 × 今日买入量 + 今日买入净额
 *  （= (最新价 − 今日买入每股净成本) × 今日买入量，整数分精确、已含费用，与资金口径严格对齐）。
 *  为何今日买入部分不用摊薄 avgCost：卖出不重算 avgCost（均价法，对剩余持仓正确），
 *  但今日「加仓 + 卖老仓」时 avgCost 仍含已卖出老仓的成本，会使今日新买部分盈亏失真；
 *  旧接口响应无 todayBuyNet 时退回 avgCost 口径（兼容）。
 *  当日盈亏比例：有昨持部分时基于昨收计算；全部为今日买入时基于今日买入净成本计算。
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
      // 昨日持有量 = 持仓 − 今日买入量（A股 T+1：今日卖出只能来自昨持，故此拆分恒非负）
      const preHeld = Math.max(p.qty - todayBuyQty, 0);
      // 昨持部分：现价对昨收（prevClose=0 时按差值算金额，仅比例不可算）
      dayPnl = ((lastPrice - prevClose) * preHeld) as Cents;
      if (preHeld > 0 && prevClose > 0) {
        dayPnlPct = Number((((lastPrice - prevClose) / prevClose) * 100).toFixed(2));
      }
      // 今日买入部分：最新价 × 今买量 + 今买净额（净额为负值，已含费用）
      if (todayBuyQty > 0) {
        const todayBuyNet = p.todayBuyNet;
        if (todayBuyNet != null && Number.isFinite(todayBuyNet)) {
          dayPnl = (dayPnl + lastPrice * todayBuyQty + todayBuyNet) as Cents;
          if (preHeld <= 0) {
            const costPerShare = -todayBuyNet / todayBuyQty; // 每股净成本（含费用）
            if (costPerShare > 0) {
              dayPnlPct = Number((((lastPrice - costPerShare) / costPerShare) * 100).toFixed(2));
            }
          }
        } else if (p.avgCost > 0) {
          // 兼容旧接口响应（无 todayBuyNet）：退回摊薄成本口径
          dayPnl = (dayPnl + (lastPrice - p.avgCost) * todayBuyQty) as Cents;
          if (preHeld <= 0) {
            // 全部为今日买入：无昨收基准，用买入成本作为比例基准
            dayPnlPct = Number((((lastPrice - p.avgCost) / p.avgCost) * 100).toFixed(2));
          }
        }
      }
    }
    return { ...p, lastPrice, marketValue, pnl, pnlPct, prevClose, dayPnl, dayPnlPct };
  });
}

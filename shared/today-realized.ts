/**
 * today-realized.ts — 「今日卖出已实现盈亏」与「持仓明细合计」纯计算（前后端共用）
 *
 * 口径说明（金额一律整数分）：
 *   今日卖出已实现 = Σ 卖出净额（net_amount，已扣佣金/印花税/过户费）− Σ 昨收价 × 卖出股数
 *   持仓当日盈亏   = Σ 各行 dayPnl（见 src/utils/overview.mergePositions）
 *   合计当日盈亏   = 持仓当日盈亏 + 今日卖出已实现
 *
 * 为什么需要它：持仓表只列 qty>0 的股票，今日卖出（尤其清仓）那部分盈亏不在明细行中，
 * 而顶部汇总「当日盈亏」是账户资金口径（含已实现部分）→ 交易越频繁，明细加总与汇总差得越多。
 * 把已实现部分显式补进合计条后，明细合计即与汇总 KPI 对齐（残差仅来自逐笔四舍五入）。
 *
 * 本模块必须保持「纯函数 + 无运行时依赖」，后端（Cloudflare Functions）与前端（Vite）共用。
 */
import type { Cents, Position, Symbol as StockSymbol, TodayRealized, TodayRealizedItem } from './types';
import { formatSignedYuan, formatYuan } from './money';

/** 今日卖出聚合行（后端 trades 表 GROUP BY symbol 的结果） */
export interface TodaySellAggregate {
  symbol: StockSymbol;
  /** 今日累计卖出股数 */
  sellQty: number;
  /** 今日累计卖出净额（分，已扣三费） */
  sellNet: Cents;
  /** 股票名称（来自 trades.symbol_name，行情失败时仍可用于展示） */
  symbolName?: string;
}

/** 单个标的的行情元信息（昨收、名称） */
export interface SymbolQuoteMeta {
  name?: string;
  /** 昨收价（分）；null/undefined 表示行情不可用 */
  prevClose?: number | null;
}

/** 安全的整数化：NaN/Infinity/undefined → 0 */
function toFiniteInt(value: number | null | undefined): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : 0;
}

/**
 * 计算今日卖出已实现盈亏。
 *
 * @param rows 今日卖出聚合行（symbol 已合并；sellQty ≤ 0 的行会被忽略）
 * @param quoteMeta 行情元信息（symbol → { name, prevClose }），缺失即视为行情不可用
 * @returns dayPnl：全部标的都可计算时为合计值，任一标的缺昨收时为 null（表示「无法计算」）；
 *          无卖出时返回 { dayPnl: 0, items: [], degraded: false }
 */
export function computeTodayRealized(
  rows: TodaySellAggregate[] = [],
  quoteMeta: Record<StockSymbol, SymbolQuoteMeta> = {},
): TodayRealized {
  const items: TodayRealizedItem[] = [];
  let sum: Cents = 0;
  let computable = true;

  for (const row of rows) {
    const symbol = row.symbol;
    if (!symbol) {
      continue;
    }
    const sellQty = toFiniteInt(row.sellQty);
    if (sellQty <= 0) {
      continue;
    }
    const sellNet = toFiniteInt(row.sellNet);
    const meta = quoteMeta[symbol];
    const prevCloseRaw = meta?.prevClose;
    const prevClose = prevCloseRaw == null ? null : toFiniteInt(prevCloseRaw);
    const symbolName = row.symbolName || meta?.name || symbol;

    if (prevClose === null || prevClose <= 0) {
      // 昨收无效 → 该股无法计算（行情降级），整体结果标记为不可计算
      computable = false;
      items.push({ symbol, symbolName, sellQty, dayPnl: null });
      continue;
    }
    const dayPnl = (sellNet - prevClose * sellQty) as Cents;
    sum += dayPnl;
    items.push({ symbol, symbolName, sellQty, dayPnl });
  }

  // 盈亏从高到低（不可计算项排末尾，同状态按代码升序，保证渲染稳定）
  items.sort((a, b) => {
    const av = a.dayPnl;
    const bv = b.dayPnl;
    if (av === null && bv === null) {
      return a.symbol.localeCompare(b.symbol);
    }
    if (av === null) {
      return 1;
    }
    if (bv === null) {
      return -1;
    }
    if (bv !== av) {
      return bv - av;
    }
    return a.symbol.localeCompare(b.symbol);
  });

  return { dayPnl: computable ? sum : null, items, degraded: !computable };
}

/** 持仓明细底部合计条所需的全部数值 */
export interface DayPnlSummary {
  /** Σ 持仓行当日盈亏（分）；缺快照的行不计入 */
  holdings: Cents;
  /** 所有持仓行是否都能算出当日盈亏（false 时合计不可信） */
  holdingsComplete: boolean;
  /** 今日卖出已实现（分）；无法计算为 null */
  realized: Cents | null;
  /** 今日卖出明细 */
  realizedItems: TodayRealizedItem[];
  /** 今日是否有卖出（决定是否展示「今日卖出已实现」一行） */
  hasRealized: boolean;
  /** 合计当日盈亏（分）；任一部分不可计算时为 null */
  total: Cents | null;
  /** 合计是否完整可计算 */
  complete: boolean;
}

/**
 * 汇总持仓明细合计条：持仓部分 + 今日卖出已实现 → 合计当日盈亏。
 *
 * @param positions 已合并行情快照的持仓行（dayPnl 由 mergePositions 计算）
 * @param todayRealized 后端返回的今日卖出已实现；缺省视为无卖出
 */
export function summarizeDayPnl(
  positions: Position[] = [],
  todayRealized?: TodayRealized | null,
): DayPnlSummary {
  let holdings: Cents = 0;
  let holdingsComplete = true;
  for (const p of positions) {
    if (p.dayPnl == null || !Number.isFinite(p.dayPnl)) {
      holdingsComplete = false;
      continue;
    }
    holdings += p.dayPnl;
  }

  const realizedItems: TodayRealizedItem[] = todayRealized?.items ?? [];
  const hasRealized = realizedItems.length > 0;
  const realizedRaw = todayRealized?.dayPnl;
  const realized: Cents | null = realizedRaw == null || !Number.isFinite(realizedRaw) ? null : realizedRaw;
  // 无卖出时不把已实现计入合计（避免隐藏行仍影响合计的隐性偏差）
  const effectiveRealized: Cents = hasRealized ? (realized ?? 0) : 0;
  const complete = holdingsComplete && (!hasRealized || (realized !== null && realizedItems.every((it) => it.dayPnl !== null)));
  const total: Cents | null = complete ? ((holdings + effectiveRealized) as Cents) : null;

  return {
    holdings,
    holdingsComplete,
    realized,
    realizedItems,
    hasRealized,
    total,
    complete,
  };
}

/** 今日卖出明细的多行提示文本（供 hover title 使用；不可计算项显示「—」） */
export function formatRealizedDetail(items: TodayRealizedItem[] = []): string {
  if (items.length === 0) {
    return '';
  }
  return items
    .map((it) => {
      const pnlText = it.dayPnl === null ? '—' : formatSignedYuan(it.dayPnl);
      return `${it.symbolName} ${it.sellQty}股 ${pnlText} 元`;
    })
    .join('\n');
}

/** 单只股票已实现盈亏的简短文本（元）；不可计算返回「—」 */
export function formatRealizedItemPnl(item: TodayRealizedItem): string {
  return item.dayPnl === null ? '—' : `${formatSignedYuan(item.dayPnl)} 元`;
}

/** 合计条的兜底文本（元）；null → 「—」 */
export function formatSummaryAmount(value: Cents | null): string {
  return value === null ? '—' : formatSignedYuan(value);
}

/** 合计条金额的绝对值展示（元），用于「卖出额」等无方向数值 */
export function formatSummaryAbs(value: Cents | null): string {
  return value === null ? '—' : formatYuan(Math.abs(value));
}

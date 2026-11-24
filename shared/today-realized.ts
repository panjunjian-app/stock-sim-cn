/**
 * today-realized.ts — 「今日卖出已实现盈亏」与「持仓明细合计」纯计算（前后端共用）
 *
 * 口径（金额一律整数分）。对单只标的定义：
 *   q1 = 当前持仓；qB = 今日买入量；NB = 今日买入净额（负）；qS = 今日卖出量；NS = 今日卖出净额（正）；
 *   pc = 昨收价；price = 最新价 → q0 = max(q1 − qB + qS, 0)（昨日持有量）
 *   q0r = max(q0 − qS, 0)（昨持且仍未卖出）；tbr = q1 − q0r（今买且仍未卖出）
 *   soldFromPrior = min(qS, q0)；soldFromToday = qS − soldFromPrior（T+0 残留：卖到了今日买入的份额）
 *   NB_sold = round(NB × soldFromToday / qB)；NB_r = NB − NB_sold（互补，保证不漏分）
 *
 *   持仓行当日盈亏 = (price − pc) × q0r + price × tbr + NB_r
 *   今日卖出已实现 = NS − pc × soldFromPrior + NB_sold
 *   两式相加恒等于 price×q1 + NB + NS − pc×q0（账户资金口径 KPI），且**严格相等、无舍入残差**
 *   （因为 NB_r + NB_sold ≡ NB，q0r + soldFromPrior ≡ q0）。
 *
 * 正常数据下（A股 T+1：卖出只来自昨持）soldFromToday = 0、q0r = q0 − qS、tbr = qB，
 * 上式退化为 (price − pc) × 昨持余量 + price × 今买量 + NB，与历史口径逐分一致。
 * 但历史 T+0 存量数据（早于 T+1 修复的成交）会出现 soldFromToday > 0，必须按上式拆分，
 * 否则「已卖出的今买份额」会被「持仓行 + 已实现」重复计算（生产账户 22 实测差 1,710 元）。
 *
 * 本模块必须保持「纯函数 + 无运行时依赖」，后端（Cloudflare Functions）与前端（Vite）共用。
 */
import type { Cents, Position, Symbol as StockSymbol, TodayRealized, TodayRealizedItem } from './types';
import { formatSignedYuan, formatYuan } from './money';

/** 单只标的「今日」成交与持仓拆分输入（整数分/股；不含行情） */
export interface DayPnlSplitInput {
  /** 当前持仓 q1（股） */
  holdQty: number;
  /** 今日买入量 qB（股） */
  todayBuyQty: number;
  /** 今日买入净额 NB（分，买入为负、含费用） */
  todayBuyNet: Cents;
  /** 今日卖出量 qS（股） */
  todaySellQty: number;
  /** 今日卖出净额 NS（分，卖出为正、已扣费用） */
  todaySellNet: Cents;
}

/** 单只标的的「昨持 / 今买 / 已卖」精确拆分结果 */
export interface DayPnlSplit {
  /** 昨日持有总量 q0（股） */
  prevHeldQty: number;
  /** 昨持且仍未卖出 q0r（股） */
  prevHeldRemainQty: number;
  /** 今买且仍未卖出 tbr（股） */
  todayBuyRemainQty: number;
  /** 今买未卖出部分的净额 NB_r（分，含费用） */
  todayBuyRemainNet: Cents;
  /** 昨持中被今日卖出的股数 */
  soldFromPriorQty: number;
  /** 今日买入中被今日卖出（T+0 残留）的股数 */
  soldFromTodayQty: number;
  /** 已卖出今买份额分摊的买入净额 NB_sold（分，含费用） */
  soldTodayBuyNet: Cents;
}

/** 今日卖出聚合行（后端 trades 表 GROUP BY symbol 的结果） */
export interface TodaySellAggregate {
  symbol: StockSymbol;
  /** 今日累计卖出股数 qS */
  sellQty: number;
  /** 今日累计卖出净额（分，已扣三费）NS */
  sellNet: Cents;
  /** 股票名称（来自 trades.symbol_name，行情失败时仍可用于展示） */
  symbolName?: string;
  /** 该标的当前持仓 q1（股）；提供时启用「昨持/今买/已卖」精确拆分（T+0 残留兜底） */
  holdQty?: number;
  /** 今日累计买入量 qB（股）；提供时启用精确拆分 */
  todayBuyQty?: number;
  /** 今日累计买入净额 NB（分，买入为负）；提供时启用精确拆分 */
  todayBuyNet?: Cents;
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

/** 四舍五入但「远离 0」（避免负数时 round(-x.5) 偏向 +∞ 造成分摊不对称） */
function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * 拆分单只标的的「昨持 / 今买 / 已卖出」份额与买入净额。
 *
 * 守恒性：prevHeldRemainQty + soldFromPriorQty ≡ prevHeldQty（q0）；
 *        todayBuyRemainNet + soldTodayBuyNet ≡ todayBuyNet（NB）；
 *        prevHeldRemainQty + todayBuyRemainQty ≡ holdQty（q1）。
 */
export function splitDayPnlPosition(input: DayPnlSplitInput): DayPnlSplit {
  const holdQty = Math.max(toFiniteInt(input.holdQty), 0);
  const todayBuyQty = Math.max(toFiniteInt(input.todayBuyQty), 0);
  const todayBuyNet = toFiniteInt(input.todayBuyNet);
  const todaySellQty = Math.max(toFiniteInt(input.todaySellQty), 0);
  const todaySellNet = toFiniteInt(input.todaySellNet);

  // 昨日持有总量：q0 = q1 − qB + qS（持仓 + 今日已卖 − 今日买入）
  const prevHeldQty = Math.max(holdQty - todayBuyQty + todaySellQty, 0);
  // 卖出优先消耗昨持（T+1 规则下必然如此），超出部分即 T+0 残留（卖到了今日买入份额）
  const soldFromPriorQty = Math.min(todaySellQty, prevHeldQty);
  const prevHeldRemainQty = Math.max(prevHeldQty - todaySellQty, 0);
  const soldFromTodayQty = todaySellQty - soldFromPriorQty;
  const todayBuyRemainQty = Math.max(holdQty - prevHeldRemainQty, 0);
  const soldTodayBuyNet =
    soldFromTodayQty > 0 && todayBuyQty > 0
      ? roundHalfAwayFromZero((todayBuyNet * soldFromTodayQty) / todayBuyQty)
      : 0;
  const todayBuyRemainNet = todayBuyNet - soldTodayBuyNet;

  return {
    prevHeldQty,
    prevHeldRemainQty,
    todayBuyRemainQty,
    todayBuyRemainNet,
    soldFromPriorQty,
    soldFromTodayQty,
    soldTodayBuyNet,
  };
}

/**
 * 计算今日卖出已实现盈亏。
 *
 * 精确分支（行内提供 holdQty + todayBuyQty）：`NS − pc × soldFromPrior + NB_sold`，
 * 卖出只来自昨持时退化为 `NS − pc × qS`（历史口径）；T+0 残留时把今买成本一并计入已实现。
 * 兼容分支（未提供拆分字段）：`NS − pc × qS`。
 * 昨收仅在被卖出部分含昨持份额时才必需（纯 T+0 卖出无需昨收，可避免无谓降级）。
 *
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

    // 行内带持仓/买入信息时可做精确拆分（能识别 T+0 残留）
    const split =
      row.holdQty != null && row.todayBuyQty != null
        ? splitDayPnlPosition({
            holdQty: row.holdQty,
            todayBuyQty: row.todayBuyQty,
            todayBuyNet: row.todayBuyNet ?? 0,
            todaySellQty: sellQty,
            todaySellNet: sellNet,
          })
        : null;
    const soldFromPriorQty = split ? split.soldFromPriorQty : sellQty;
    const soldTodayBuyNet = split ? split.soldTodayBuyNet : 0;
    // 昨收只影响「昨持部分」，纯 T+0 卖出（无昨持份额）不需要昨收
    const needsPrevClose = soldFromPriorQty > 0;

    if (needsPrevClose && (prevClose === null || prevClose <= 0)) {
      // 昨收无效 → 该股无法计算（行情降级），整体结果标记为不可计算
      computable = false;
      items.push({ symbol, symbolName, sellQty, dayPnl: null });
      continue;
    }
    const dayPnl = (sellNet - (needsPrevClose ? (prevClose as number) * soldFromPriorQty : 0) + soldTodayBuyNet) as Cents;
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

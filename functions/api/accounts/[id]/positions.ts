import { handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { listPositions, requireOwnedAccount } from '../../../lib/account-service';
import { marketData } from '../../../lib/market-data';
import { beijingDateKey, beijingToTs } from '../../../../shared/trading-calendar';
import { computeTodayRealized, splitDayPnlPosition } from '../../../../shared/today-realized';
import type { DayPnlSplit } from '../../../../shared/today-realized';
import type { Symbol as StockSymbol } from '../../../../shared/types';
import type { SymbolQuoteMeta, TodaySellAggregate } from '../../../../shared/today-realized';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

/** 今日买入量行（symbol → 今日累计买入股数 + 买入净额） */
interface TodayBuyRow {
  symbol: string;
  buy_qty: number;
  buy_net: number;
}

/** 今日卖出聚合行（symbol → 今日累计卖出股数与净额） */
interface TodaySellRow {
  symbol: string;
  symbol_name: string | null;
  sell_qty: number;
  sell_net: number;
}

/** 单次行情请求的最大标的数（与 /api/market/quote 上限一致） */
const QUOTE_CHUNK_SIZE = 30;
/** 昨收补取的本地超时：行情源抖动时不拖慢持仓接口（超时按行情降级处理） */
const QUOTE_TIMEOUT_MS = 2_500;

/** 给任意 Promise 加超时（超时即 reject，由调用方降级） */
function withTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`quote timeout ${ms}ms`)), ms);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * 批量补取昨收价（分）。
 * 分片并发请求，任一分片失败仅影响该片标的（其结果 prevClose 缺省 → 已实现盈亏为 null）。
 */
async function fetchPrevCloseMeta(
  symbols: StockSymbol[],
): Promise<Record<StockSymbol, SymbolQuoteMeta>> {
  const meta: Record<StockSymbol, SymbolQuoteMeta> = {};
  if (symbols.length === 0) {
    return meta;
  }
  const chunks: StockSymbol[][] = [];
  for (let i = 0; i < symbols.length; i += QUOTE_CHUNK_SIZE) {
    chunks.push(symbols.slice(i, i + QUOTE_CHUNK_SIZE));
  }
  const chunkQuotes = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        return await withTimeout(marketData.fetchQuotes(chunk), QUOTE_TIMEOUT_MS);
      } catch (err) {
        console.error('[accounts/positions] quotes degraded:', (err as Error).message);
        return [];
      }
    }),
  );
  for (const quotes of chunkQuotes) {
    for (const q of quotes) {
      meta[q.symbol] = { name: q.name, prevClose: q.prevClose };
    }
  }
  return meta;
}

/**
 * GET /api/accounts/:id/positions — 持仓列表（不含实时价，前端合并快照）
 *
 * 每行附带 prevHeldQty / todayBuyQty / todayBuyNet（「昨持未卖 / 今买未卖 / 今买未卖净额」精确拆分），
 * 前端据此计算当日盈亏；同时返回 todayRealized（今日卖出已实现盈亏）：
 * 持仓表只列 qty>0 的股票，今日卖出/清仓部分的当日盈亏不在明细里，需在接口层补出，
 * 前端才能把「明细合计」与顶部汇总（资金口径）对齐。
 * 拆分口径与恒等式见 shared/today-realized.ts 顶部注释（含 T+0 存量数据场景）。
 */
export const onRequestGet = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    const positions = await listPositions(ctx.env.DB, acc.id);
    // 今日（北京 00:00 起）：当日盈亏需对今日买入部分用买入成本而非昨收
    // ⚠️ trades.traded_at 是 TEXT 列（ISO UTC 字符串）：绑定参数必须是同构的 ISO 字符串，
    // 若绑定数字毫秒时间戳，SQLite TEXT 亲和会转成数字字符串做字典序比较导致条件恒真（返回全历史数据）。
    const todayStartIso = new Date(beijingToTs(beijingDateKey(), '00:00')).toISOString(); // '2026-11-24T00:00+08:00' → '2026-11-23T16:00:00.000Z'
    const buyRows =
      (
        await ctx.env.DB.prepare(
          "SELECT symbol, SUM(quantity) AS buy_qty, SUM(net_amount) AS buy_net FROM trades WHERE account_id = ?1 AND side = 'buy' AND traded_at >= ?2 GROUP BY symbol",
        )
          .bind(acc.id, todayStartIso)
          .all<TodayBuyRow>()
      ).results ?? [];
    const buyQtyBySymbol = new Map<string, number>(buyRows.map((r) => [r.symbol, r.buy_qty]));
    // 今日买入净额（负值，已含费用）：今日买入部分当日盈亏的成本基准。
    // 不能用摊薄 avgCost —— 卖出不重算 avgCost（均价法），今日「加仓 + 卖老仓」时 avgCost 仍含
    // 已卖出老仓的成本，会让今日新买部分盈亏失真。
    const buyNetBySymbol = new Map<string, number>(buyRows.map((r) => [r.symbol, r.buy_net]));
    // 今日卖出（含已清仓标的）：卖出净额已扣三费，故已实现盈亏天然含费用
    const sellRows =
      (
        await ctx.env.DB.prepare(
          "SELECT symbol, MAX(symbol_name) AS symbol_name, SUM(quantity) AS sell_qty, SUM(net_amount) AS sell_net FROM trades WHERE account_id = ?1 AND side = 'sell' AND traded_at >= ?2 GROUP BY symbol",
        )
          .bind(acc.id, todayStartIso)
          .all<TodaySellRow>()
      ).results ?? [];
    const sellAggregates: TodaySellAggregate[] = sellRows.map((r) => ({
      symbol: r.symbol,
      symbolName: r.symbol_name ?? undefined,
      sellQty: r.sell_qty,
      sellNet: r.sell_net,
    }));
    const sellQtyBySymbol = new Map<string, number>(sellRows.map((r) => [r.symbol, r.sell_qty]));
    const sellNetBySymbol = new Map<string, number>(sellRows.map((r) => [r.symbol, r.sell_net]));
    const holdQtyBySymbol = new Map<string, number>(positions.map((p) => [p.symbol, p.qty]));

    /** 单只标的「昨持 / 今买 / 已卖」精确拆分（T+0 存量数据兜底，见 shared/today-realized） */
    const splitFor = (symbol: string): DayPnlSplit =>
      splitDayPnlPosition({
        holdQty: holdQtyBySymbol.get(symbol) ?? 0,
        todayBuyQty: buyQtyBySymbol.get(symbol) ?? 0,
        todayBuyNet: buyNetBySymbol.get(symbol) ?? 0,
        todaySellQty: sellQtyBySymbol.get(symbol) ?? 0,
        todaySellNet: sellNetBySymbol.get(symbol) ?? 0,
      });

    // 卖出聚合行补上持仓/今买信息，供 computeTodayRealized 走精确分支
    for (const row of sellAggregates) {
      row.holdQty = holdQtyBySymbol.get(row.symbol) ?? 0;
      row.todayBuyQty = buyQtyBySymbol.get(row.symbol) ?? 0;
      row.todayBuyNet = buyNetBySymbol.get(row.symbol) ?? 0;
    }
    // 无卖出时不请求行情（保持接口轻量）
    const quoteMeta =
      sellAggregates.length > 0
        ? await fetchPrevCloseMeta(sellAggregates.map((a) => a.symbol))
        : {};
    const todayRealized = computeTodayRealized(sellAggregates, quoteMeta);

    return ok({
      positions: positions.map((p) => {
        // 拆分后返回「昨持未卖 q0r / 今买未卖 tbr / 今买未卖净额 NB_r」，
        // 让前端当日盈亏公式在 T+0 存量数据下也不重复计算已卖出的今买份额
        const split = splitFor(p.symbol);
        return {
          symbol: p.symbol,
          symbolName: p.symbol_name,
          qty: p.qty,
          availableQty: p.available_qty,
          frozenQty: p.frozen_qty,
          avgCost: p.avg_cost,
          prevHeldQty: split.prevHeldRemainQty,
          todayBuyQty: split.todayBuyRemainQty,
          todayBuyNet: split.todayBuyRemainNet,
          lastPrice: 0,
          marketValue: 0,
          pnl: 0,
          pnlPct: 0,
        };
      }),
      todayRealized,
    });
  } catch (err) {
    return handleError(err);
  }
};

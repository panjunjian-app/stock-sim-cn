/**
 * functions/lib/bi/aggregate.ts — BI 聚合端点核心计算
 * 一次请求返回 range+acct 维度全部 P0 指标与序列（含快照缺口懒回放）。
 */
import { marketData } from '../market-data';
import { ApiError, CODE } from '../response';
import { beijingDateKey } from '../../../shared/trading-calendar';
import type {
  BiAcct,
  BiAllocationSlice,
  BiContributionItem,
  BiDailyPnlPoint,
  BiKpi,
  BiNavPoint,
  BiPositionRow,
  BiReport,
  BiRange,
  Symbol as StockSymbol,
} from '../../../shared/types';
import { parseRange, rangeBounds, tradingDaysInRange } from './trading-day';
import { replayGaps, walkTrades, type TradeRow } from './replay';
import type { D1Database } from '../env';

/** 实时行情微缓存（5s）——心跳与报表、聚合内部去重，减少上游调用 */
const quoteCache = new Map<string, { ts: number; price: number; name: string }>();
const QUOTE_TTL_MS = 5_000;

interface AcctRow {
  id: number;
  name: string;
  cash_available: number;
  frozen_cash: number;
}
interface PosRow {
  account_id: number;
  symbol: string;
  symbol_name: string;
  qty: number;
  avg_cost: number;
}
interface SnapRow {
  account_id: number;
  date: string;
  total_assets: number;
  day_pnl: number;
}

function inClause(ids: number[]): string {
  return ids.join(',');
}

/** 批量获取现价（带 5s 微缓存；停牌/失败回退 avg_cost 由调用方处理） */
async function fetchPriceMap(db: D1Database, userId: number, acctIds: number[], fallbacks: Map<string, number>): Promise<Map<string, { price: number; name: string }>> {
  const posRes = await db
    .prepare(
      `SELECT p.symbol, p.symbol_name, p.qty, p.avg_cost FROM positions p JOIN trade_accounts t ON t.id = p.account_id
       WHERE t.user_id = ${userId} AND p.qty > 0 AND t.id IN (${inClause(acctIds)})`
    )
    .all<PosRow>();
  const positions = posRes.results ?? [];
  const names = new Map<string, string>();
  for (const p of positions) {
    names.set(p.symbol, p.symbol_name);
  }
  const now = Date.now();
  const need: StockSymbol[] = [];
  const out = new Map<string, { price: number; name: string }>();
  for (const p of positions) {
    const c = quoteCache.get(p.symbol);
    if (c && now - c.ts < QUOTE_TTL_MS) {
      out.set(p.symbol, { price: c.price, name: c.name });
    } else {
      need.push(p.symbol as StockSymbol);
    }
  }
  const uniq = [...new Set(need)];
  if (uniq.length > 0) {
    try {
      const quotes = await marketData.fetchQuotes(uniq);
      for (const q of quotes) {
        quoteCache.set(q.symbol, { ts: now, price: q.price, name: q.name || names.get(q.symbol) || q.symbol });
        out.set(q.symbol, { price: q.price, name: quoteCache.get(q.symbol)!.name });
      }
    } catch {
      // 全部失败 → 用缓存旧值/avg_cost 兜底，不阻塞报表
    }
  }
  for (const p of positions) {
    if (!out.has(p.symbol)) {
      out.set(p.symbol, { price: fallbacks.get(p.symbol) ?? p.avg_cost, name: names.get(p.symbol) ?? p.symbol });
    }
  }
  return out;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

export async function buildReport(db: D1Database, userId: number, rangeParam: string | null, acctParam: string | null): Promise<BiReport> {
  const range: BiRange = parseRange(rangeParam);
  const today = beijingDateKey();
  const bounds = rangeBounds(range, today);

  // 1) 账户范围（越权 → 2003）
  const allAccounts = await db
    .prepare("SELECT id, name, cash_available, frozen_cash FROM trade_accounts WHERE user_id = ?1 AND status = 'active' ORDER BY id")
    .bind(userId)
    .all<AcctRow>();
  const accounts = allAccounts.results ?? [];
  if (accounts.length === 0) {
    return emptyReport(range, acctParam ?? 'all');
  }
  let acctIds: number[];
  let acctOut: BiAcct = 'all';
  if (acctParam && acctParam !== 'all') {
    const id = parseInt(acctParam, 10);
    const one = accounts.find((a) => a.id === id);
    if (!one || Number.isNaN(id)) {
      throw new ApiError(CODE.NOT_OWNER, '账户不存在或无权限');
    }
    acctIds = [id];
    acctOut = acctParam;
  } else {
    acctIds = accounts.map((a) => a.id);
  }

  // 2) 快照序列
  const loadSnaps = (): Promise<SnapRow[]> =>
    db
      .prepare(
        `SELECT account_id, date, total_assets, day_pnl FROM daily_snapshots
         WHERE user_id = ${userId} AND account_id IN (${inClause(acctIds)}) AND date >= ?1 AND date <= ?2 ORDER BY date ASC`
      )
      .bind(bounds.startKey, bounds.endKey)
      .all<SnapRow>()
      .then((r) => r.results ?? []);

  let snaps = await loadSnaps();

  // 3) 缺口懒回放（今日由心跳负责，不补）
  const firstTrade = await db
    .prepare(`SELECT MIN(traded_at) AS m FROM trades WHERE user_id = ${userId} AND account_id IN (${inClause(acctIds)})`)
    .first<{ m: string | null }>();
  const firstDay = firstTrade?.m ? beijingDateKey(Date.parse(firstTrade.m)) : null;
  const haveDates = new Set(snaps.map((s) => s.date));
  let replayDays: string[];
  if (range === 'all') {
    replayDays = firstDay ? tradingDaysInRange(firstDay, today) : [];
  } else {
    replayDays = tradingDaysInRange(bounds.startKey, bounds.endKey);
  }
  const needDays = replayDays.filter((d) => d < today && (!firstDay || d >= firstDay) && !haveDates.has(d));
  let replay = { triggered: false, filledDays: 0, complete: true };
  if (needDays.length > 0) {
    replay = await replayGaps(db, userId, acctIds, needDays);
    if (replay.triggered) {
      snaps = await loadSnaps();
    }
  }

  // 4) 合并序列（acct=all 跨账户按日加总）
  const merged = new Map<string, { total: number; pnl: number }>();
  for (const s of snaps) {
    const cur = merged.get(s.date) ?? { total: 0, pnl: 0 };
    cur.total += s.total_assets;
    cur.pnl += s.day_pnl;
    merged.set(s.date, cur);
  }
  const dates = [...merged.keys()].sort();
  const navSeries: BiNavPoint[] = dates.map((d, i) => {
    const total = merged.get(d)!.total;
    const base = dates.length > 0 ? merged.get(dates[0])!.total : total;
    return { date: d, totalAssets: total, nav: base > 0 ? round2((total / base) * 10000) / 10000 : 1 };
  });
  const dailyPnlSeries: BiDailyPnlPoint[] = dates.map((d) => ({ date: d, pnl: merged.get(d)!.pnl }));

  // 5) 实时资产与持仓（现价）
  const fallbacks = new Map<string, number>();
  for (const s of snaps) {
    void s;
  }
  const priceMap = await fetchPriceMap(db, userId, acctIds, fallbacks);
  const posRes = await db
    .prepare(
      `SELECT p.account_id, p.symbol, p.symbol_name, p.qty, p.avg_cost FROM positions p JOIN trade_accounts t ON t.id = p.account_id
       WHERE t.user_id = ${userId} AND p.qty > 0 AND t.id IN (${inClause(acctIds)})`
    )
    .all<PosRow>();
  const positions = posRes.results ?? [];
  const scopedAccounts = accounts.filter((a) => acctIds.includes(a.id));
  const totalCash = scopedAccounts.reduce((s, a) => s + a.cash_available + a.frozen_cash, 0);
  let totalMv = 0;
  const posRows: BiPositionRow[] = [];
  for (const p of positions) {
    const px = priceMap.get(p.symbol)?.price ?? p.avg_cost;
    const mv = p.qty * px;
    totalMv += mv;
    const pnl = (px - p.avg_cost) * p.qty;
    posRows.push({
      symbol: p.symbol,
      name: priceMap.get(p.symbol)?.name || p.symbol_name,
      qty: p.qty,
      avgCost: p.avg_cost,
      price: px,
      marketValue: mv,
      pnl,
      pnlPct: p.avg_cost > 0 ? round2((pnl / (p.avg_cost * p.qty)) * 10000) / 100 : 0,
      weightPct: 0,
    });
  }
  posRows.sort((a, b) => b.marketValue - a.marketValue);
  const totalAssets = totalCash + totalMv;
  for (const r of posRows) {
    r.weightPct = totalAssets > 0 ? round2((r.marketValue / totalAssets) * 10000) / 100 : 0;
  }

  // 6) 区间已实现盈亏（全历史推进，仅统计区间内卖出）
  const tradesRes = await db
    .prepare(
      `SELECT symbol, symbol_name, side, price, quantity, fee_commission, fee_stamp, fee_transfer, net_amount, traded_at
       FROM trades WHERE user_id = ${userId} AND account_id IN (${inClause(acctIds)}) ORDER BY traded_at ASC`
    )
    .all<TradeRow>();
  const allTrades = tradesRes.results ?? [];
  const sinceIso =
    range === 'all' ? undefined : new Date(Date.parse(bounds.startKey + 'T00:00:00+08:00')).toISOString();
  const endIso = new Date(Date.parse(today + 'T23:59:59+08:00')).toISOString();
  const histTrades = allTrades.filter((t) => t.traded_at <= endIso);
  const walk = walkTrades(histTrades, { realizedSince: sinceIso });

  // 7) 个股盈亏归因（区间已实现 + 当前浮动）
  const contribMap = new Map<string, { name: string; pnl: number }>();
  for (const [s, v] of walk.realizedBySymbol) {
    contribMap.set(s, { name: walk.finalName.get(s) ?? s, pnl: v });
  }
  for (const p of positions) {
    const px = priceMap.get(p.symbol)?.price ?? p.avg_cost;
    const unreal = (px - p.avg_cost) * p.qty;
    const cur = contribMap.get(p.symbol) ?? { name: p.symbol_name, pnl: 0 };
    cur.pnl += unreal;
    contribMap.set(p.symbol, cur);
  }
  const contribs = [...contribMap.entries()]
    .map(([symbol, v]) => ({ symbol, name: v.name, pnl: v.pnl }))
    .sort((a, b) => b.pnl - a.pnl);
  const denomAbs = contribs.reduce((s, c) => s + Math.abs(c.pnl), 0);
  const pctOf = (v: number): number => (denomAbs > 0 ? round2((Math.abs(v) / denomAbs) * 10000) / 100 : 0);
  const top: BiContributionItem[] = contribs.slice(0, 5).map((c) => ({ ...c, pct: pctOf(c.pnl) }));
  const bottoms = contribs.slice(-5).filter((c) => c.pnl < 0).map((c) => ({ ...c, pct: pctOf(c.pnl) }));
  const topContribution: BiContributionItem[] = [...top, ...bottoms.sort((a, b) => a.pnl - b.pnl)];
  const positive = contribs.filter((c) => c.pnl > 0);
  const posSum = positive.reduce((s, c) => s + c.pnl, 0);
  const pnlRatio: BiContributionItem[] = positive
    .slice(0, 8)
    .map((c) => ({ ...c, pct: posSum > 0 ? round2((c.pnl / posSum) * 10000) / 100 : 0 }));

  // 8) 资产构成与集中度
  const allocation: BiAllocationSlice[] = [
    ...posRows.slice(0, 8).map((r) => ({ name: r.name, value: r.marketValue, pct: r.weightPct })),
    ...(totalCash > 0 ? [{ name: '现金', value: totalCash, pct: totalAssets > 0 ? round2((totalCash / totalAssets) * 10000) / 100 : 0 }] : []),
  ];
  const weights = posRows.map((r) => r.weightPct);
  const concentration = {
    top1Pct: weights.length > 0 ? weights[0] : 0,
    top5Pct: round2(weights.slice(0, 5).reduce((s, w) => s + w, 0)),
  };

  // 9) KPI
  const lastPoint = navSeries[navSeries.length - 1];
  const firstPoint = navSeries[0];
  const rangePnl = lastPoint && firstPoint ? lastPoint.totalAssets - firstPoint.totalAssets : 0;
  const rangeReturnPct = lastPoint && firstPoint && firstPoint.totalAssets > 0
    ? round2(((lastPoint.totalAssets / firstPoint.totalAssets - 1) * 10000) / 100)
    : 0;
  let maxDrawdownPct = 0;
  let maxDrawdownDate: string | null = null;
  let peak = 0;
  for (const p of navSeries) {
    if (p.totalAssets > peak) {
      peak = p.totalAssets;
    }
    if (peak > 0) {
      const dd = 1 - p.totalAssets / peak;
      if (dd > maxDrawdownPct) {
        maxDrawdownPct = dd;
        maxDrawdownDate = p.date;
      }
    }
  }
  const kpi: BiKpi = {
    totalAssets,
    rangeReturnPct,
    rangePnl,
    dayPnl: dailyPnlSeries.length > 0 ? dailyPnlSeries[dailyPnlSeries.length - 1].pnl : 0,
    realizedPnl: walk.realizedTotal,
    unrealizedPnl: posRows.reduce((s, r) => s + r.pnl, 0),
    maxDrawdownPct: round2(maxDrawdownPct * 10000) / 100,
    maxDrawdownDate,
  };

  return {
    range,
    acct: acctOut,
    accounts: scopedAccounts.map((a) => ({ id: a.id, name: a.name })),
    kpi,
    navSeries,
    dailyPnlSeries,
    positions: posRows,
    allocation,
    concentration,
    topContribution,
    pnlRatio,
    replay,
  };
}

function emptyReport(range: BiRange, acct: BiAcct): BiReport {
  return {
    range,
    acct,
    accounts: [],
    kpi: { totalAssets: 0, rangeReturnPct: 0, rangePnl: 0, dayPnl: 0, realizedPnl: 0, unrealizedPnl: 0, maxDrawdownPct: 0, maxDrawdownDate: null },
    navSeries: [],
    dailyPnlSeries: [],
    positions: [],
    allocation: [],
    concentration: { top1Pct: 0, top5Pct: 0 },
    topContribution: [],
    pnlRatio: [],
    replay: { triggered: false, filledDays: 0, complete: true },
  };
}

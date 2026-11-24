import { handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { listPositions, requireOwnedAccount } from '../../../lib/account-service';
import { beijingDateKey, beijingToTs } from '../../../../shared/trading-calendar';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

/** 今日买入量行（symbol → 今日累计买入股数） */
interface TodayBuyRow {
  symbol: string;
  buy_qty: number;
}

/** GET /api/accounts/:id/positions — 持仓列表（不含实时价，前端合并快照；附今日买入量供当日盈亏成本口径） */
export const onRequestGet = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    const positions = await listPositions(ctx.env.DB, acc.id);
    // 今日（北京 00:00 起）买入量：当日盈亏需对今日买入部分用买入成本而非昨收
    // ⚠️ trades.traded_at 是 TEXT 列（ISO UTC 字符串）：绑定参数必须是同构的 ISO 字符串，
    // 若绑定数字毫秒时间戳，SQLite TEXT 亲和会转成数字字符串做字典序比较导致条件恒真（返回全历史买入量）。
    const todayStartIso = new Date(beijingToTs(beijingDateKey(), '00:00')).toISOString(); // '2026-11-24T00:00+08:00' → '2026-11-23T16:00:00.000Z'
    const buyRows =
      (
        await ctx.env.DB.prepare(
          "SELECT symbol, SUM(quantity) AS buy_qty FROM trades WHERE account_id = ?1 AND side = 'buy' AND traded_at >= ?2 GROUP BY symbol",
        )
          .bind(acc.id, todayStartIso)
          .all<TodayBuyRow>()
      ).results ?? [];
    const buyQtyBySymbol = new Map<string, number>(buyRows.map((r) => [r.symbol, r.buy_qty]));
    return ok({
      positions: positions.map((p) => ({
        symbol: p.symbol,
        symbolName: p.symbol_name,
        qty: p.qty,
        availableQty: p.available_qty,
        frozenQty: p.frozen_qty,
        avgCost: p.avg_cost,
        todayBuyQty: buyQtyBySymbol.get(p.symbol) ?? 0,
        lastPrice: 0,
        marketValue: 0,
        pnl: 0,
        pnlPct: 0,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
};

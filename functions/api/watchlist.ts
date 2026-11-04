import { ApiError, CODE, handleError, ok } from '../lib/response';
import { requireAuth } from '../lib/auth';
import type { PagesContext } from '../lib/env';

const MAX_WATCHLIST = 50;

interface WatchRow {
  symbol: string;
  name: string;
  created_at: string;
}

/** GET /api/watchlist — 当前用户自选列表（按添加时间倒序） */
export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const { results } = await ctx.env.DB
      .prepare('SELECT symbol, name, created_at FROM watchlist WHERE user_id = ?1 ORDER BY id DESC LIMIT 100')
      .bind(auth.userId)
      .all<WatchRow>();
    const items = (results ?? []).map((r) => ({ symbol: r.symbol, name: r.name }));
    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
};

/** POST /api/watchlist — 添加自选 { symbol, name } */
export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const body = (await ctx.request.json().catch(() => null)) as { symbol?: string; name?: string } | null;
    const symbol = (body?.symbol ?? '').toLowerCase();
    const name = (body?.name ?? '').slice(0, 30);
    if (!/^(sh|sz)\d{6}$/.test(symbol)) {
      throw new ApiError(CODE.BAD_PARAM, 'symbol 格式不正确');
    }
    const count = await ctx.env.DB.prepare('SELECT COUNT(*) AS n FROM watchlist WHERE user_id = ?1')
      .bind(auth.userId)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_WATCHLIST) {
      throw new ApiError(CODE.BAD_PARAM, `自选股最多 ${MAX_WATCHLIST} 只`);
    }
    const now = new Date().toISOString();
    await ctx.env.DB
      .prepare('INSERT INTO watchlist (user_id, symbol, name, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (user_id, symbol) DO NOTHING')
      .bind(auth.userId, symbol, name, now)
      .run();
    return ok({ added: true });
  } catch (err) {
    return handleError(err);
  }
};

/** DELETE /api/watchlist?symbol= — 移出自选 */
export const onRequestDelete = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const url = new URL(ctx.request.url);
    const symbol = (url.searchParams.get('symbol') ?? '').toLowerCase();
    if (!/^(sh|sz)\d{6}$/.test(symbol)) {
      throw new ApiError(CODE.BAD_PARAM, 'symbol 格式不正确');
    }
    await ctx.env.DB.prepare('DELETE FROM watchlist WHERE user_id = ?1 AND symbol = ?2')
      .bind(auth.userId, symbol)
      .run();
    return ok({ removed: true });
  } catch (err) {
    return handleError(err);
  }
};

import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import { marketData } from '../../lib/market-data';
import { checkSymbol } from '../../../shared/validate';
import type { PagesContext } from '../../lib/env';

/** GET /api/market/quote?codes=sh600519,sz000001 — 实时行情代理（≤30 个，腾讯主/新浪备/降级 1501） */
export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    await requireAuth(ctx);
    const url = new URL(ctx.request.url);
    const raw = url.searchParams.get('codes') ?? '';
    const codes = raw
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c.length > 0);
    if (codes.length === 0) {
      throw new ApiError(CODE.BAD_PARAM, 'codes 不能为空');
    }
    if (codes.length > 30) {
      throw new ApiError(CODE.BAD_PARAM, '单次最多查询 30 个标的');
    }
    for (const c of codes) {
      if (!checkSymbol(c).ok) {
        throw new ApiError(CODE.BAD_PARAM, `代码格式不正确：${c}`);
      }
    }
    let quotes;
    try {
      quotes = await marketData.fetchQuotes(codes);
    } catch (e) {
      console.error('[market/quote] upstream down:', (e as Error).message);
      throw new ApiError(CODE.MARKET_UPSTREAM_DOWN, '行情暂时不可用，请稍后重试');
    }
    return ok({ quotes });
  } catch (err) {
    return handleError(err);
  }
};

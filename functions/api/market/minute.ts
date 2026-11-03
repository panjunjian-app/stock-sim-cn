import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import { marketData } from '../../lib/market-data';
import { checkSymbol } from '../../../shared/validate';
import type { PagesContext } from '../../lib/env';

/** GET /api/market/minute?symbol= — 分时数据代理（失败降级空数据） */
export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    await requireAuth(ctx);
    const url = new URL(ctx.request.url);
    const symbol = (url.searchParams.get('symbol') ?? '').toLowerCase();
    if (!checkSymbol(symbol).ok) {
      throw new ApiError(CODE.BAD_PARAM, 'symbol 格式不正确');
    }
    try {
      const series = await marketData.fetchMinute(symbol);
      return ok({ points: series.points, prevClose: series.prevClose });
    } catch (e) {
      console.error('[market/minute] upstream down:', (e as Error).message);
      return ok({ points: [], prevClose: 0, degraded: true }, '分时数据暂时不可用');
    }
  } catch (err) {
    return handleError(err);
  }
};

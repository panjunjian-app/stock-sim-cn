import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import { marketData } from '../../lib/market-data';
import { checkSymbol } from '../../../shared/validate';
import type { KLinePeriod } from '../../../shared/types';
import type { PagesContext } from '../../lib/env';

/** GET /api/market/kline?symbol=&period=day|week|month&count= — K 线代理（失败返回空数组 + 提示） */
export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    await requireAuth(ctx);
    const url = new URL(ctx.request.url);
    const symbol = (url.searchParams.get('symbol') ?? '').toLowerCase();
    const period = (url.searchParams.get('period') ?? 'day') as KLinePeriod;
    const count = Number(url.searchParams.get('count') ?? '250') || 250;
    if (!checkSymbol(symbol).ok) {
      throw new ApiError(CODE.BAD_PARAM, 'symbol 格式不正确');
    }
    if (period !== 'day' && period !== 'week' && period !== 'month') {
      throw new ApiError(CODE.BAD_PARAM, 'period 必须为 day/week/month');
    }
    try {
      const klines = await marketData.fetchKline({ symbol, period, count });
      return ok({ klines });
    } catch (e) {
      console.error('[market/kline] upstream down:', (e as Error).message);
      // 降级：返回空数组 + 提示，前端保底显示
      return ok({ klines: [], degraded: true }, 'K线数据暂时不可用');
    }
  } catch (err) {
    return handleError(err);
  }
};

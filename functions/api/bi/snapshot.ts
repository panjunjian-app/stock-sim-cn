/**
 * POST /api/bi/snapshot — 当日资产快照（幂等，前端 60s 心跳调用）
 * 非交易日/无账户直接空返回；行情上游失败转 1501（前端静默）。
 */
import { ApiError, CODE, fail, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import type { PagesContext } from '../../lib/env';
import { takeSnapshot } from '../../lib/bi/snapshot';

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const result = await takeSnapshot(ctx.env.DB, auth.userId);
    return ok(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return handleError(err);
    }
    // 行情上游失败等运行时异常 → 行情降级码，前端心跳静默忽略
    console.error('[bi/snapshot]', err instanceof Error ? err.message : err);
    return fail(CODE.MARKET_UPSTREAM_DOWN, '行情上游暂不可用，快照稍后重试');
  }
};

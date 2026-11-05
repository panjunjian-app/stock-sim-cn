/**
 * GET /api/bi/report?range=7d&acct=all — BI 聚合报表（单端点）
 * range 非法宽容回退 7d；acct 越权 2003；缺口快照懒回放（封顶 120 交易日/次）。
 */
import { handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import type { PagesContext } from '../../lib/env';
import { buildReport } from '../../lib/bi/aggregate';

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const url = new URL(ctx.request.url);
    const range = url.searchParams.get('range');
    const acct = url.searchParams.get('acct');
    const report = await buildReport(ctx.env.DB, auth.userId, range, acct);
    return ok(report);
  } catch (err) {
    return handleError(err);
  }
};

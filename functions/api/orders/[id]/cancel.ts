import { ApiError, CODE, handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { requireOwnedAccount } from '../../../lib/account-service';
import { cancelOrder, createD1Repo, MatchError } from '../../../lib/matching';
import { toOrderDto } from '../../accounts/[id]/orders';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

/** POST /api/orders/:id/cancel — 撤单（退回冻结资金/持仓） */
export const onRequestPost = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const repo = createD1Repo(ctx.env.DB);
    const order = await repo.getOrder(Number(ctx.params.id));
    if (!order) {
      throw new ApiError(CODE.BAD_PARAM, '委托不存在');
    }
    // 属主校验（委托 → 账户）
    await requireOwnedAccount(ctx.env.DB, auth.userId, order.account_id);
    try {
      const cancelled = await cancelOrder(repo, order.id);
      return ok({ order: toOrderDto(cancelled) });
    } catch (e) {
      if (e instanceof MatchError) {
        throw new ApiError(e.code, e.message);
      }
      throw e;
    }
  } catch (err) {
    return handleError(err);
  }
};

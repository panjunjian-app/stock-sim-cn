import { ApiError, CODE, handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { requireOwnedAccount, deposit } from '../../../lib/account-service';
import { guardContestAccount } from '../../../lib/contest';
import { toCents } from '../../../../shared/money';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

interface Body {
  /** 入金金额（分）；兼容元字符串 */
  amount?: number | string;
}

/** POST /api/accounts/:id/deposit — 模拟入金 */
export const onRequestPost = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    guardContestAccount(acc); // 比赛账户资金锁定，禁止入金
    const body = (await ctx.request.json().catch(() => ({}))) as Body;
    const amount = typeof body.amount === 'string' ? toCents(body.amount) : (body.amount ?? 0);
    if (typeof body.amount === 'string' && Number.isNaN(amount)) {
      throw new ApiError(CODE.BAD_PARAM, '入金金额格式不正确');
    }
    const cashFlow = await deposit(ctx.env.DB, acc.id, amount);
    return ok({
      cashFlow: {
        id: cashFlow.id,
        type: cashFlow.type,
        amount: cashFlow.amount,
        balanceAfter: cashFlow.balance_after,
        refId: cashFlow.ref_id,
        remark: cashFlow.remark,
        createdAt: cashFlow.created_at,
      },
    });
  } catch (err) {
    return handleError(err);
  }
};

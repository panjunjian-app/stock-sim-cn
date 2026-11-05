import { handleError, ok, ApiError, CODE } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { requireOwnedAccount, softDeleteAccount } from '../../../lib/account-service';
import { totalDeposit } from '../../../lib/account-service';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

/** GET /api/accounts/:id — 账户详情（含累计入金） */
export const onRequestGet = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    const deposit = await totalDeposit(ctx.env.DB, acc.id);
    return ok({
      account: {
        id: acc.id,
        name: acc.name,
        cashAvailable: acc.cash_available,
        frozenCash: acc.frozen_cash,
        initCash: acc.init_cash,
        createdAt: acc.created_at,
        totalDeposit: deposit,
      },
    });
  } catch (err) {
    return handleError(err);
  }
};

/** DELETE /api/accounts/:id — 删除（软删，虚拟资金不可恢复）
 *  比赛账户：赛期（pending/active）不可删除；比赛已结束/取消（历史记录）后可删除 */
export const onRequestDelete = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    if (acc.contest_id !== null && acc.contest_id !== undefined) {
      const c = await ctx.env.DB
        .prepare('SELECT status FROM contests WHERE id = ?1')
        .bind(acc.contest_id)
        .first<{ status: string }>();
      if (c && (c.status === 'pending' || c.status === 'active')) {
        throw new ApiError(CODE.BAD_PARAM, '比赛进行中，比赛账户不可删除（结束后转入历史记录即可删除）');
      }
    }
    await softDeleteAccount(ctx.env.DB, acc.id);
    return ok({});
  } catch (err) {
    return handleError(err);
  }
};

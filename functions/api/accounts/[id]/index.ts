import { handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { requireOwnedAccount, softDeleteAccount } from '../../../lib/account-service';
import { totalDeposit } from '../../../lib/account-service';
import { guardContestAccount } from '../../../lib/contest';
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

/** DELETE /api/accounts/:id — 删除（软删，虚拟资金不可恢复） */
export const onRequestDelete = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    guardContestAccount(acc); // 比赛账户不可删除
    await softDeleteAccount(ctx.env.DB, acc.id);
    return ok({});
  } catch (err) {
    return handleError(err);
  }
};

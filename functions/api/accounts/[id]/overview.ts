import { handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { requireOwnedAccount, totalDeposit } from '../../../lib/account-service';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

/**
 * GET /api/accounts/:id/overview — 资产总览基础值
 * 市值/总资产/当日盈亏/累计盈亏由前端合并行情快照计算（见 src/utils/overview.ts）。
 */
export const onRequestGet = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    const deposit = await totalDeposit(ctx.env.DB, acc.id);
    return ok({
      overview: {
        accountId: acc.id,
        name: acc.name,
        cashAvailable: acc.cash_available,
        frozenCash: acc.frozen_cash,
        totalDeposit: deposit,
      },
    });
  } catch (err) {
    return handleError(err);
  }
};

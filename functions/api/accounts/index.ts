import { handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import { listAccounts, openAccount } from '../../lib/account-service';
import { toCents } from '../../../shared/money';
import type { PagesContext } from '../../lib/env';

interface CreateBody {
  name?: string;
  /** 初始资金（分）；兼容传元字符串，服务端统一换算 */
  initCash?: number | string;
}

/** GET /api/accounts — 账户列表（含持仓统计与累计入金） */
export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const accounts = await listAccounts(ctx.env.DB, auth.userId);
    return ok({
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        cashAvailable: a.cash_available,
        frozenCash: a.frozen_cash,
        initCash: a.init_cash,
        createdAt: a.created_at,
        contestId: a.contest_id,
        contestName: a.contest_name,
        contestStatus: a.contest_status,
        positionsCount: a.positions_count,
        totalDeposit: a.total_deposit,
        positionSymbols: a.position_symbols,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
};

/** POST /api/accounts — 开户 */
export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const body = (await ctx.request.json().catch(() => ({}))) as CreateBody;
    const initCash = typeof body.initCash === 'string' ? toCents(body.initCash) : (body.initCash ?? 0);
    const account = await openAccount(ctx.env.DB, auth.userId, body.name ?? '', initCash);
    return ok({
      account: {
        id: account.id,
        name: account.name,
        cashAvailable: account.cash_available,
        frozenCash: account.frozen_cash,
        initCash: account.init_cash,
        createdAt: account.created_at,
      },
    });
  } catch (err) {
    return handleError(err);
  }
};

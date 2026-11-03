import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import { requireOwnedAccount } from '../../lib/account-service';
import { createD1Repo, MatchError, runTick } from '../../lib/matching';
import { marketData } from '../../lib/market-data';
import type { PagesContext } from '../../lib/env';

interface Body {
  accountId?: number;
}

/** POST /api/market/tick — 撮合重试（客户端 5s 轮询驱动；幂等） */
export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const body = (await ctx.request.json().catch(() => ({}))) as Body;
    const accountId = body.accountId;
    if (!Number.isInteger(accountId) || (accountId as number) <= 0) {
      throw new ApiError(CODE.BAD_PARAM, 'accountId 不合法');
    }
    await requireOwnedAccount(ctx.env.DB, auth.userId, accountId as number);
    const repo = createD1Repo(ctx.env.DB);
    try {
      const matchedCount = await runTick(repo, marketData, accountId as number);
      return ok({ matchedCount });
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

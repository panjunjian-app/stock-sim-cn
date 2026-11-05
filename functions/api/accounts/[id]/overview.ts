import { handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { requireOwnedAccount, totalDeposit } from '../../../lib/account-service';
import { beijingDateKey } from '../../../../shared/trading-calendar';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

/**
 * GET /api/accounts/:id/overview — 资产总览基础值
 * 市值/总资产/累计盈亏由前端合并行情快照计算（见 src/utils/overview.ts）；
 * prevSettledTotal = 昨日收市总资产基准（早于今天的最近收市快照），当日盈亏由前端据此计算，开赛/开户首日为 null → 当日盈亏=累计盈亏。
 */
export const onRequestGet = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    const deposit = await totalDeposit(ctx.env.DB, acc.id);
    const prev = await ctx.env.DB
      .prepare('SELECT total_assets FROM daily_snapshots WHERE account_id = ?1 AND date < ?2 ORDER BY date DESC LIMIT 1')
      .bind(acc.id, beijingDateKey())
      .first<{ total_assets: number }>();
    return ok({
      overview: {
        accountId: acc.id,
        name: acc.name,
        cashAvailable: acc.cash_available,
        frozenCash: acc.frozen_cash,
        totalDeposit: deposit,
        prevSettledTotal: prev?.total_assets ?? null,
      },
    });
  } catch (err) {
    return handleError(err);
  }
};

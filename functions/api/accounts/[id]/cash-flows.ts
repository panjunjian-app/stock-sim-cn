import { handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { requireOwnedAccount } from '../../../lib/account-service';
import type { CashFlowRow } from '../../../lib/account-service';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

/** GET /api/accounts/:id/cash-flows?page=&pageSize= — 资金流水（分页） */
export const onRequestGet = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    const url = new URL(ctx.request.url);
    const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '20') || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const total = (await ctx.env.DB.prepare('SELECT COUNT(*) AS c FROM cash_flows WHERE account_id = ?1').bind(acc.id).first<{ c: number }>())?.c ?? 0;
    const rows = (
      await ctx.env.DB
        .prepare('SELECT * FROM cash_flows WHERE account_id = ?1 ORDER BY id DESC LIMIT ?2 OFFSET ?3')
        .bind(acc.id, pageSize, offset)
        .all<CashFlowRow>()
    ).results ?? [];

    return ok({
      cashFlows: rows.map((f) => ({
        id: f.id,
        type: f.type,
        amount: f.amount,
        balanceAfter: f.balance_after,
        refId: f.ref_id,
        remark: f.remark,
        createdAt: f.created_at,
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    return handleError(err);
  }
};

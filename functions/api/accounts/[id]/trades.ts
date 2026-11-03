import { handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { requireOwnedAccount } from '../../../lib/account-service';
import { toOrderDto } from './orders';
import type { TradeRow } from '../../../lib/matching';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

/** GET /api/accounts/:id/trades?page=&pageSize= — 成交记录（分页） */
export const onRequestGet = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    const url = new URL(ctx.request.url);
    const page = Math.max(Number(url.searchParams.get('page') ?? '1') || 1, 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') ?? '20') || 20, 1), 100);
    const offset = (page - 1) * pageSize;

    const total = (await ctx.env.DB.prepare('SELECT COUNT(*) AS c FROM trades WHERE account_id = ?1').bind(acc.id).first<{ c: number }>())?.c ?? 0;
    const rows = (
      await ctx.env.DB
        .prepare('SELECT * FROM trades WHERE account_id = ?1 ORDER BY id DESC LIMIT ?2 OFFSET ?3')
        .bind(acc.id, pageSize, offset)
        .all<TradeRow>()
    ).results ?? [];

    return ok({
      trades: rows.map((t) => ({
        id: t.id,
        orderId: t.order_id,
        symbol: t.symbol,
        symbolName: t.symbol_name,
        side: t.side,
        price: t.price,
        quantity: t.quantity,
        amount: t.amount,
        feeCommission: t.fee_commission,
        feeStamp: t.fee_stamp,
        feeTransfer: t.fee_transfer,
        netAmount: t.net_amount,
        tradedAt: t.traded_at,
      })),
      total,
      page,
      pageSize,
    });
  } catch (err) {
    return handleError(err);
  }
};

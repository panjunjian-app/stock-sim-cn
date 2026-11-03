import { ApiError, CODE, handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { requireOwnedAccount } from '../../../lib/account-service';
import { createD1Repo, submitOrder, MatchError } from '../../../lib/matching';
import { marketData } from '../../../lib/market-data';
import { checkOrderInput } from '../../../../shared/validate';
import type { Order } from '../../../../shared/types';
import type { OrderRow } from '../../../lib/matching';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

interface Body {
  symbol?: string;
  side?: 'buy' | 'sell';
  orderType?: 'limit' | 'market';
  price?: number | null;
  quantity?: number;
}

export function toOrderDto(o: OrderRow): Order {
  return {
    id: o.id,
    accountId: o.account_id,
    symbol: o.symbol,
    symbolName: o.symbol_name,
    side: o.side,
    orderType: o.order_type,
    price: o.price,
    quantity: o.quantity,
    frozenCash: o.frozen_cash,
    filledQty: o.filled_qty,
    avgPrice: o.avg_price,
    status: o.status,
    rejectReason: o.reject_reason,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

/** GET /api/accounts/:id/orders?status= — 委托列表 */
export const onRequestGet = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    const url = new URL(ctx.request.url);
    const status = url.searchParams.get('status');
    const allowed = ['pending', 'partial', 'filled', 'cancelled', 'rejected'];
    let sql = 'SELECT * FROM orders WHERE account_id = ?1';
    if (status && allowed.includes(status)) {
      sql += ` AND status = '${status}'`;
    }
    sql += ' ORDER BY id DESC LIMIT 200';
    const rows = (await ctx.env.DB.prepare(sql).bind(acc.id).all<OrderRow>()).results ?? [];
    return ok({ orders: rows.map(toOrderDto) });
  } catch (err) {
    return handleError(err);
  }
};

/** POST /api/accounts/:id/orders — 下单（校验 → 冻结 → 落库 → 即刻撮合） */
export const onRequestPost = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    const body = (await ctx.request.json().catch(() => ({}))) as Body;
    const input = {
      symbol: body.symbol ?? '',
      side: body.side,
      orderType: body.orderType,
      price: body.orderType === 'limit' ? body.price : null,
      quantity: body.quantity ?? 0,
    };
    const check = checkOrderInput(input);
    if (!check.ok) {
      throw new ApiError(CODE.BAD_PARAM, check.reason ?? '委托参数不合法');
    }
    const repo = createD1Repo(ctx.env.DB);
    try {
      const result = await submitOrder(repo, marketData, {
        accountId: acc.id,
        userId: auth.userId,
        symbol: input.symbol,
        side: input.side as 'buy' | 'sell',
        orderType: input.orderType as 'limit' | 'market',
        price: input.price ?? null,
        quantity: input.quantity ?? 0,
      });
      return ok({
        order: toOrderDto(result.order),
        matched: result.matched,
        ...(result.trade ? { trade: { ...result.trade } } : {}),
      });
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

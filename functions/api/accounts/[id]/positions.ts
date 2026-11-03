import { handleError, ok } from '../../../lib/response';
import { requireAuth } from '../../../lib/auth';
import { listPositions, requireOwnedAccount } from '../../../lib/account-service';
import type { PagesContext } from '../../../lib/env';

interface Params {
  id: string;
}

/** GET /api/accounts/:id/positions — 持仓列表（不含实时价，前端合并快照） */
export const onRequestGet = async (ctx: PagesContext<Params>): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const acc = await requireOwnedAccount(ctx.env.DB, auth.userId, Number(ctx.params.id));
    const positions = await listPositions(ctx.env.DB, acc.id);
    return ok({
      positions: positions.map((p) => ({
        symbol: p.symbol,
        symbolName: p.symbol_name,
        qty: p.qty,
        availableQty: p.available_qty,
        frozenQty: p.frozen_qty,
        avgCost: p.avg_cost,
        lastPrice: 0,
        marketValue: 0,
        pnl: 0,
        pnlPct: 0,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
};

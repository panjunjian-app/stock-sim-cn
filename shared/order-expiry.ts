/**
 * shared/order-expiry.ts — 「委托当日有效」自动失效的前后端共享约定
 *
 * 业务规则（对齐 A 股）：委托仅在**下达当日**有效，收盘仍未成交即自动失效，
 * 失效时必须释放冻结的股数 / 资金，否则跨日挂单会永久冻结持仓（用户无法卖出且毫不知情）。
 *
 * 为何不新增 `expired` 状态：
 *   orders.status 在 migrations/0001_init.sql 带 CHECK 约束
 *   （CHECK (status IN ('pending','partial','filled','cancelled','rejected'))），
 *   SQLite 无法在不重建表的前提下扩展 CHECK 取值；重建生产表风险远大于收益，
 *   因此复用 `cancelled` 表示终态，并在 reject_reason 写入本文件约定的标记文案，
 *   由 `isOrderExpired()` 区分「系统自动失效」与「用户主动撤单」，供 UI 展示不同文案。
 */

/** 自动失效委托写入 reject_reason 的标记文案（前后端共用，勿随意改动：存量数据依赖它） */
export const ORDER_EXPIRED_REASON = '当日有效委托未成交，收盘后系统自动失效';

/** 订单状态 + 废单/失效原因（结构性最小集，避免 shared 层依赖完整 DTO） */
export interface OrderExpiryLike {
  status: string;
  rejectReason?: string | null;
}

/**
 * 是否为「系统自动失效」的委托（而非用户主动撤单）。
 * 判定：终态 cancelled 且 reject_reason 带本文件约定的标记文案。
 */
export function isOrderExpired(order: OrderExpiryLike): boolean {
  return order.status === 'cancelled' && (order.rejectReason ?? '').includes(ORDER_EXPIRED_REASON);
}

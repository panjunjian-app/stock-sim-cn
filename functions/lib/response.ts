/**
 * response.ts — 统一响应信封 {code, data, message} 与业务错误码
 * 所有端点响应必须经过本模块。
 */

/** 统一响应 */
export function ok<T>(data: T, message = 'ok', status = 200): Response {
  return new Response(JSON.stringify({ code: 0, data, message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** 错误响应（默认根据错误码段推断 HTTP 状态） */
export function fail(code: number, message: string, status?: number): Response {
  const httpStatus = status ?? defaultHttpStatus(code);
  return new Response(JSON.stringify({ code, data: null, message }), {
    status: httpStatus,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function defaultHttpStatus(code: number): number {
  if (code === 0) return 200;
  if (code >= 1500 && code < 1600) return 502; // 行情上游降级（须先于 10xx 判断）
  if (code >= 1000 && code < 2000) return code === 1001 || code === 1002 ? 401 : 400;
  if (code >= 2000 && code < 3000) return code === 2003 ? 403 : 400;
  if (code >= 3000 && code < 4000) return 400;
  return 400; // 40xx 参数错误
}

/** 业务错误码表（§9 共享知识） */
export const CODE = {
  OK: 0,
  // 10xx 认证
  UNAUTHORIZED: 1001, // 未登录
  TOKEN_INVALID: 1002, // 凭证失效（版本/签名/封号）
  CODE_WRONG: 1003, // 验证码错误/过期
  CODE_FREQ: 1004, // 验证码发送频繁/超配额
  EMAIL_TAKEN: 1005, // 邮箱已注册
  // 20xx 账户
  ACCOUNT_LIMIT: 2001, // 超 5 个账户
  CASH_RANGE: 2002, // 金额越界
  NOT_OWNER: 2003, // 无属主权限
  ACCOUNT_NOT_FOUND: 2004,
  // 30xx 交易
  NOT_TRADING: 3001, // 非交易时段
  INSUFFICIENT_CASH: 3002, // 资金不足
  INSUFFICIENT_POSITION: 3003, // 可卖数量不足
  PRICE_LIMIT: 3004, // 价格越涨跌停
  ORDER_LIMIT: 3005, // 超每日 200 笔
  NO_QUOTE: 3006, // 停牌/无行情
  ORDER_NOT_CANCELLABLE: 3007, // 委托不可撤
  // 40xx 参数
  BAD_PARAM: 4000,
  // 15xx 行情降级
  MARKET_UPSTREAM_DOWN: 1501, // 上游行情不可用
} as const;

/** 便捷抛错（端点内 try/catch 后转 fail） */
export class ApiError extends Error {
  readonly code: number;
  readonly status?: number;

  constructor(code: number, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** 端点统一异常包装：ApiError → fail；其余 → 500 */
export function handleError(err: unknown): Response {
  if (err instanceof ApiError) {
    return fail(err.code, err.message, err.status);
  }
  console.error('[api] unhandled error:', err);
  return fail(500, '服务器内部错误', 500);
}

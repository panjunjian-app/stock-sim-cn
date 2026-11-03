/**
 * shared/validate.ts — 前后端共享校验规则（密码/初始资金/代码/委托）
 */
import type { Cents, OrderInput, Side, Symbol } from './types';
import { LIMIT_UP_PCT_NORMAL, LIMIT_UP_PCT_ST } from './fees';

export interface CheckResult {
  ok: boolean;
  reason?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SYMBOL_RE = /^(sh|sz)\d{6}$/;
const CODE_RE = /^\d{6}$/;

export function checkEmail(email: string): CheckResult {
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, reason: '邮箱格式不正确' };
  }
  return { ok: true };
}

/** 密码策略：≥8 位且含大写 + 小写 + 数字 + 标点 */
export function checkPassword(pw: string): CheckResult {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 64) {
    return { ok: false, reason: '密码长度需为 8~64 位' };
  }
  if (!/[A-Z]/.test(pw)) {
    return { ok: false, reason: '需包含大写字母（A-Z）' };
  }
  if (!/[a-z]/.test(pw)) {
    return { ok: false, reason: '需包含小写字母（a-z）' };
  }
  if (!/\d/.test(pw)) {
    return { ok: false, reason: '需包含数字（0-9）' };
  }
  if (!/[^A-Za-z0-9]/.test(pw)) {
    return { ok: false, reason: '需包含标点符号（如 !@#$%）' };
  }
  return { ok: true };
}

/** 密码强度等级（仅前端展示）：1 弱 / 2 中 / 3 强 */
export function passwordStrength(pw: string): number {
  let cnt = 0;
  if (/[A-Z]/.test(pw)) cnt++;
  if (/[a-z]/.test(pw)) cnt++;
  if (/\d/.test(pw)) cnt++;
  if (/[^A-Za-z0-9]/.test(pw)) cnt++;
  return cnt >= 4 ? 3 : cnt >= 3 ? 2 : cnt > 0 ? 1 : 0;
}

/** 初始资金范围：10 元 ~ 1000 万元（分） */
export const INIT_CASH_MIN: Cents = 1_000;
export const INIT_CASH_MAX: Cents = 1_000_000_000;

export function checkInitCash(cents: number): CheckResult {
  if (!Number.isInteger(cents) || cents < INIT_CASH_MIN || cents > INIT_CASH_MAX) {
    return { ok: false, reason: '初始资金不能低于 10 元（范围：10 元 ~ 1000 万元）' };
  }
  return { ok: true };
}

/** 股票代码：'sh600519' / 'sz000001' 小写格式 */
export function checkSymbol(symbol: Symbol): CheckResult {
  if (typeof symbol !== 'string' || !SYMBOL_RE.test(symbol)) {
    return { ok: false, reason: '股票代码格式不正确' };
  }
  return { ok: true };
}

/** 6 位数字验证码 */
export function checkVerifyCode(code: string): CheckResult {
  if (typeof code !== 'string' || !CODE_RE.test(code)) {
    return { ok: false, reason: '验证码应为 6 位数字' };
  }
  return { ok: true };
}

/** 委托数量：正整数且为 100 股（1 手）整数倍 */
export function checkQuantity(qty: number): CheckResult {
  if (!Number.isInteger(qty) || qty <= 0 || qty % 100 !== 0) {
    return { ok: false, reason: '委托数量须为 100 股整数倍（1 手 = 100 股）' };
  }
  return { ok: true };
}

/** 按名称识别 ST 股（涨跌幅 ±5%） */
export function isStName(name: string): boolean {
  return /ST/i.test(name || '');
}

/** 涨跌停价（整数分，四舍五入） */
export function priceLimitRange(prevClose: Cents, isST: boolean): { limitUp: Cents; limitDown: Cents } {
  const pct = isST ? LIMIT_UP_PCT_ST : LIMIT_UP_PCT_NORMAL;
  const limitUp = Math.round((prevClose * (100 + pct)) / 100);
  const limitDown = Math.round((prevClose * (100 - pct)) / 100);
  return { limitUp, limitDown };
}

/** 限价是否落在 [跌停价, 涨停价] 内 */
export function checkLimitPrice(price: Cents, prevClose: Cents, isST: boolean): CheckResult {
  if (!Number.isInteger(price) || price <= 0) {
    return { ok: false, reason: '委托价格不合法' };
  }
  const { limitUp, limitDown } = priceLimitRange(prevClose, isST);
  if (price < limitDown || price > limitUp) {
    return { ok: false, reason: '委托价格超出涨跌停范围' };
  }
  return { ok: true };
}

/** 下单参数整体校验（不含交易时段/资金/持仓，由服务端在撮合前校验） */
export function checkOrderInput(input: Partial<OrderInput>): CheckResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, reason: '参数不完整' };
  }
  const sym = checkSymbol(input.symbol ?? '');
  if (!sym.ok) {
    return sym;
  }
  if (input.side !== 'buy' && input.side !== 'sell') {
    return { ok: false, reason: 'side 必须为 buy 或 sell' };
  }
  if (input.orderType !== 'limit' && input.orderType !== 'market') {
    return { ok: false, reason: 'orderType 必须为 limit 或 market' };
  }
  if (input.orderType === 'limit') {
    const p = input.price;
    if (typeof p !== 'number' || !Number.isInteger(p) || p <= 0) {
      return { ok: false, reason: '限价单必须携带正整数价格（分）' };
    }
  }
  return checkQuantity(input.quantity ?? NaN);
}

/** 委托方向文案 */
export function sideText(side: Side): '买入' | '卖出' {
  return side === 'buy' ? '买入' : '卖出';
}

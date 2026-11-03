/**
 * shared/fees.ts — A 股模拟费用计算（全整数运算，禁止浮点参与费用）
 * 费率常量集中于此，「可配置」只需改一处。
 */
import type { Cents, Side } from './types';

/** 佣金费率：万 2.5（= 25 / 100000） */
export const COMMISSION_RATE_NUM = 25;
export const COMMISSION_RATE_DEN = 100_000;
/** 佣金最低：5 元 = 500 分 */
export const COMMISSION_MIN_CENTS: Cents = 500;
/** 印花税：卖出 0.05%（= 5 / 10000），买入免收 */
export const STAMP_RATE_NUM = 5;
export const STAMP_RATE_DEN = 10_000;
/** 过户费：0.001%（= 1 / 100000），双向收取 */
export const TRANSFER_RATE_NUM = 1;
export const TRANSFER_RATE_DEN = 100_000;
/** 每日每账户委托上限（防刷） */
export const DAILY_ORDER_LIMIT = 200;

/** 涨跌停幅度：普通 ±10%，ST ±5% */
export const LIMIT_UP_PCT_NORMAL = 10;
export const LIMIT_UP_PCT_ST = 5;

export interface Fees {
  /** 佣金（分） */
  commission: Cents;
  /** 印花税（分，仅卖出 > 0） */
  stamp: Cents;
  /** 过户费（分） */
  transfer: Cents;
  /** 三费合计（分） */
  total: Cents;
}

/** ceil(amount * num / den) 的整数安全实现 */
function ceilMul(amount: Cents, num: number, den: number): Cents {
  return Math.ceil((amount * num) / den);
}

/**
 * 计算一笔成交的三项费用。
 * 买入：佣金 + 过户费；卖出：佣金 + 印花税 + 过户费。
 */
export function calcFees(amount: Cents, side: Side): Fees {
  const commission = Math.max(ceilMul(amount, COMMISSION_RATE_NUM, COMMISSION_RATE_DEN), COMMISSION_MIN_CENTS);
  const stamp = side === 'sell' ? ceilMul(amount, STAMP_RATE_NUM, STAMP_RATE_DEN) : 0;
  const transfer = ceilMul(amount, TRANSFER_RATE_NUM, TRANSFER_RATE_DEN);
  return { commission, stamp, transfer, total: commission + stamp + transfer };
}

/**
 * 买单下单冻结金额：
 * frozenCash = quantity×冻结价 + max(冻结额×0.00025, 500) + 冻结额×0.00001
 * （冻结额 = quantity × price，分）
 */
export function calcBuyFreeze(quantity: number, price: Cents): Cents {
  const amount = quantity * price;
  const commission = Math.max(ceilMul(amount, COMMISSION_RATE_NUM, COMMISSION_RATE_DEN), COMMISSION_MIN_CENTS);
  const transfer = ceilMul(amount, TRANSFER_RATE_NUM, TRANSFER_RATE_DEN);
  return amount + commission + transfer;
}

/** 买入净流出 = 成交额 + 三费（分） */
export function buyNetAmount(amount: Cents, fees: Fees): Cents {
  return amount + fees.total;
}

/** 卖出净流入 = 成交额 - 三费（分） */
export function sellNetAmount(amount: Cents, fees: Fees): Cents {
  return amount - fees.total;
}

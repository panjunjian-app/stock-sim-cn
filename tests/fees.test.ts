import { describe, expect, it } from 'vitest';
import {
  calcBuyFreeze,
  calcFees,
  buyNetAmount,
  sellNetAmount,
  COMMISSION_MIN_CENTS,
} from '../shared/fees';
import { toCents } from '../shared/money';

describe('calcFees 佣金', () => {
  it('小额成交触发最低佣金 5 元（500 分）', () => {
    // 100 股 × 5.00 元 = 50000 分；万2.5 佣金 = 12.5 分 < 500 分 → 取最低
    const amount = 100 * toCents('5.00');
    const fees = calcFees(amount, 'buy');
    expect(fees.commission).toBe(COMMISSION_MIN_CENTS);
    expect(fees.commission).toBe(500);
  });

  it('大额成交按万2.5向上取整', () => {
    // 200 股 × 1688.00 元 = 337,600 元 = 33,760,000 分 → 佣金 = 8440 分
    const amount = 200 * toCents('1688.00');
    const fees = calcFees(amount, 'buy');
    expect(fees.commission).toBe(8440);
  });

  it('佣金向上取整不留碎分', () => {
    // 100 股 × 13.33 元 = 133,300 分 → 133300*25/100000 = 33.325 → ceil 34
    const amount = 100 * toCents('13.33');
    const fees = calcFees(amount, 'buy');
    expect(fees.commission).toBe(500); // 34 < 500，仍取最低
  });
});

describe('calcFees 印花税', () => {
  it('买入不收印花税', () => {
    const amount = 200 * toCents('1688.00');
    expect(calcFees(amount, 'buy').stamp).toBe(0);
  });

  it('卖出按 0.05% 向上取整收取', () => {
    const amount = 200 * toCents('1688.00'); // 33,760,000 分
    const fees = calcFees(amount, 'sell');
    expect(fees.stamp).toBe(Math.ceil((33_760_000 * 5) / 10_000)); // 16880
  });
});

describe('calcFees 过户费', () => {
  it('双向按 0.001% 收取', () => {
    const amount = 200 * toCents('1688.00'); // 33,760,000 分
    for (const side of ['buy', 'sell'] as const) {
      expect(calcFees(amount, side).transfer).toBe(Math.ceil(33_760_000 / 100_000)); // 338
    }
  });
});

describe('净额与冻结', () => {
  it('买入净流出 = 成交额 + 三费', () => {
    const amount = 200 * toCents('1688.00');
    const fees = calcFees(amount, 'buy');
    expect(buyNetAmount(amount, fees)).toBe(amount + fees.total);
  });

  it('卖出净流入 = 成交额 - 三费', () => {
    const amount = 200 * toCents('1688.00');
    const fees = calcFees(amount, 'sell');
    expect(sellNetAmount(amount, fees)).toBe(amount - fees.total);
  });

  it('买单冻结 = 成交额 + 最低佣金 + 过户费（小额边界）', () => {
    const freeze = calcBuyFreeze(100, toCents('5.00'));
    expect(freeze).toBe(50_000 + 500 + Math.ceil(50_000 / 100_000)); // 50501
  });

  it('费用全链路无浮点碎分', () => {
    const amount = 300 * toCents('12.07');
    for (const side of ['buy', 'sell'] as const) {
      const fees = calcFees(amount, side);
      expect(Number.isInteger(fees.commission)).toBe(true);
      expect(Number.isInteger(fees.stamp)).toBe(true);
      expect(Number.isInteger(fees.transfer)).toBe(true);
    }
  });
});

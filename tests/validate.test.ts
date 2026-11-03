/**
 * validate.test.ts — shared/validate.ts 纯函数测试
 * ⚠️ 注意：本文件在沙箱故障期间编写，尚未实际执行（vitest 被环境阻塞）。
 * 待环境恢复后运行：node node_modules/vitest/vitest.mjs run tests/validate.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  checkEmail,
  checkInitCash,
  checkLimitPrice,
  checkOrderInput,
  checkPassword,
  checkQuantity,
  checkSymbol,
  checkVerifyCode,
  isStName,
  passwordStrength,
  priceLimitRange,
  sideText,
} from '../shared/validate';
import { toCents } from '../shared/money';

describe('checkEmail', () => {
  it.each(['a@b.cn', 'user.name+tag@example.com'])('合法邮箱 %s 通过', (email) => {
    expect(checkEmail(email).ok).toBe(true);
  });
  it.each(['', 'a@b', 'a b@c.cn', 'a@b.c', '@b.cn', 'a@.cn'])('非法邮箱 %s 拒绝', (email) => {
    expect(checkEmail(email).ok).toBe(false);
  });
  it('超长邮箱（>254）拒绝', () => {
    expect(checkEmail(`${'a'.repeat(250)}@b.cn`).ok).toBe(false);
  });
});

describe('checkPassword 密码策略', () => {
  it('满足四类字符且 ≥8 位通过', () => {
    expect(checkPassword('Abcdef1!').ok).toBe(true);
  });
  it.each([
    ['Ab1!', '长度不足'],
    ['abcdef1!', '缺大写'],
    ['ABCDEF1!', '缺小写'],
    ['Abcdefg!', '缺数字'],
    ['Abcdef12', '缺标点'],
  ])('%s（%s）拒绝', (pw) => {
    expect(checkPassword(pw).ok).toBe(false);
  });
  it('超 64 位拒绝', () => {
    expect(checkPassword(`Ab1!${'x'.repeat(61)}`).ok).toBe(false);
  });
});

describe('passwordStrength 强度等级', () => {
  it('0/2/3/4 类字符 → 0/2/2/3 级', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abcdefgh')).toBe(1); // 仅小写 1 类 → 1
    expect(passwordStrength('Abcdefg1')).toBe(2); // 3 类 → 中
    expect(passwordStrength('Abcdefg1!')).toBe(3); // 4 类 → 强
  });
});

describe('checkInitCash 初始资金范围', () => {
  it('边界：10 元（1000 分）与 1000 万元（1e9 分）通过', () => {
    expect(checkInitCash(1_000).ok).toBe(true);
    expect(checkInitCash(1_000_000_000).ok).toBe(true);
  });
  it('边界外与非法值拒绝', () => {
    expect(checkInitCash(999).ok).toBe(false);
    expect(checkInitCash(1_000_000_001).ok).toBe(false);
    expect(checkInitCash(Number.NaN).ok).toBe(false);
    expect(checkInitCash(100.5).ok).toBe(false); // 非整数
  });
});

describe('checkSymbol / checkVerifyCode', () => {
  it('sh/sz + 6 位数字通过，其余拒绝', () => {
    expect(checkSymbol('sh600519').ok).toBe(true);
    expect(checkSymbol('sz000001').ok).toBe(true);
    expect(checkSymbol('SH600519').ok).toBe(false); // 大写拒绝
    expect(checkSymbol('bj600519').ok).toBe(false);
    expect(checkSymbol('sh60051').ok).toBe(false);
  });
  it('验证码必须 6 位数字', () => {
    expect(checkVerifyCode('123456').ok).toBe(true);
    expect(checkVerifyCode('12345').ok).toBe(false);
    expect(checkVerifyCode('12 456').ok).toBe(false);
    expect(checkVerifyCode('abcdef').ok).toBe(false);
  });
});

describe('checkQuantity 整手校验', () => {
  it('100 的正整数倍通过', () => {
    expect(checkQuantity(100).ok).toBe(true);
    expect(checkQuantity(1300).ok).toBe(true);
  });
  it('非整手/非法值拒绝', () => {
    expect(checkQuantity(0).ok).toBe(false);
    expect(checkQuantity(-100).ok).toBe(false);
    expect(checkQuantity(150).ok).toBe(false);
    expect(checkQuantity(100.5).ok).toBe(false);
  });
});

describe('priceLimitRange 涨跌停', () => {
  it('普通股 ±10%：昨收 1680 → [1512, 1848]', () => {
    const r = priceLimitRange(toCents('1680.00'), false);
    expect(r.limitDown).toBe(toCents('1512.00'));
    expect(r.limitUp).toBe(toCents('1848.00'));
  });
  it('ST ±5%：昨收 1000 分 → [950, 1050]', () => {
    const r = priceLimitRange(1000, true);
    expect(r.limitDown).toBe(950);
    expect(r.limitUp).toBe(1050);
  });
  it('四舍五入：昨收 999 分 普通 → 涨停 1099（1089.9 进位）', () => {
    const r = priceLimitRange(999, false);
    expect(r.limitUp).toBe(Math.round((999 * 110) / 100));
    expect(r.limitDown).toBe(Math.round((999 * 90) / 100));
  });
});

describe('checkLimitPrice 限价越界', () => {
  const prevClose = toCents('1680.00');
  it('区间内通过，区间外拒绝', () => {
    expect(checkLimitPrice(toCents('1688.00'), prevClose, false).ok).toBe(true);
    expect(checkLimitPrice(toCents('1848.00'), prevClose, false).ok).toBe(true); // 恰好涨停
    expect(checkLimitPrice(toCents('1512.00'), prevClose, false).ok).toBe(true); // 恰好跌停
    expect(checkLimitPrice(toCents('1849.00'), prevClose, false).ok).toBe(false);
    expect(checkLimitPrice(toCents('1511.00'), prevClose, false).ok).toBe(false);
  });
  it('非法价格拒绝', () => {
    expect(checkLimitPrice(0, prevClose, false).ok).toBe(false);
    expect(checkLimitPrice(-100, prevClose, false).ok).toBe(false);
    expect(checkLimitPrice(100.5, prevClose, false).ok).toBe(false);
  });
});

describe('checkOrderInput 下单参数', () => {
  const base = { symbol: 'sh600519', side: 'buy' as const, orderType: 'limit' as const, price: toCents('1688.00'), quantity: 100 };
  it('完整合法参数通过', () => {
    expect(checkOrderInput(base).ok).toBe(true);
  });
  it('市价单允许 price 为 null', () => {
    expect(checkOrderInput({ ...base, orderType: 'market', price: null }).ok).toBe(true);
  });
  it.each([
    [{ ...base, symbol: 'xxx' }, '代码'],
    [{ ...base, side: 'hold' }, '方向'],
    [{ ...base, orderType: 'stop' }, '类型'],
    [{ ...base, price: null }, '限价缺失'],
    [{ ...base, price: 0 }, '限价为 0'],
    [{ ...base, quantity: 50 }, '数量非整手'],
    [{ ...base, quantity: undefined }, '数量缺失'],
    // 故意传入非法字面量（'hold'/'stop' 等），断言校验器拒绝，因此这里用 any 放宽用例入参类型
  ] as [any, string][])('非法参数 %j 拒绝', (input: any) => {
    expect(checkOrderInput(input).ok).toBe(false);
  });
});

describe('isStName / sideText', () => {
  it('名称含 ST（任意大小写）识别为 ST', () => {
    expect(isStName('ST 康美')).toBe(true);
    expect(isStName('*st海航')).toBe(true);
    expect(isStName('贵州茅台')).toBe(false);
  });
  it('sideText 文案', () => {
    expect(sideText('buy')).toBe('买入');
    expect(sideText('sell')).toBe('卖出');
  });
});

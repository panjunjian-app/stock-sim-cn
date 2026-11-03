/**
 * money.test.ts — shared/money.ts 纯函数测试
 * ⚠️ 注意：本文件在沙箱故障期间编写，尚未实际执行（vitest 被环境阻塞）。
 * 待环境恢复后运行：node node_modules/vitest/vitest.mjs run tests/money.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  formatAmountShort,
  formatPct,
  formatSignedYuan,
  formatVolumeLots,
  formatYuan,
  formatYuanSymbol,
  toCents,
  toYuan,
} from '../shared/money';

describe('toCents 元 → 分（字符串精确，无浮点误差）', () => {
  it('两位小数字符串精确换算', () => {
    expect(toCents('1688.00')).toBe(168_800);
    expect(toCents('0.1')).toBe(10);
    expect(toCents('0.01')).toBe(1);
    expect(toCents('1234567.89')).toBe(123_456_789);
  });
  it('一位小数补零：0.5 → 50', () => {
    expect(toCents('0.5')).toBe(50);
    expect(toCents('10.5')).toBe(1050);
  });
  it('纯整数按元换算：10 → 1000', () => {
    expect(toCents(10)).toBe(1000);
  });
  it('负数金额', () => {
    expect(toCents('-12.34')).toBe(-1234);
  });
  it('字符串自动去首尾空白', () => {
    expect(toCents('  9.99  ')).toBe(999);
  });
  it('非法输入返回 NaN', () => {
    expect(Number.isNaN(toCents('abc'))).toBe(true);
    expect(Number.isNaN(toCents('1.234'))).toBe(true); // 三位小数拒绝
    expect(Number.isNaN(toCents(''))).toBe(true);
    expect(Number.isNaN(toCents('12.'))).toBe(true);
    expect(Number.isNaN(toCents(Number.NaN))).toBe(true);
    expect(Number.isNaN(toCents(Number.POSITIVE_INFINITY))).toBe(true);
  });
});

describe('toYuan / formatYuan 分 → 元展示', () => {
  it('toYuan 数值换算', () => {
    expect(toYuan(168800)).toBe(1688);
    expect(toYuan(1)).toBe(0.01);
  });
  it('formatYuan 千分位 + 两位小数', () => {
    expect(formatYuan(123456789)).toBe('1,234,567.89');
    expect(formatYuan(0)).toBe('0.00');
    expect(formatYuan(-123400)).toBe('-1,234.00');
  });
  it('formatYuanSymbol 带 ¥ 前缀', () => {
    expect(formatYuanSymbol(500)).toBe('¥5.00');
  });
  it('formatSignedYuan 正数带 +', () => {
    expect(formatSignedYuan(1234567)).toBe('+12,345.67');
    expect(formatSignedYuan(-324050)).toBe('-3,240.50');
    expect(formatSignedYuan(0)).toBe('0.00');
  });
});

describe('formatPct / formatVolumeLots / formatAmountShort', () => {
  it('formatPct 正数带 +，两位小数', () => {
    expect(formatPct(2.345)).toBe('+2.35%'); // toFixed 四舍五入
    expect(formatPct(-1.25)).toBe('-1.25%');
    expect(formatPct(0)).toBe('0.00%');
  });
  it('formatVolumeLots 股 → 手，≥1 万手转万手', () => {
    expect(formatVolumeLots(254_000)).toBe('2,540手');
    expect(formatVolumeLots(2_540_000)).toBe('2.54万手');
  });
  it('formatAmountShort 金额缩写', () => {
    expect(formatAmountShort(3_500_000_000)).toBe('3,500万'); // 3500 万元
    expect(formatAmountShort(4_280_000_000_00)).toBe('42.80亿'); // 42.8 亿元
    expect(formatAmountShort(987_600)).toBe('9,876'); // 9876 元（不足 1 万不缩写）
  });
});

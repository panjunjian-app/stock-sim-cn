import { describe, expect, it } from 'vitest';
import { tradingDaysBetween } from '../shared/trading-calendar';

/** lastSettledTradingDay / settleIdleFees 依赖 D1，此处测纯日期逻辑 */
describe('tradingDaysBetween（游手好闲费结算日枚举）', () => {
  it('同一天（交易日）返回单元素', () => {
    expect(tradingDaysBetween('2026-11-05', '2026-11-05')).toEqual(['2026-11-05']); // 周四
  });

  it('跳过周末', () => {
    // 2026-11-06 周五 → 11-07 周六 → 11-08 周日 → 11-09 周一
    expect(tradingDaysBetween('2026-11-06', '2026-11-09')).toEqual(['2026-11-06', '2026-11-09']);
  });

  it('跨周末与多周枚举升序', () => {
    const days = tradingDaysBetween('2026-11-02', '2026-11-13'); // 周一 → 周五
    expect(days).toEqual([
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13',
    ]);
  });

  it('start > end 返回空数组', () => {
    expect(tradingDaysBetween('2026-11-13', '2026-11-02')).toEqual([]);
  });

  it('start 为非交易日时从之后的第一个交易日起', () => {
    // 2026-11-07 周六 → 枚举从 11-09 周一开始
    expect(tradingDaysBetween('2026-11-07', '2026-11-10')).toEqual(['2026-11-09', '2026-11-10']);
  });

  it('2026 国庆假期被剔除（10-01/02/05/06/07 为假期）', () => {
    const days = tradingDaysBetween('2026-09-30', '2026-10-09');
    expect(days).toEqual(['2026-09-30', '2026-10-08', '2026-10-09']);
  });
});

/**
 * 大比拼日期逻辑单测：自然月加法 / 交易日顺延 / 起止日期计算
 */
import { describe, expect, it } from 'vitest';
import { addMonths, computeContestDates, tradingDayOnOrAfter } from '../contest';

describe('addMonths 自然月加法', () => {
  it('普通日期直接加', () => {
    expect(addMonths('2026-11-05', 1)).toBe('2026-12-05');
    expect(addMonths('2026-11-05', 3)).toBe('2027-02-05');
    expect(addMonths('2026-11-05', 12)).toBe('2027-11-05');
  });

  it('月末截断（1/31 + 1月 → 2/28）', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('跨年', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });
});

describe('tradingDayOnOrAfter 交易日顺延', () => {
  it('交易日当天返回当天', () => {
    expect(tradingDayOnOrAfter('2026-11-05')).toBe('2026-11-05'); // 周四
  });

  it('周末顺延到周一', () => {
    expect(tradingDayOnOrAfter('2026-11-07')).toBe('2026-11-09'); // 周六 → 周一
  });

  it('节假日顺延（国庆）', () => {
    expect(tradingDayOnOrAfter('2026-10-01')).toBe('2026-10-08'); // 10-01~10-07 休市
  });
});

describe('computeContestDates 起止日期', () => {
  it('交易日当天开赛，结束=开始+自然月', () => {
    const { startDate, endDate } = computeContestDates(1, '2026-11-05');
    expect(startDate).toBe('2026-11-05');
    expect(endDate).toBe('2026-12-05');
  });

  it('周末确认 → 顺延周一开赛', () => {
    const { startDate } = computeContestDates(3, '2026-11-07');
    expect(startDate).toBe('2026-11-09');
  });
});

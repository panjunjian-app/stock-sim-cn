import { describe, expect, it } from 'vitest';
import {
  beijingDateKey,
  beijingToTs,
  getBeijingParts,
  isInTradingHours,
  isTradingDay,
  isTradingDayTs,
  nextOpenTime,
} from '../shared/trading-calendar';

describe('交易日判定', () => {
  it('普通工作日为交易日', () => {
    expect(isTradingDay('2026-11-03')).toBe(true); // 周二
    expect(isTradingDay('2026-11-04')).toBe(true); // 周三
  });

  it('周末不是交易日', () => {
    expect(isTradingDay('2026-11-07')).toBe(false); // 周六
    expect(isTradingDay('2026-11-08')).toBe(false); // 周日
  });

  it('2026 节假日不是交易日', () => {
    expect(isTradingDay('2026-01-01')).toBe(false); // 元旦
    expect(isTradingDay('2026-02-17')).toBe(false); // 春节
    expect(isTradingDay('2026-05-01')).toBe(false); // 五一
    expect(isTradingDay('2026-10-01')).toBe(false); // 国庆
  });
});

describe('北京时间换算', () => {
  it('UTC 01:30 = 北京 09:30', () => {
    const ts = Date.UTC(2026, 10, 3, 1, 30, 0);
    const p = getBeijingParts(ts);
    expect(p.year).toBe(2026);
    expect(p.month).toBe(11);
    expect(p.day).toBe(3);
    expect(p.hour).toBe(9);
    expect(p.minute).toBe(30);
    expect(beijingDateKey(ts)).toBe('2026-11-03');
  });

  it('UTC 16:05 属北京次日', () => {
    const ts = Date.UTC(2026, 10, 3, 16, 5, 0);
    expect(beijingDateKey(ts)).toBe('2026-11-04');
  });

  it('beijingToTs 与 getBeijingParts 互逆', () => {
    const ts = beijingToTs('2026-11-03', '09:30');
    expect(new Date(ts).toISOString()).toBe('2026-11-03T01:30:00.000Z');
  });
});

describe('交易时段判定', () => {
  const ts = (dateKey: string, hhmm: string) => beijingToTs(dateKey, hhmm);

  it('9:29 未开市，9:30 开市', () => {
    expect(isInTradingHours(ts('2026-11-03', '09:29'))).toBe(false);
    expect(isInTradingHours(ts('2026-11-03', '09:30'))).toBe(true);
  });

  it('11:30 收盘（含边界不开市），11:29 开市', () => {
    expect(isInTradingHours(ts('2026-11-03', '11:29'))).toBe(true);
    expect(isInTradingHours(ts('2026-11-03', '11:30'))).toBe(false);
  });

  it('午休不开市，13:00 恢复', () => {
    expect(isInTradingHours(ts('2026-11-03', '12:00'))).toBe(false);
    expect(isInTradingHours(ts('2026-11-03', '13:00'))).toBe(true);
  });

  it('15:00 收盘', () => {
    expect(isInTradingHours(ts('2026-11-03', '14:59'))).toBe(true);
    expect(isInTradingHours(ts('2026-11-03', '15:00'))).toBe(false);
  });

  it('周末与节假日全天不开市', () => {
    expect(isInTradingHours(ts('2026-11-07', '10:00'))).toBe(false);
    expect(isInTradingHours(ts('2026-10-01', '10:00'))).toBe(false);
  });

  it('isTradingDayTs 与日期判定一致', () => {
    expect(isTradingDayTs(ts('2026-11-03', '10:00'))).toBe(true);
    expect(isTradingDayTs(ts('2026-11-07', '10:00'))).toBe(false);
  });
});

describe('下一开市时间', () => {
  it('交易日 09:00 → 当日 09:30', () => {
    const next = nextOpenTime(beijingToTs('2026-11-03', '09:00'));
    expect(new Date(next).toISOString()).toBe('2026-11-03T01:30:00.000Z');
  });

  it('交易日午休 → 当日 13:00', () => {
    const next = nextOpenTime(beijingToTs('2026-11-03', '12:00'));
    expect(new Date(next).toISOString()).toBe('2026-11-03T05:00:00.000Z');
  });

  it('交易日收盘后 → 次交易日 09:30', () => {
    const next = nextOpenTime(beijingToTs('2026-11-03', '16:00'));
    expect(new Date(next).toISOString()).toBe('2026-11-04T01:30:00.000Z');
  });

  it('周五收盘后 → 下周一 09:30', () => {
    const next = nextOpenTime(beijingToTs('2026-11-06', '15:30'));
    expect(new Date(next).toISOString()).toBe('2026-11-09T01:30:00.000Z');
  });

  it('节假日前收盘后跳过假期', () => {
    // 2026-09-30（周三）收盘后 → 国庆假期后 10-08（周四）09:30
    const next = nextOpenTime(beijingToTs('2026-09-30', '16:00'));
    expect(new Date(next).toISOString()).toBe('2026-10-08T01:30:00.000Z');
  });
});

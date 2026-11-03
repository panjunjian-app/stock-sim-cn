/**
 * shared/trading-calendar.ts — A 股交易日历与交易时段判定（北京时间 UTC+8）
 * 零运行时依赖：全部用 UTC 时间戳手动换算北京时间，禁止 import 任何包。
 */

/** 2026 年法定节假日休市日（北京时间日期 YYYY-MM-DD）；后续年份在此追加数组即可 */
export const HOLIDAYS_2026: readonly string[] = [
  // 元旦
  '2026-01-01',
  '2026-01-02',
  // 春节（2026-02-17 除夕为 2-16）
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
  '2026-02-20',
  // 清明
  '2026-04-06',
  // 劳动节
  '2026-05-01',
  '2026-05-04',
  '2026-05-05',
  // 端午
  '2026-06-19',
  // 中秋
  '2026-09-25',
  // 国庆
  '2026-10-01',
  '2026-10-02',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
];

/** 连续竞价时段（北京时间，MVP 不含集合竞价） */
export const TRADING_SESSIONS: ReadonlyArray<{ start: string; end: string }> = [
  { start: '09:30', end: '11:30' },
  { start: '13:00', end: '15:00' },
];

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface BeijingParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=周日 ... 6=周六（按北京时间）
}

/** 将 UTC 时间戳换算为北京时间分量 */
export function getBeijingParts(ts: number = Date.now()): BeijingParts {
  const shifted = new Date(ts + BEIJING_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** 北京时间日期键 'YYYY-MM-DD' */
export function beijingDateKey(ts: number = Date.now()): string {
  const p = getBeijingParts(ts);
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return `${p.year}-${mm}-${dd}`;
}

/** 北京时间 'YYYY-MM-DD' + 'HH:mm' → 真实 UTC 时间戳 */
export function beijingToTs(dateKey: string, hhmm: string): number {
  const [y, m, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  const [hh, mm] = hhmm.split(':').map((x) => parseInt(x, 10));
  return Date.UTC(y, m - 1, d, hh, mm, 0) - BEIJING_OFFSET_MS;
}

/** 判断某北京时间日期是否为交易日（非周末且非节假日） */
export function isTradingDay(dateKey: string): boolean {
  if (HOLIDAYS_2026.includes(dateKey)) {
    return false;
  }
  const [y, m, d] = dateKey.split('-').map((x) => parseInt(x, 10));
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

/** 当前时间戳对应日期是否为交易日 */
export function isTradingDayTs(ts: number = Date.now()): boolean {
  return isTradingDay(beijingDateKey(ts));
}

/** 是否处于连续竞价时段（9:30-11:30 / 13:00-15:00，北京时间，交易日） */
export function isInTradingHours(ts: number = Date.now()): boolean {
  if (!isTradingDayTs(ts)) {
    return false;
  }
  const p = getBeijingParts(ts);
  const cur = p.hour * 60 + p.minute;
  for (const s of TRADING_SESSIONS) {
    const [sh, sm] = s.start.split(':').map((x) => parseInt(x, 10));
    const [eh, em] = s.end.split(':').map((x) => parseInt(x, 10));
    if (cur >= sh * 60 + sm && cur < eh * 60 + em) {
      return true;
    }
  }
  return false;
}

/** 下一开市时间（UTC 时间戳）；从给定时刻向后最多找 60 个自然日 */
export function nextOpenTime(ts: number = Date.now()): Date {
  const startKey = beijingDateKey(ts);
  for (let i = 0; i < 60; i++) {
    const dayTs = ts + i * 24 * 60 * 60 * 1000;
    const key = beijingDateKey(dayTs);
    if (!isTradingDay(key)) {
      continue;
    }
    for (const s of TRADING_SESSIONS) {
      const openTs = beijingToTs(key, s.start);
      if (openTs > ts) {
        return new Date(openTs);
      }
    }
  }
  // 理论不可达（60 天内必有交易日）；兜底返回明天 09:30
  void startKey;
  return new Date(beijingToTs(beijingDateKey(ts + 24 * 60 * 60 * 1000), '09:30'));
}

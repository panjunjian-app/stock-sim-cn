/**
 * functions/lib/bi/trading-day.ts — BI 交易日序列工具
 * 复用 shared/trading-calendar.ts（本地节假日表，零上游调用）。
 * 所有函数纯计算、可注入测试。
 */
import { isTradingDay } from '../../../shared/trading-calendar';

/** 日期键 'YYYY-MM-DD' → UTC ms（当日北京 0 点） */
function dateKeyToTs(key: string): number {
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10));
  return Date.UTC(y, m - 1, d) - 8 * 60 * 60 * 1000;
}

function tsToDateKey(ts: number): string {
  const d = new Date(ts + 8 * 60 * 60 * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

function addDays(key: string, n: number): string {
  return tsToDateKey(dateKeyToTs(key) + n * 24 * 60 * 60 * 1000);
}

/** 自 key 向前（含 key 当天）找最近一个交易日；最多回溯 30 天 */
export function lastTradingDayOnOrBefore(key: string): string {
  for (let i = 0; i < 30; i++) {
    const k = addDays(key, -i);
    if (isTradingDay(k)) {
      return k;
    }
  }
  return key; // 理论不可达
}

/** [startKey, endKey] 闭区间内的交易日升序列（startKey/endKey 本身可为非交易日） */
export function tradingDaysInRange(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  for (let k = startKey; k <= endKey; k = addDays(k, 1)) {
    if (isTradingDay(k)) {
      out.push(k);
    }
  }
  return out;
}

export type BiRange = '7d' | '30d' | '90d' | 'ytd' | 'all';

/** 解析 range 参数，非法回退 '7d' */
export function parseRange(v: string | null): BiRange {
  return v === '30d' || v === '90d' || v === 'ytd' || v === 'all' ? v : '7d';
}

/** 自 endKey 向前数 n 个交易日的起点（含端点，n≥1） */
export function startKeyForTradingDays(n: number, endKey: string): string {
  let count = 0;
  let k = endKey;
  for (let i = 0; i < 400; i++) {
    if (isTradingDay(k)) {
      count++;
      if (count === n) {
        return k;
      }
    }
    k = addDays(k, -1);
  }
  return k;
}

/**
 * range → 起止日期键（闭区间）。
 * 7d/30d/90d 按精确交易日数回退；ytd 自年初；all 自 2000 年。
 */
export function rangeBounds(range: BiRange, todayKey: string): { startKey: string; endKey: string } {
  const end = lastTradingDayOnOrBefore(todayKey);
  switch (range) {
    case '7d':
      return { startKey: startKeyForTradingDays(7, end), endKey: end };
    case '30d':
      return { startKey: startKeyForTradingDays(30, end), endKey: end };
    case '90d':
      return { startKey: startKeyForTradingDays(90, end), endKey: end };
    case 'ytd': {
      const [y] = todayKey.split('-');
      return { startKey: `${y}-01-01`, endKey: end };
    }
    case 'all':
      return { startKey: '2000-01-01', endKey: end };
  }
}

/** 上一交易日（不含 key 当天） */
export function prevTradingDay(key: string): string {
  return lastTradingDayOnOrBefore(addDays(key, -1));
}

import { describe, expect, it } from 'vitest';
import { tradingDaysBetween } from '../shared/trading-calendar';
import { computeIdleChargeDays, type IdleTradeRow } from '../functions/lib/idle-fee';

/** 交易日枚举（游手好闲费结算日）既有用例保留 */
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

/** 组造成交辅助：traded_at 用北京时间字面量转 UTC ISO（北京时间 = UTC+8） */
const at = (day: string, hhmm: string): string => new Date(`${day}T${hhmm}:00+08:00`).toISOString();
const buy = (symbol: string, quantity: number, day: string, hhmm = '10:00'): IdleTradeRow => ({ symbol, side: 'buy', quantity, traded_at: at(day, hhmm) });
const sell = (symbol: string, quantity: number, day: string, hhmm = '14:00'): IdleTradeRow => ({ symbol, side: 'sell', quantity, traded_at: at(day, hhmm) });

/** computeIdleChargeDays：连续三交易日空仓判定 */
describe('computeIdleChargeDays（连续三交易日空仓扣费判定）', () => {
  const days = tradingDaysBetween('2026-11-02', '2026-11-13'); // 10 个交易日：11-02(一)…11-06(五)、11-09(一)…11-13(五)

  it('开赛即空仓：前两日豁免，第 3 个交易日起每日扣费', () => {
    const r = computeIdleChargeDays(days, []);
    expect([...r]).toEqual(['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  });

  it('前两日空仓后买入：当日收市有持仓计数清零，不产生扣费日', () => {
    // 11-03 盘中买入 → 11-02 空(streak1)、11-03 有仓(清零)、之后一直有仓
    const r = computeIdleChargeDays(days, [buy('sh600000', 100, '2026-11-03')]);
    expect(r.size).toBe(0);
  });

  it('清仓后连续三交易日空仓重新启动：卖出日不扣，第 3 天起恢复扣费', () => {
    // 一直空仓到 11-04 卖出过旧仓？改为：11-02 买入、11-05 卖出清仓 → 11-02..04 有仓，11-05 起空仓
    // 11-05(1)、11-06(2)、11-09(3)→扣，11-10、11-11、11-12、11-13 续扣
    const r = computeIdleChargeDays(days, [buy('sh600000', 100, '2026-11-02'), sell('sh600000', 100, '2026-11-05')]);
    expect([...r]).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  });

  it('部分清仓仍有余仓：不视为空仓', () => {
    // 11-02 买 200，11-05 卖 100 → 每日收市均有持仓
    const r = computeIdleChargeDays(days, [buy('sh600000', 200, '2026-11-02'), sell('sh600000', 100, '2026-11-05')]);
    expect(r.size).toBe(0);
  });

  it('当日 15:00 前买入计入当日收市持仓：买入清零计数，卖出清仓后重新计满三日再扣', () => {
    // 11-04 14:59 买入 → 11-04 收市有仓（清零开赛初 streak）；11-06 14:00 卖出清仓
    // 11-02(1)、11-03(2) 未满三日不扣；11-06(1)、11-09(2)、11-10(3)→扣，续扣至周末前
    const r = computeIdleChargeDays(days, [buy('sh600000', 100, '2026-11-04', '14:59'), sell('sh600000', 100, '2026-11-06')]);
    expect([...r]).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  });

  it('当日 15:00 后成交不计入当日收市持仓：11-04 仍空仓扣费，11-05 起有仓停止', () => {
    // 11-04 15:01 买入（不计入 11-04 收市）→ 11-02(1)、11-03(2)、11-04(3)→扣 11-04；11-05 重放计入买入，有仓停止
    const r = computeIdleChargeDays(days, [buy('sh600000', 100, '2026-11-04', '15:01')]);
    expect([...r]).toEqual(['2026-11-04']);
  });

  it('跨周末连续：周五卖出清仓为第 1 天，下周一第 2 天，周二第 3 天恢复扣费', () => {
    // 开赛 11-02 起空仓：11-02(1)、11-03(2)、11-04(3)→扣 11-04；11-05 买入有仓清零；11-06 卖出清仓
    // 11-06(1)、11-09(2)、11-10(3)→扣，续扣
    const r = computeIdleChargeDays(days, [buy('sh600000', 100, '2026-11-05'), sell('sh600000', 100, '2026-11-06')]);
    expect([...r]).toEqual(['2026-11-04', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  });

  it('多只股票部分持仓：合计不为 0 即有仓', () => {
    // A 股 100 一直持有，B 股买了又卖光 → 每日仍有 A 持仓
    const r = computeIdleChargeDays(days, [buy('sh600000', 100, '2026-11-02'), buy('sz000001', 100, '2026-11-03'), sell('sz000001', 100, '2026-11-05')]);
    expect(r.size).toBe(0);
  });

  it('成交乱序输入也能正确重放（内部按时间排序）', () => {
    const r = computeIdleChargeDays(days, [sell('sh600000', 100, '2026-11-06'), buy('sh600000', 100, '2026-11-04', '14:59')]);
    expect([...r]).toEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  });
});

/**
 * overview.test.ts — src/utils/overview.ts mergePositions 当日盈亏计算测试
 * 覆盖：有快照（涨/跌）/ 无快照 / prevClose 为 0 的边界
 */
import { describe, expect, it } from 'vitest';
import { mergePositions } from '../src/utils/overview';
import type { Position, Quote, Symbol as StockSymbol } from '../shared/types';

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    symbol: 'sh600000' as StockSymbol,
    symbolName: '浦发银行',
    qty: 100,
    availableQty: 100,
    frozenQty: 0,
    avgCost: 1000, // 10.00 元
    lastPrice: 1000,
    marketValue: 100000,
    pnl: 0,
    pnlPct: 0,
    ...overrides,
  };
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: 'sh600000' as StockSymbol,
    name: '浦发银行',
    price: 1050, // 10.50 元
    prevClose: 1000, // 昨收 10.00 元
    open: 1010,
    high: 1060,
    low: 1005,
    volume: 1000,
    ...overrides,
  } as Quote;
}

describe('mergePositions 当日盈亏', () => {
  it('有快照：当日盈亏 = (最新价 − 昨收) × qty，比例保留两位', () => {
    const [p] = mergePositions([makePosition()], { sh600000: makeQuote({ price: 1050, prevClose: 1000 }) });
    expect(p.prevClose).toBe(1000);
    expect(p.dayPnl).toBe(5000); // (10.50 − 10.00) × 100 股 = 50.00 元 = 5000 分
    expect(p.dayPnlPct).toBe(5); // 5.00%
  });

  it('有快照下跌：dayPnl 为负，比例保留两位小数', () => {
    const [p] = mergePositions([makePosition({ qty: 300 })], { sh600000: makeQuote({ price: 987, prevClose: 1000 }) });
    expect(p.dayPnl).toBe(-3900); // (9.87 − 10.00) × 300 = −39.00 元
    expect(p.dayPnlPct).toBe(-1.3); // (−13/1000)×100 = −1.30%
  });

  it('无快照：prevClose/dayPnl/dayPnlPct 均为 undefined（前端展示「—」）', () => {
    const [p] = mergePositions([makePosition()], {});
    expect(p.prevClose).toBeUndefined();
    expect(p.dayPnl).toBeUndefined();
    expect(p.dayPnlPct).toBeUndefined();
    // 既有字段不受影响：无快照时以成本兜底
    expect(p.lastPrice).toBe(1000);
    expect(p.pnl).toBe(0);
  });

  it('prevClose 为 0（无效昨收）：dayPnlPct 为 undefined，dayPnl 仍按差值计算', () => {
    const [p] = mergePositions([makePosition()], { sh600000: makeQuote({ price: 1050, prevClose: 0 }) });
    expect(p.prevClose).toBe(0);
    expect(p.dayPnl).toBe(105000); // (10.50 − 0) × 100 股
    expect(p.dayPnlPct).toBeUndefined(); // 避免除零，比例显示「—」
  });

  it('部分今日买入：昨持部分按昨收、今买部分按摊薄成本', () => {
    // 昨持 100（昨收 10.00）+ 今日买入 200（摊薄成本 10.57），现价 10.32
    const [p] = mergePositions(
      [makePosition({ qty: 300, avgCost: 1057, todayBuyQty: 200 })],
      { sh600000: makeQuote({ price: 1032, prevClose: 1000 }) },
    );
    expect(p.dayPnl).toBe(-1800); // (10.32−10.00)×100 + (10.32−10.57)×200 = 3200 − 5000 = −18.00 元
    expect(p.dayPnlPct).toBe(3.2); // 比例基于昨持部分的昨收基准：(10.32−10.00)/10.00
  });

  it('全部今日买入：金额按成本口径，比例基于买入成本（昨收基准不可用）', () => {
    // 东方通信场景：今日买入 300 股，摊薄成本 10.57，现价 10.32，昨收 10.28
    const [p] = mergePositions(
      [makePosition({ symbol: 'sh600877' as StockSymbol, qty: 300, avgCost: 1057, todayBuyQty: 300 })],
      {
        sh600877: makeQuote({ symbol: 'sh600877' as StockSymbol, price: 1032, prevClose: 1028 }),
      },
    );
    expect(p.dayPnl).toBe(-7500); // (10.32 − 10.57) × 300 = −75.00 元（对齐汇总资金口径）
    expect(p.dayPnlPct).toBe(-2.37); // (10.32 − 10.57) / 10.57 × 100 = −2.365… → 保留两位 −2.37%
  });

  it('无今日买入（todayBuyQty 未传）：行为与旧版完全一致（回归）', () => {
    const [p] = mergePositions([makePosition()], { sh600000: makeQuote({ price: 1050, prevClose: 1000 }) });
    expect(p.dayPnl).toBe(5000);
    expect(p.dayPnlPct).toBe(5);
  });

  it('今日买入但 avgCost 为 0（异常数据）：跳过成本部分，比例不可算为 undefined', () => {
    const [p] = mergePositions(
      [makePosition({ qty: 100, avgCost: 0, todayBuyQty: 100 })],
      { sh600000: makeQuote({ price: 1050, prevClose: 1000 }) },
    );
    expect(p.dayPnl).toBe(0); // preHeld=0 且 avgCost=0 跳过成本部分 → 0
    expect(p.dayPnlPct).toBeUndefined(); // 全为今买但 avgCost 无效 → 无比例基准，显示「—」
  });
});

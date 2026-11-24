/**
 * today-realized.test.ts — 今日卖出已实现 + 持仓明细合计条计算测试
 * 覆盖：无卖出 / 有卖出（盈、亏、混合）/ 行情失败（prevClose 缺失 → null）/ 持仓缺快照
 */
import { describe, expect, it } from 'vitest';
import { computeTodayRealized, formatRealizedDetail, summarizeDayPnl } from '../shared/today-realized';
import type { TodaySellAggregate } from '../shared/today-realized';
import type { Position, Symbol as StockSymbol, TodayRealized } from '../shared/types';

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

function sell(overrides: Partial<TodaySellAggregate> = {}): TodaySellAggregate {
  return {
    symbol: 'sz000001' as StockSymbol,
    symbolName: '平安银行',
    sellQty: 100,
    sellNet: 105_000, // 卖出净额 1050.00 元（已扣费）
    ...overrides,
  };
}

describe('computeTodayRealized 今日卖出已实现', () => {
  it('今日无卖出：dayPnl 为 0、items 为空、不降级', () => {
    const r = computeTodayRealized([], {});
    expect(r.dayPnl).toBe(0);
    expect(r.items).toEqual([]);
    expect(r.degraded).toBe(false);
  });

  it('全部标的可算：已实现 = Σ(卖出净额 − 昨收 × 卖出量)，已扣费用天然包含', () => {
    const r = computeTodayRealized(
      [sell({ symbol: 'sz000001', sellQty: 100, sellNet: 105_000, symbolName: '平安银行' })],
      { sz000001: { name: '平安银行', prevClose: 1000 } },
    );
    // 1050.00 − 10.00 × 100 = 50.00 元 = 5000 分
    expect(r.dayPnl).toBe(5000);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].dayPnl).toBe(5000);
    expect(r.items[0].symbolName).toBe('平安银行');
    expect(r.degraded).toBe(false);
  });

  it('多笔混合盈亏：合计为各股之和，明细按盈亏从高到低排列', () => {
    const r = computeTodayRealized(
      [
        sell({ symbol: 'sz000001', sellQty: 100, sellNet: 105_000, symbolName: '平安银行' }), // +50.00 元
        sell({ symbol: 'sh600000', sellQty: 200, sellNet: 190_000, symbolName: '浦发银行' }), // 1900 − 10.00×200 = −100.00 元
      ],
      {
        sz000001: { prevClose: 1000 },
        sh600000: { prevClose: 1000 },
      },
    );
    expect(r.dayPnl).toBe(5000 - 10_000);
    expect(r.items.map((i) => i.symbol)).toEqual(['sz000001', 'sh600000']);
    expect(r.degraded).toBe(false);
  });

  it('行情失败（prevClose 缺失）：该股 dayPnl 为 null，整体 dayPnl 为 null（不可计算）', () => {
    const r = computeTodayRealized(
      [
        sell({ symbol: 'sz000001', sellQty: 100, sellNet: 105_000 }),
        sell({ symbol: 'sh600000', sellQty: 100, sellNet: 99_000, symbolName: undefined }),
      ],
      { sz000001: { prevClose: 1000 } }, // sh600000 无行情
    );
    expect(r.dayPnl).toBeNull();
    expect(r.degraded).toBe(true);
    const failed = r.items.find((i) => i.symbol === 'sh600000');
    expect(failed?.dayPnl).toBeNull();
    // 不可计算项排在末尾；名称兜底为代码
    expect(r.items[r.items.length - 1].symbol).toBe('sh600000');
    expect(failed?.symbolName).toBe('sh600000');
  });

  it('prevClose 为 0 / 负 视为无效行情（不参与计算）', () => {
    const r = computeTodayRealized([sell({ symbol: 'sz000001', sellNet: 100_000 })], {
      sz000001: { prevClose: 0 },
    });
    expect(r.dayPnl).toBeNull();
    expect(r.items[0].dayPnl).toBeNull();
  });

  it('ignores 非正卖出量（脏数据防御）', () => {
    const r = computeTodayRealized([sell({ symbol: 'sz000001', sellQty: 0, sellNet: 0 })], {
      sz000001: { prevClose: 1000 },
    });
    expect(r.dayPnl).toBe(0);
    expect(r.items).toHaveLength(0);
  });

  it('名称优先取 trades.symbol_name，其次行情名', () => {
    const fromRow = computeTodayRealized([sell({ symbolName: '平安银行' })], { sz000001: { name: '行情名', prevClose: 1000 } });
    expect(fromRow.items[0].symbolName).toBe('平安银行');
    const fromQuote = computeTodayRealized([sell({ symbolName: undefined })], { sz000001: { name: '行情名', prevClose: 1000 } });
    expect(fromQuote.items[0].symbolName).toBe('行情名');
  });
});

describe('summarizeDayPnl 持仓明细合计条', () => {
  it('无今日卖出：合计 = 持仓合计（只展示一行，无已实现行）', () => {
    const s = summarizeDayPnl(
      [makePosition({ dayPnl: 5000 }), makePosition({ symbol: 'sz000001' as StockSymbol, dayPnl: -2000 })],
      { dayPnl: 0, items: [] },
    );
    expect(s.holdings).toBe(3000);
    expect(s.hasRealized).toBe(false);
    expect(s.realized).toBe(0);
    expect(s.total).toBe(3000);
    expect(s.complete).toBe(true);
  });

  it('有今日卖出：合计 = 持仓合计 + 已实现（用户 B 的清仓场景）', () => {
    const realized: TodayRealized = {
      dayPnl: 8000,
      items: [
        { symbol: 'sh600519' as StockSymbol, symbolName: '贵州茅台', sellQty: 100, dayPnl: 8000 },
      ],
    };
    const s = summarizeDayPnl([makePosition({ dayPnl: -1500 })], realized);
    expect(s.holdings).toBe(-1500);
    expect(s.realized).toBe(8000);
    expect(s.total).toBe(6500);
    expect(s.hasRealized).toBe(true);
    expect(s.realizedItems).toHaveLength(1);
    expect(s.complete).toBe(true);
  });

  it('行情失败（realized.dayPnl 为 null）：合计为 null，不给出错误数字', () => {
    const s = summarizeDayPnl([makePosition({ dayPnl: 1000 })], {
      dayPnl: null,
      items: [{ symbol: 'sh600519' as StockSymbol, symbolName: '贵州茅台', sellQty: 100, dayPnl: null }],
      degraded: true,
    });
    expect(s.holdings).toBe(1000);
    expect(s.realized).toBeNull();
    expect(s.total).toBeNull();
    expect(s.complete).toBe(false);
    expect(s.hasRealized).toBe(true);
  });

  it('持仓行缺快照（dayPnl undefined）：合计不可计算', () => {
    const s = summarizeDayPnl([makePosition({ dayPnl: undefined }), makePosition({ symbol: 'sz000001' as StockSymbol, dayPnl: 500 })], null);
    expect(s.holdingsComplete).toBe(false);
    expect(s.total).toBeNull();
    expect(s.complete).toBe(false);
  });

  it('全部清仓（无持仓）但有今日卖出：合计 = 已实现', () => {
    const s = summarizeDayPnl([], {
      dayPnl: -3000,
      items: [{ symbol: 'sz000001' as StockSymbol, symbolName: '平安银行', sellQty: 100, dayPnl: -3000 }],
    });
    expect(s.holdings).toBe(0);
    expect(s.total).toBe(-3000);
    expect(s.hasRealized).toBe(true);
  });

  it('缺省 todayRealized 视为无卖出（兼容旧接口响应）', () => {
    const s = summarizeDayPnl([makePosition({ dayPnl: 200 })], undefined);
    expect(s.hasRealized).toBe(false);
    expect(s.total).toBe(200);
  });
});

describe('formatRealizedDetail 明细提示文本', () => {
  it('按行拼接「名称 股数 盈亏 元」，不可计算项显示「—」', () => {
    const text = formatRealizedDetail([
      { symbol: 'sz000001' as StockSymbol, symbolName: '平安银行', sellQty: 100, dayPnl: 5000 },
      { symbol: 'sh600000' as StockSymbol, symbolName: '浦发银行', sellQty: 200, dayPnl: null },
    ]);
    expect(text).toBe('平安银行 100股 +50.00 元\n浦发银行 200股 — 元');
  });

  it('空数组返回空串', () => {
    expect(formatRealizedDetail([])).toBe('');
  });
});

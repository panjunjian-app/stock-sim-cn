/**
 * BI 核心纯函数单元测试：walkTrades（摊薄成本/已实现盈亏） + 交易日工具
 */
import { describe, expect, it } from 'vitest';
import { walkTrades, type TradeRow } from '../replay';
import { lastTradingDayOnOrBefore, prevTradingDay, parseRange, tradingDaysInRange, rangeBounds } from '../trading-day';

function t(side: 'buy' | 'sell', price: number, qty: number, opts: Partial<TradeRow> = {}): TradeRow {
  const amount = price * qty;
  const fee = side === 'buy' ? 5 : 15; // 买无印花，卖含印花（简化）
  return {
    symbol: 'sh600519',
    symbol_name: '贵州茅台',
    side,
    price,
    quantity: qty,
    fee_commission: 5,
    fee_stamp: side === 'sell' ? 10 : 0,
    fee_transfer: 0,
    net_amount: side === 'buy' ? -(amount + fee) : amount - fee,
    traded_at: '2026-10-01T01:00:00.000Z',
    ...opts,
  };
}

describe('walkTrades 摊薄成本与已实现盈亏', () => {
  it('纯买入：无已实现，成本=买入净支出', () => {
    const w = walkTrades([t('buy', 1000, 100)]);
    expect(w.realizedTotal).toBe(0);
    expect(w.finalQty.get('sh600519')).toBe(100);
    expect(w.eodCost).toBeInstanceOf(Map);
  });

  it('买卖各一笔：已实现=(卖价-加权成本)×数量-卖出费用', () => {
    const w = walkTrades([
      t('buy', 1000, 100), // 成本基数 100000+5
      t('sell', 1100, 100, { traded_at: '2026-10-02T01:00:00.000Z' }), // (1100-1000.05)*100-15=9980
    ]);
    // W = 100005/100 = 1000.05 → realized = (1100-1000.05)*100 - 15 = 9980
    expect(w.realizedTotal).toBe(9980);
    expect(w.finalQty.get('sh600519')).toBeUndefined(); // 清仓后不在 finalQty
    expect(w.realizedBySymbol.get('sh600519')).toBe(9980);
  });

  it('部分卖出：摊薄成本价不变，数量减少', () => {
    const w = walkTrades([
      t('buy', 1000, 200), // costSum 200005
      t('sell', 1200, 50, { traded_at: '2026-10-02T01:00:00.000Z' }), // W=1000.025 realized=(1200-1000.025)*50-15=9983.75→9984
    ], { markDates: ['2026-10-02'] });
    expect(w.realizedTotal).toBe(9984);
    expect(w.finalQty.get('sh600519')).toBe(150);
    // EOD 摊薄成本价保持 1000（卖出不改变成本单价）
    expect(w.eodCost.get('2026-10-02')?.get('sh600519')).toBe(1000);
  });

  it('realizedSince 只统计区间内卖出', () => {
    const rows = [
      t('buy', 1000, 100),
      t('sell', 1100, 100, { traded_at: '2026-10-02T01:00:00.000Z' }),
    ];
    const wAll = walkTrades(rows);
    const wSince = walkTrades(rows, { realizedSince: '2026-11-01T00:00:00.000Z' });
    expect(wAll.realizedTotal).toBe(9980);
    expect(wSince.realizedTotal).toBe(0);
    // 已清仓的 symbol 不出现在 finalQty（只含在持）
    expect(wAll.finalQty.get('sh600519')).toBeUndefined();
  });

  it('markDates 记录每日 EOD 持仓', () => {
    const w = walkTrades(
      [
        t('buy', 1000, 100, { traded_at: '2026-10-01T01:00:00.000Z' }),
        t('buy', 1000, 100, { symbol: 'sz000001', symbol_name: '平安银行', traded_at: '2026-10-02T01:00:00.000Z' }),
      ],
      { markDates: ['2026-10-01', '2026-10-02', '2026-10-03'] }
    );
    expect(w.eodQty.get('2026-10-01')?.get('sh600519')).toBe(100);
    expect(w.eodQty.get('2026-10-01')?.get('sz000001')).toBeUndefined();
    expect(w.eodQty.get('2026-10-02')?.get('sz000001')).toBe(100);
    expect(w.eodQty.get('2026-10-03')?.get('sh600519')).toBe(100); // 无新成交顺延
  });
});

describe('交易日工具', () => {
  it('周末回退到周五', () => {
    // 2026-11-07 是周六 → 回退 11-06 周五
    expect(lastTradingDayOnOrBefore('2026-11-07')).toBe('2026-11-06');
    expect(lastTradingDayOnOrBefore('2026-11-06')).toBe('2026-11-06');
  });

  it('节假日回退（国庆 10-01~10-07 休市）', () => {
    expect(lastTradingDayOnOrBefore('2026-10-03')).toBe('2026-09-30');
  });

  it('prevTradingDay 跨周末', () => {
    expect(prevTradingDay('2026-11-09')).toBe('2026-11-06'); // 周一 → 上周五
  });

  it('tradingDaysInRange 含闭区间且剔除周末节假日', () => {
    const days = tradingDaysInRange('2026-11-04', '2026-11-10');
    expect(days).toEqual(['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10']);
  });

  it('parseRange 非法回退 7d', () => {
    expect(parseRange('30d')).toBe('30d');
    expect(parseRange('hack')).toBe('7d');
    expect(parseRange(null)).toBe('7d');
  });

  it('rangeBounds 7d 精确回退 7 个交易日', () => {
    const { startKey, endKey } = rangeBounds('7d', '2026-11-04');
    expect(endKey).toBe('2026-11-04');
    const days = tradingDaysInRange(startKey, endKey);
    expect(days).toHaveLength(7);
    expect(days[days.length - 1]).toBe('2026-11-04');
  });
});

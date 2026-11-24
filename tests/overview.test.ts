/**
 * overview.test.ts — src/utils/overview.ts mergePositions 当日盈亏计算测试
 * 覆盖：有快照（涨/跌）/ 无快照 / prevClose 为 0 的边界
 */
import { describe, expect, it } from 'vitest';
import { mergePositions } from '../src/utils/overview';
import { computeTodayRealized, splitDayPnlPosition, summarizeDayPnl } from '../shared/today-realized';
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

/**
 * 场景 F（QA 实测偏差 ¥1152）：同一标的今日「加仓 + 卖老仓」
 * 持仓表当日盈亏必须用「今日买入实际净额」作成本基准，不能用摊薄 avgCost
 * （卖出不重算 avgCost 属均价法，对剩余持仓正确，但会让今日新买部分盈亏失真）。
 * 数据取 QA 实测：sz000001 现价 12.30 / 昨收 12.34；昨持 1000 股、今买 1000 股、今卖 1000 股。
 */
describe('mergePositions 今日加仓 + 卖老仓（成本基准口径）', () => {
  const SZ = { symbol: 'sz000001' as StockSymbol, symbolName: '平安银行' } as const;
  const quote = makeQuote({ symbol: 'sz000001' as StockSymbol, price: 1230, prevClose: 1234 });

  it('今日买入部分按「今买净额」计成本：加仓后卖光老仓，当日盈亏 = −5.13 元（旧口径为 +1147.44）', () => {
    // 昨持 1000 股（成本 10.00 元/股）+ 今买 1000 股（净额 −1,230,513 分，含费 5.13 元）→ 摊薄 11.152565
    // 今卖 1000 股老仓后：持仓 1000 股（全部为今日买入），今买净额 −1,230,513 分
    const [p] = mergePositions(
      [{ ...makePosition({ ...SZ, qty: 1000, avgCost: 1115.2565, todayBuyQty: 1000 }), todayBuyNet: -1_230_513 }],
      { sz000001: quote },
    );
    // 12.30 × 1000 − 1,230,513 = −513 分 = −5.13 元（每股净成本 12.30513，现价 12.30）
    expect(p.dayPnl).toBe(-513);
    expect(p.dayPnlPct).toBe(-0.04); // (12.30 − 12.30513) / 12.30513 ≈ −0.0417%
  });

  it('合计当日盈亏与资金口径 KPI 严格相等（QA 场景 F：−56.41 元）', () => {
    const merged = mergePositions(
      [{ ...makePosition({ ...SZ, qty: 1000, avgCost: 1115.2565, todayBuyQty: 1000 }), todayBuyNet: -1_230_513 }],
      { sz000001: quote },
    );
    // 今日卖出已实现 = 卖出净额 1,228,872 − 昨收 12.34 × 1000 = −5,128 分
    const summary = summarizeDayPnl(merged, {
      dayPnl: -5128,
      items: [{ symbol: 'sz000001' as StockSymbol, symbolName: '平安银行', sellQty: 1000, dayPnl: -5128 }],
    });
    expect(summary.holdings).toBe(-513);
    expect(summary.total).toBe(-5641); // −56.41 元 = 顶部 KPI（资金口径）
    // 资金口径独立验算：现价×持仓 + 今买净额 + 今卖净额 − 昨收×昨持 = −5,641 分
    const kpi = 1230 * 1000 + -1_230_513 + 1_228_872 - 1234 * 1000;
    expect(kpi).toBe(-5641);
    expect(summary.total).toBe(kpi);
  });

  it('部分卖出（昨持 1000 / 今买 1000 / 今卖 500）：昨持余量按昨收、今买按净额，合计仍等于资金口径', () => {
    const merged = mergePositions(
      [{ ...makePosition({ ...SZ, qty: 1500, avgCost: 1115.2565, todayBuyQty: 1000 }), todayBuyNet: -1_230_513 }],
      { sz000001: quote },
    );
    // 昨持余 500 股：(12.30 − 12.34) × 500 = −2,000 分；今买部分 −513 分 → −2,513 分
    expect(merged[0].dayPnl).toBe(-2513);
    const summary = summarizeDayPnl(merged, {
      dayPnl: -2564, // 卖 500 股净额 614,436 − 12.34 × 500
      items: [{ symbol: 'sz000001' as StockSymbol, symbolName: '平安银行', sellQty: 500, dayPnl: -2564 }],
    });
    const kpi = 1230 * 1500 + -1_230_513 + 614_436 - 1234 * 1000;
    expect(summary.total).toBe(kpi);
  });

  it('今买净额优先于摊薄成本：即使 avgCost 被老仓大幅拉低也不受影响', () => {
    // 老仓成本 5.00 元把摊薄成本拉到 8.65，若用 avgCost 会虚增 ~3650 元盈亏
    const [p] = mergePositions(
      [{ ...makePosition({ ...SZ, qty: 1000, avgCost: 865.2565, todayBuyQty: 1000 }), todayBuyNet: -1_230_513 }],
      { sz000001: quote },
    );
    expect(p.dayPnl).toBe(-513); // 与 avgCost 无关
  });

  it('旧响应缺 todayBuyNet：退回摊薄成本口径（兼容），不报错', () => {
    const [p] = mergePositions(
      [makePosition({ ...SZ, qty: 1000, avgCost: 1115.2565, todayBuyQty: 1000 })],
      { sz000001: quote },
    );
    expect(p.dayPnl).toBeCloseTo(114_743.5, 1); // (12.30 − 11.152565) × 1000 = +1,147.435 元
  });
});

/**
 * T+0 存量数据（当天买、当天卖，成交早于 T+1 修复 9b307bf 上生产）：
 * 生产账户 22「sh603324 盛剑科技」今日 buy 2000 @29.72（NB = −5,945,546 分）、
 * sell 1500 @31.18（NS = +4,673,444 分）→ 持仓 500；现价 29.34（2934 分）。
 * 旧公式把 2000 股都算进持仓行 → 已卖出的 1500 股被「持仓行 + 已实现」重复计算 1,710 元。
 * 新公式（后端精确拆出 q0r / tbr / NB_r）：
 *   持仓行 = price×tbr + NB_r = 2934×500 − 1,486,386 = −19,386 分
 *   已实现 = NS + NB_sold = 4,673,444 − 4,459,160 = 214,284 分
 *   合计   = 194,898 分 = price×q1 + NB + NS − pc×q0（资金口径真值，0 分差）
 */
describe('mergePositions T+0 存量数据（当天买 + 当天卖）', () => {
  const T0 = { symbol: 'sh603324' as StockSymbol, symbolName: '盛剑科技' } as const;
  const quote = makeQuote({ symbol: 'sh603324' as StockSymbol, price: 2934, prevClose: 3000 });

  it('qS > q0：持仓行只计剩余今买份额（tbr=500），603324 实测 −19,386 分', () => {
    const [p] = mergePositions(
      [
        {
          ...makePosition({ ...T0, qty: 500, avgCost: 2972.773, todayBuyQty: 500 }),
          todayBuyNet: -1_486_386,
          prevHeldQty: 0, // 昨持已被今日卖光
        },
      ],
      { sh603324: quote },
    );
    expect(p.dayPnl).toBe(-19_386); // 2934×500 − 1,486,386
    expect(p.dayPnlPct).toBe(-1.3); // (29.34 − 29.72773) / 29.72773 ≈ −1.30%
  });

  it('T+0 + 已实现：合计当日盈亏 ≡ 资金口径真值（194,898 分，0 分差）', () => {
    const merged = mergePositions(
      [
        {
          ...makePosition({ ...T0, qty: 500, avgCost: 2972.773, todayBuyQty: 500 }),
          todayBuyNet: -1_486_386,
          prevHeldQty: 0,
        },
      ],
      { sh603324: quote },
    );
    const realized = 4_673_444 + -4_459_160; // NS + NB_sold
    const summary = summarizeDayPnl(merged, {
      dayPnl: realized,
      items: [{ symbol: 'sh603324' as StockSymbol, symbolName: '盛剑科技', sellQty: 1500, dayPnl: realized }],
    });
    expect(summary.holdings).toBe(-19_386);
    expect(summary.realized).toBe(214_284);
    expect(summary.total).toBe(194_898);
    // 独立验算：price×q1 + NB + NS − pc×q0
    const truth = 2934 * 500 + -5_945_546 + 4_673_444 - 3000 * 0;
    expect(truth).toBe(194_898);
    expect(summary.total).toBe(truth);
  });

  it('恒等式（多场景）：Σ持仓行 + 已实现 ≡ price×q1 + NB + NS − pc×q0', () => {
    // 6 个场景：正常 T+1 / 加仓卖老仓 / 部分卖出 / 全清仓 / T+0 残留 / 完全 T+0 清仓
    interface Case {
      name: string;
      q0: number; // 昨持（股）
      qB: number;
      NB: number;
      qS: number;
      NS: number;
      q1: number;
      pc: number;
      price: number;
    }
    const cases: Case[] = [
      { name: '正常 T+1（今卖全来自昨持）', q0: 1000, qB: 0, NB: 0, qS: 400, NS: 492_000, q1: 600, pc: 1234, price: 1230 },
      { name: '加仓 + 卖老仓（场景 F）', q0: 1000, qB: 1000, NB: -1_230_513, qS: 1000, NS: 1_228_872, q1: 1000, pc: 1234, price: 1230 },
      { name: '部分卖出（场景 G）', q0: 1000, qB: 1000, NB: -1_230_513, qS: 500, NS: 614_436, q1: 1500, pc: 1234, price: 1230 },
      { name: '全清仓无持仓（场景 C）', q0: 1000, qB: 0, NB: 0, qS: 1000, NS: 1_228_872, q1: 0, pc: 1234, price: 1230 },
      { name: 'T+0 残留（603324）', q0: 0, qB: 2000, NB: -5_945_546, qS: 1500, NS: 4_673_444, q1: 500, pc: 3000, price: 2934 },
      { name: '完全 T+0 清仓', q0: 0, qB: 1000, NB: -1_230_513, qS: 1000, NS: 1_228_872, q1: 0, pc: 1234, price: 1230 },
    ];

    for (const c of cases) {
      const split = splitDayPnlPosition({
        holdQty: c.q1,
        todayBuyQty: c.qB,
        todayBuyNet: c.NB,
        todaySellQty: c.qS,
        todaySellNet: c.NS,
      });
      // 拆分守恒
      expect(split.prevHeldRemainQty + split.todayBuyRemainQty).toBe(c.q1);
      expect(split.prevHeldRemainQty + split.soldFromPriorQty).toBe(split.prevHeldQty);
      expect(split.todayBuyRemainNet + split.soldTodayBuyNet).toBe(c.NB);

      // 持仓行（无昨持则不产生持仓行）
      const positions: Position[] = c.q1 > 0
        ? [
            {
              ...makePosition({ symbol: 'sz000001' as StockSymbol, qty: c.q1, avgCost: 1000 }),
              todayBuyQty: split.todayBuyRemainQty,
              todayBuyNet: split.todayBuyRemainNet,
              prevHeldQty: split.prevHeldRemainQty,
            },
          ]
        : [];
      const merged = mergePositions(positions, {
        sz000001: makeQuote({ symbol: 'sz000001' as StockSymbol, price: c.price, prevClose: c.pc }),
      });

      // 已实现（走后端同一条精确分支）
      const realizedRow = computeTodayRealized(
        [
          {
            symbol: 'sz000001' as StockSymbol,
            symbolName: '测试标的',
            sellQty: c.qS,
            sellNet: c.NS,
            holdQty: c.q1,
            todayBuyQty: c.qB,
            todayBuyNet: c.NB,
          },
        ],
        { sz000001: { prevClose: c.pc } },
      );
      const summary = summarizeDayPnl(merged, realizedRow);
      const truth = c.price * c.q1 + c.NB + c.NS - c.pc * c.q0;
      // 严格相等（0 分差）——NB_r 与 NB_sold 互补分摊保证不漏分
      expect(summary.total, c.name).toBe(truth);
    }
  });
});

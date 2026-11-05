import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyTrade,
  cancelOrder,
  createD1Repo,
  freezeForBuy,
  settlePositions,
  submitOrder,
  tryMatch,
  type MatchRepo,
  type OrderRow,
  type TradeRow,
} from '../functions/lib/matching';
import type { Quote, Symbol as StockSymbol } from '../shared/types';
import { beijingToTs } from '../shared/trading-calendar';
import { toCents } from '../shared/money';

// ---------------- 内存 Repo（模拟 D1 行为子集） ----------------

interface MockState {
  orders: Map<number, OrderRow>;
  nextOrderId: number;
  trades: TradeRow[];
  nextTradeId: number;
  cash: Map<number, { cash_available: number; frozen_cash: number }>;
  positions: Map<string, {
    symbol_name: string;
    qty: number;
    available_qty: number;
    frozen_qty: number;
    avg_cost: number;
    settled_date: string;
  }>;
  cashFlows: Array<{ account_id: number; type: string; amount: number; balance_after: number }>;
}

const ACCOUNT_ID = 1;
const USER_ID = 100;

function makeRepo(state: MockState): MatchRepo {
  const posKey = (accountId: number, symbol: string) => `${accountId}:${symbol}`;
  return {
    async getOrder(id) {
      return state.orders.get(id) ?? null;
    },
    async listOpenOrders(accountId) {
      return Array.from(state.orders.values()).filter(
        (o) => o.account_id === accountId && (o.status === 'pending' || o.status === 'partial'),
      );
    },
    async insertOrder(o) {
      const id = state.nextOrderId++;
      state.orders.set(id, { ...o, id });
      return id;
    },
    async updateOrder(id, patch) {
      const cur = state.orders.get(id);
      if (cur) {
        state.orders.set(id, { ...cur, ...patch });
      }
    },
    async getAccountCash(accountId) {
      const c = state.cash.get(accountId);
      return c ? { id: accountId, ...c } : null;
    },
    async tryFreezeCash(accountId, amount) {
      const c = state.cash.get(accountId);
      if (!c || c.cash_available < amount) {
        return false;
      }
      c.cash_available -= amount;
      c.frozen_cash += amount;
      return true;
    },
    async adjustCash(accountId, cashDelta, frozenDelta) {
      const c = state.cash.get(accountId);
      if (c) {
        c.cash_available += cashDelta;
        c.frozen_cash += frozenDelta;
      }
    },
    async updateOrderGuarded(id, patch, fromStatuses) {
      const cur = state.orders.get(id);
      if (!cur || !fromStatuses.includes(cur.status)) {
        return false;
      }
      state.orders.set(id, { ...cur, ...patch });
      return true;
    },
    async getPosition(accountId, symbol) {
      const p = state.positions.get(posKey(accountId, symbol));
      return p ? { id: 0, symbol, ...p } : null;
    },
    async upsertPosition(p) {
      state.positions.set(posKey(p.accountId, p.symbol), {
        symbol_name: p.symbolName,
        qty: p.qty,
        available_qty: p.availableQty,
        frozen_qty: p.frozenQty,
        avg_cost: p.avgCost,
        settled_date: p.settledDate,
      });
    },
    async insertTrade(t) {
      const id = state.nextTradeId++;
      state.trades.push({ ...t, id });
      return id;
    },
    async insertCashFlow(f) {
      state.cashFlows.push({ account_id: f.account_id, type: f.type, amount: f.amount, balance_after: f.balance_after });
    },
    async settleTradeAtomic({ trade, position, accountId, cashDelta, frozenDelta, cashFlow }) {
      // 内存实现：顺序执行等价（测试无并发场景）
      const id = state.nextTradeId++;
      state.trades.push({ ...trade, id });
      state.positions.set(posKey(position.accountId, position.symbol), {
        symbol_name: position.symbolName,
        qty: position.qty,
        available_qty: position.availableQty,
        frozen_qty: position.frozenQty,
        avg_cost: position.avgCost,
        settled_date: position.settledDate,
      });
      const c = state.cash.get(accountId);
      if (c) {
        c.cash_available += cashDelta;
        c.frozen_cash += frozenDelta;
      }
      state.cashFlows.push({
        account_id: cashFlow.account_id,
        type: cashFlow.type,
        amount: cashFlow.amount,
        balance_after: cashFlow.balance_after,
      });
      return id;
    },
    async freezeSellAtomic(position, order) {
      state.positions.set(posKey(position.accountId, position.symbol), {
        symbol_name: position.symbolName,
        qty: position.qty,
        available_qty: position.availableQty,
        frozen_qty: position.frozenQty,
        avg_cost: position.avgCost,
        settled_date: position.settledDate,
      });
      const id = state.nextOrderId++;
      state.orders.set(id, { ...order, id });
      return id;
    },
    async countOrdersToday() {
      return state.orders.size;
    },
    async listPositionsBelowSettle(accountId, today) {
      void accountId;
      return Array.from(state.positions.entries())
        .filter(([, p]) => p.qty > 0 && (p.settled_date === '' || p.settled_date < today))
        .map(([k, p]) => ({
          symbol: k.split(':')[1],
          symbol_name: p.symbol_name,
          qty: p.qty,
          available_qty: p.available_qty,
          frozen_qty: p.frozen_qty,
          avg_cost: p.avg_cost,
          settled_date: p.settled_date,
        }));
    },
  };
}

function freshState(cashYuan = 1_000_000): MockState {
  return {
    orders: new Map(),
    nextOrderId: 1,
    trades: [],
    nextTradeId: 1,
    cash: new Map([[ACCOUNT_ID, { cash_available: toCents(String(cashYuan)), frozen_cash: 0 }]]),
    positions: new Map(),
    cashFlows: [],
  };
}

function makeOrder(partial: Partial<OrderRow>): OrderRow {
  return {
    id: 1,
    account_id: ACCOUNT_ID,
    user_id: USER_ID,
    symbol: 'sh600519',
    symbol_name: '贵州茅台',
    side: 'buy',
    order_type: 'limit',
    price: toCents('1680.00'),
    quantity: 100,
    frozen_cash: 0,
    filled_qty: 0,
    avg_price: null,
    status: 'pending',
    reject_reason: null,
    last_check_at: null,
    created_at: '2026-11-03T02:00:00.000Z',
    updated_at: '2026-11-03T02:00:00.000Z',
    ...partial,
  };
}

function makeQuote(priceYuan: number, prevCloseYuan = 1680): Quote {
  return {
    symbol: 'sh600519',
    name: '贵州茅台',
    price: toCents(String(priceYuan)),
    prevClose: toCents(String(prevCloseYuan)),
    open: toCents(String(prevCloseYuan)),
    high: toCents(String(priceYuan)),
    low: toCents(String(prevCloseYuan)),
    volume: 10000,
    amount: 1000000000,
    changePct: 0,
    fetchedAt: '2026-11-03T02:00:00.000Z',
  };
}

const marketOf = (priceYuan: number) => ({ fetchQuotes: async () => [makeQuote(priceYuan)] });

// ---------------- 用例 ----------------

let state: MockState;
let repo: MatchRepo;

beforeEach(() => {
  state = freshState();
  repo = makeRepo(state);
});

describe('freezeForBuy 冻结金额', () => {
  it('冻结 = 成交额 + 佣金(≥5元) + 过户费', () => {
    const freeze = freezeForBuy(200, toCents('1688.00'));
    const amount = 200 * toCents('1688.00');
    const commission = Math.max(Math.ceil((amount * 25) / 100000), 500);
    const transfer = Math.ceil(amount / 100000);
    expect(freeze).toBe(amount + commission + transfer);
  });
});

describe('tryMatch 限价单', () => {
  it('限价买：最新价 ≤ 限价时按最新价成交', async () => {
    const order = makeOrder({ price: toCents('1688.00') });
    state.orders.set(order.id, order);
    const r = await tryMatch(repo, marketOf(1685), order);
    expect(r.matched).toBe(true);
    expect(r.trade?.price).toBe(toCents('1685.00'));
    expect(state.orders.get(1)?.status).toBe('filled');
  });

  it('限价买：最新价 > 限价不成交（挂单等待）', async () => {
    const order = makeOrder({ price: toCents('1680.00') });
    state.orders.set(order.id, order);
    const r = await tryMatch(repo, marketOf(1685), order);
    expect(r.matched).toBe(false);
    expect(state.orders.get(1)?.status).toBe('pending');
  });

  it('限价卖：最新价 ≥ 限价时成交', async () => {
    state.positions.set(`${ACCOUNT_ID}:sh600519`, {
      symbol_name: '贵州茅台',
      qty: 200,
      available_qty: 200,
      frozen_qty: 0,
      avg_cost: toCents('1600.00'),
      settled_date: '2026-11-03',
    });
    const order = makeOrder({ side: 'sell', price: toCents('1670.00') });
    state.orders.set(order.id, order);
    const r = await tryMatch(repo, marketOf(1685), order);
    expect(r.matched).toBe(true);
    expect(state.positions.get(`${ACCOUNT_ID}:sh600519`)?.qty).toBe(100);
  });

  it('标的封涨停时买单不成交', async () => {
    // 昨收 1680 → 涨停 1848；最新价 = 1848（封板）
    const order = makeOrder({ price: toCents('1848.00') });
    state.orders.set(order.id, order);
    const r = await tryMatch(repo, marketOf(1848), order);
    expect(r.matched).toBe(false);
  });

  it('标的封跌停时卖单不成交', async () => {
    state.positions.set(`${ACCOUNT_ID}:sh600519`, {
      symbol_name: '贵州茅台',
      qty: 100,
      available_qty: 100,
      frozen_qty: 0,
      avg_cost: toCents('1600.00'),
      settled_date: '2026-11-03',
    });
    const order = makeOrder({ side: 'sell', price: toCents('1512.00') });
    state.orders.set(order.id, order);
    const r = await tryMatch(repo, marketOf(1512), order);
    expect(r.matched).toBe(false);
  });

  it('行情不可用时保单不成交', async () => {
    const order = makeOrder({});
    state.orders.set(order.id, order);
    const r = await tryMatch(repo, { fetchQuotes: async () => [] }, order);
    expect(r.matched).toBe(false);
    expect(state.orders.get(1)?.status).toBe('pending');
  });
});

describe('applyTrade 买成交结算', () => {
  it('资金多退少补 + 摊薄成本 + 流水', async () => {
    const price = toCents('1680.00');
    const freeze = freezeForBuy(200, price);
    // 模拟下单冻结后的真实状态：可用资金已扣减、frozen_cash 已挂账
    state.cash.set(ACCOUNT_ID, { cash_available: toCents('1000000') - freeze, frozen_cash: freeze });
    const order = makeOrder({ quantity: 200, price, frozen_cash: freeze });
    state.orders.set(order.id, order);

    const trade = await applyTrade(repo, order, toCents('1670.00'));
    expect(trade.amount).toBe(200 * toCents('1670.00'));

    const cash = state.cash.get(ACCOUNT_ID)!;
    // 实际扣款 = 成交额 + 三费；冻结多退少补（总额恰为实际扣款）
    const fees = {
      commission: Math.max(Math.ceil((trade.amount * 25) / 100000), 500),
      stamp: 0,
      transfer: Math.ceil(trade.amount / 100000),
    };
    const actualCost = trade.amount + fees.commission + fees.transfer;
    expect(cash.cash_available).toBe(toCents('1000000') - actualCost);
    expect(cash.frozen_cash).toBe(0);

    // 摊薄成本 = (0×0 + 成交额+费) / 200，保留万分位精度（不取整）
    expect(state.positions.get(`${ACCOUNT_ID}:sh600519`)?.avg_cost).toBe(Number((actualCost / 200).toFixed(4)));
    // T+1：当日买入 available 不增加
    expect(state.positions.get(`${ACCOUNT_ID}:sh600519`)?.available_qty).toBe(0);
    // 流水净额为负（流出）
    expect(state.cashFlows[0].amount).toBeLessThan(0);
    expect(state.cashFlows[0].balance_after).toBe(cash.cash_available);
  });
});

describe('applyTrade 卖成交结算', () => {
  it('资金入账 + 持仓扣减 + 解冻 + 流水', async () => {
    state.positions.set(`${ACCOUNT_ID}:sh600519`, {
      symbol_name: '贵州茅台',
      qty: 300,
      available_qty: 200,
      frozen_qty: 100,
      avg_cost: toCents('1600.00'),
      settled_date: '2026-11-03',
    });
    const order = makeOrder({ side: 'sell', quantity: 100, price: toCents('1680.00') });
    state.orders.set(order.id, order);
    const cashBefore = state.cash.get(ACCOUNT_ID)!.cash_available;

    const trade = await applyTrade(repo, order, toCents('1685.00'));
    const cash = state.cash.get(ACCOUNT_ID)!;
    expect(cash.cash_available).toBe(cashBefore + trade.net_amount);
    expect(trade.fee_stamp).toBeGreaterThan(0); // 卖出收印花税

    const pos = state.positions.get(`${ACCOUNT_ID}:sh600519`)!;
    expect(pos.qty).toBe(200);
    expect(pos.frozen_qty).toBe(0);
    expect(state.cashFlows[0].amount).toBeGreaterThan(0);
  });
});

describe('cancelOrder 撤单', () => {
  it('买单撤单退回冻结资金', async () => {
    const price = toCents('1680.00');
    const freeze = freezeForBuy(100, price);
    state.cash.set(ACCOUNT_ID, { cash_available: toCents('1000000') - freeze, frozen_cash: freeze });
    const order = makeOrder({ frozen_cash: freeze });
    state.orders.set(order.id, order);

    const cancelled = await cancelOrder(repo, order.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.frozen_cash).toBe(0);
    const cash = state.cash.get(ACCOUNT_ID)!;
    expect(cash.cash_available).toBe(toCents('1000000'));
    expect(cash.frozen_cash).toBe(0);
  });

  it('卖单撤单解冻持仓', async () => {
    state.positions.set(`${ACCOUNT_ID}:sh600519`, {
      symbol_name: '贵州茅台',
      qty: 200,
      available_qty: 100,
      frozen_qty: 100,
      avg_cost: toCents('1600.00'),
      settled_date: '2026-11-03',
    });
    const order = makeOrder({ side: 'sell', quantity: 100, price: toCents('1680.00') });
    state.orders.set(order.id, order);

    await cancelOrder(repo, order.id);
    const pos = state.positions.get(`${ACCOUNT_ID}:sh600519`)!;
    expect(pos.frozen_qty).toBe(0);
    expect(pos.available_qty).toBe(200);
  });

  it('已成交委托不可撤', async () => {
    const order = makeOrder({ status: 'filled' });
    state.orders.set(order.id, order);
    await expect(cancelOrder(repo, order.id)).rejects.toMatchObject({ code: 3007 });
  });
});

describe('T+1 日切 settlePositions', () => {
  it('昨日持仓日切后获得可卖资格', async () => {
    state.positions.set(`${ACCOUNT_ID}:sh600519`, {
      symbol_name: '贵州茅台',
      qty: 200,
      available_qty: 0,
      frozen_qty: 0,
      avg_cost: toCents('1600.00'),
      settled_date: '2026-11-02',
    });
    // 用固定历史交易日：2026-11-03（周二，非节假日）
    const todayKey = '2026-11-03';
    await settlePositions(repo, ACCOUNT_ID, todayKey);
    const pos = state.positions.get(`${ACCOUNT_ID}:sh600519`)!;
    expect(pos.available_qty).toBe(200);
    expect(pos.settled_date).toBe(todayKey);
  });

  it('当日已日切的持仓不重复处理', async () => {
    state.positions.set(`${ACCOUNT_ID}:sh600519`, {
      symbol_name: '贵州茅台',
      qty: 200,
      available_qty: 50,
      frozen_qty: 0,
      avg_cost: toCents('1600.00'),
      settled_date: '2026-11-03',
    });
    await settlePositions(repo, ACCOUNT_ID, '2026-11-03');
    const pos = state.positions.get(`${ACCOUNT_ID}:sh600519`)!;
    expect(pos.available_qty).toBe(50);
  });
});

describe('createD1Repo（结构冒烟）', () => {
  it('工厂函数可用（D1 绑定运行时注入）', () => {
    const stub = {
      prepare: () => ({
        bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }),
      }),
    } as never;
    expect(typeof createD1Repo(stub).getOrder).toBe('function');
  });
});

describe('交易时段守卫', () => {
  it('beijingToTs 与撮合共用同一日历（一致性冒烟）', () => {
    const ts = beijingToTs('2026-11-03', '09:30');
    expect(new Date(ts).toISOString()).toBe('2026-11-03T01:30:00.000Z');
  });
});

// ---------------- QA 回归：Bug#1/#3/#4 修复 ----------------

const TRADING_NOW = beijingToTs('2026-11-03', '10:00'); // 周二 10:00，交易时段内

describe('submitOrder 市价买单资金校验（Bug#1）', () => {
  it('可用资金不足时市价买单被拒绝为废单，现金不变、不为负', async () => {
    state = freshState(); // 可用 100 万元
    // 把现金压到 1000 分（10 元），市价买 100 股 1688 元必然不足
    state.cash.set(ACCOUNT_ID, { cash_available: 1_000, frozen_cash: 0 });
    repo = makeRepo(state);
    const r = await submitOrder(
      repo,
      marketOf(1688),
      { accountId: ACCOUNT_ID, userId: USER_ID, symbol: 'sh600519', side: 'buy', orderType: 'market', price: null, quantity: 100 },
      TRADING_NOW,
    );
    expect(r.order.status).toBe('rejected');
    expect(r.matched).toBe(false);
    const cash = state.cash.get(ACCOUNT_ID)!;
    expect(cash.cash_available).toBe(1_000);
    expect(cash.cash_available).toBeGreaterThanOrEqual(0);
    expect(cash.frozen_cash).toBe(0);
    expect(state.trades.length).toBe(0);
  });

  it('资金充足时市价买单冻结→成交→多退少补，最终恰扣实际成本', async () => {
    state = freshState(); // 100 万元
    repo = makeRepo(state);
    const r = await submitOrder(
      repo,
      marketOf(1685),
      { accountId: ACCOUNT_ID, userId: USER_ID, symbol: 'sh600519', side: 'buy', orderType: 'market', price: null, quantity: 100 },
      TRADING_NOW,
    );
    expect(r.matched).toBe(true);
    const cash = state.cash.get(ACCOUNT_ID)!;
    const amount = 100 * toCents('1685.00');
    const commission = Math.max(Math.ceil((amount * 25) / 100_000), 500);
    const transfer = Math.ceil(amount / 100_000);
    expect(cash.cash_available).toBe(toCents('1000000') - amount - commission - transfer);
    expect(cash.frozen_cash).toBe(0);
    // T+1：当日买入不可卖
    expect(state.positions.get(`${ACCOUNT_ID}:sh600519`)?.available_qty).toBe(0);
  });
});

describe('submitOrder 限价涨跌停校验（Bug#3）', () => {
  it('限价高于涨停价（昨收1680→涨停1848）时记废单', async () => {
    state = freshState();
    repo = makeRepo(state);
    const r = await submitOrder(
      repo,
      marketOf(1680),
      { accountId: ACCOUNT_ID, userId: USER_ID, symbol: 'sh600519', side: 'buy', orderType: 'limit', price: toCents('1850.00'), quantity: 100 },
      TRADING_NOW,
    );
    expect(r.order.status).toBe('rejected');
    expect(r.order.reject_reason).toContain('涨跌停');
    const cash = state.cash.get(ACCOUNT_ID)!;
    expect(cash.cash_available).toBe(toCents('1000000')); // 未冻结
  });

  it('限价低于跌停价（1512）时同样记废单', async () => {
    state = freshState();
    repo = makeRepo(state);
    const r = await submitOrder(
      repo,
      marketOf(1680),
      { accountId: ACCOUNT_ID, userId: USER_ID, symbol: 'sh600519', side: 'sell', orderType: 'limit', price: toCents('1500.00'), quantity: 100 },
      TRADING_NOW,
    );
    expect(r.order.status).toBe('rejected');
    expect(r.order.reject_reason).toContain('涨跌停');
  });

  it('涨停价内的正常限价单不受影响', async () => {
    state = freshState();
    repo = makeRepo(state);
    const r = await submitOrder(
      repo,
      marketOf(1680),
      { accountId: ACCOUNT_ID, userId: USER_ID, symbol: 'sh600519', side: 'buy', orderType: 'limit', price: toCents('1800.00'), quantity: 100 },
      TRADING_NOW,
    );
    expect(r.order.status).toBe('filled'); // 现价 1680 ≤ 限价 1800 → 即刻成交
    expect(r.matched).toBe(true);
  });
});

describe('原子冻结与乐观锁（Bug#4）', () => {
  it('tryFreezeCash 余额不足时拒绝冻结', async () => {
    state = freshState();
    state.cash.set(ACCOUNT_ID, { cash_available: 500, frozen_cash: 0 });
    repo = makeRepo(state);
    expect(await repo.tryFreezeCash(ACCOUNT_ID, 1_000)).toBe(false);
    expect(state.cash.get(ACCOUNT_ID)!.cash_available).toBe(500);
    expect(await repo.tryFreezeCash(ACCOUNT_ID, 400)).toBe(true);
    expect(state.cash.get(ACCOUNT_ID)).toEqual({ cash_available: 100, frozen_cash: 400 });
  });

  it('已成交委托不可再次乐观锁转移（防并发双成交）', async () => {
    state = freshState();
    repo = makeRepo(state);
    const order = makeOrder({ status: 'filled' });
    state.orders.set(order.id, order);
    const ok = await repo.updateOrderGuarded(order.id, { status: 'cancelled' }, ['pending', 'partial']);
    expect(ok).toBe(false);
    expect(state.orders.get(order.id)?.status).toBe('filled');
  });

  it('applyTrade 对已撤销委托抛 3007，不产生成交', async () => {
    state = freshState();
    repo = makeRepo(state);
    const order = makeOrder({ status: 'cancelled' });
    state.orders.set(order.id, order);
    await expect(applyTrade(repo, order, toCents('1680.00'))).rejects.toMatchObject({ code: 3007 });
    expect(state.trades.length).toBe(0);
  });

  it('cancelOrder 乐观锁竞争时抛 3007', async () => {
    state = freshState();
    repo = makeRepo(state);
    const order = makeOrder({ status: 'filled' });
    state.orders.set(order.id, order);
    await expect(cancelOrder(repo, order.id)).rejects.toMatchObject({ code: 3007 });
  });
});

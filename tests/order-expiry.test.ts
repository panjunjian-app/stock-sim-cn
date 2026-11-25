/**
 * order-expiry.test.ts — 「委托当日有效」自动失效（P0）回归用例
 *
 * 线上事故：2026-11-23/24 挂出的两笔限价卖单（order 156/174）永远不成交，
 * 把 positions.frozen_qty 冻死（持仓 200 / 可卖 0，UI 还误标为「T+1」），用户无法卖出。
 * 本文件覆盖：跨日失效并释放冻结、当日不失效、买单释放冻结资金、终态订单不受影响、
 *             幂等（连续两次日切不二次释放）、北京日判定、runTick 集成、端到端可卖出。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  expireStaleOrders,
  runTick,
  submitOrder,
  type MatchRepo,
  type OrderRow,
  type TradeRow,
} from '../functions/lib/matching';
import { ORDER_EXPIRED_REASON, isOrderExpired } from '../shared/order-expiry';
import { beijingToTs } from '../shared/trading-calendar';
import { toCents } from '../shared/money';
import type { Quote, Symbol as StockSymbol } from '../shared/types';

// ---------------- 内存 Repo（模拟 D1 行为子集，与 tests/matching.test.ts 同口径） ----------------

interface PosState {
  symbol_name: string;
  qty: number;
  available_qty: number;
  frozen_qty: number;
  avg_cost: number;
  settled_date: string;
}

interface State {
  orders: Map<number, OrderRow>;
  nextOrderId: number;
  trades: TradeRow[];
  nextTradeId: number;
  cash: Map<number, { cash_available: number; frozen_cash: number }>;
  positions: Map<string, PosState>;
  cashFlows: Array<{ account_id: number; type: string; amount: number }>;
  /** adjustCash 调用记录：用于断言「冻结资金只释放一次」 */
  adjustCalls: Array<{ accountId: number; cashDelta: number; frozenDelta: number }>;
}

const ACCOUNT_ID = 14;
const USER_ID = 10;
const SYMBOL = 'sz002415';
const key = (accountId: number, symbol: string): string => `${accountId}:${symbol}`;

function makeRepo(state: State): MatchRepo {
  const putPosition = (p: PosState & { accountId: number; symbol: string }) => {
    state.positions.set(key(p.accountId, p.symbol), {
      symbol_name: p.symbol_name,
      qty: p.qty,
      available_qty: p.available_qty,
      frozen_qty: p.frozen_qty,
      avg_cost: p.avg_cost,
      settled_date: p.settled_date,
    });
  };

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
      state.adjustCalls.push({ accountId, cashDelta, frozenDelta });
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
      const p = state.positions.get(key(accountId, symbol));
      return p ? { id: 0, symbol, ...p } : null;
    },
    async upsertPosition(p) {
      putPosition({
        accountId: p.accountId,
        symbol: p.symbol,
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
      state.cashFlows.push({ account_id: f.account_id, type: f.type, amount: f.amount });
    },
    async settleTradeAtomic({ trade, position, accountId, cashDelta, frozenDelta, cashFlow }) {
      const id = state.nextTradeId++;
      state.trades.push({ ...trade, id });
      putPosition({
        accountId: position.accountId,
        symbol: position.symbol,
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
      state.cashFlows.push({ account_id: cashFlow.account_id, type: cashFlow.type, amount: cashFlow.amount });
      return id;
    },
    async freezeSellAtomic(position, order) {
      putPosition({
        accountId: position.accountId,
        symbol: position.symbol,
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
      return Array.from(state.positions.entries())
        .filter(([, p]) => p.qty > 0 && p.settled_date !== '' && p.settled_date < today)
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

function freshState(): State {
  return {
    orders: new Map(),
    nextOrderId: 1,
    trades: [],
    nextTradeId: 1,
    cash: new Map([[ACCOUNT_ID, { cash_available: toCents('100000'), frozen_cash: 0 }]]),
    positions: new Map(),
    cashFlows: [],
    adjustCalls: [],
  };
}

/** 线上事故的真实形态：跨日挂着的限价卖单把 200 股全冻住（settled_date 早已过 T+1） */
function seedFrozenSell(state: State, over: Partial<OrderRow> = {}): OrderRow {
  state.positions.set(key(ACCOUNT_ID, SYMBOL), {
    symbol_name: '海康威视',
    qty: 200,
    available_qty: 0,
    frozen_qty: 200,
    avg_cost: toCents('35.00'),
    settled_date: '2026-11-25',
  });
  const order: OrderRow = {
    id: 174,
    account_id: ACCOUNT_ID,
    user_id: USER_ID,
    symbol: SYMBOL,
    symbol_name: '海康威视',
    side: 'sell',
    order_type: 'limit',
    price: toCents('36.50'),
    quantity: 200,
    frozen_cash: 0,
    filled_qty: 0,
    avg_price: null,
    status: 'pending',
    reject_reason: null,
    last_check_at: null,
    created_at: '2026-11-24T02:53:26.000Z', // 北京 2026-11-24 10:53（周二）
    updated_at: '2026-11-24T02:53:26.000Z',
    ...over,
  };
  state.orders.set(order.id, order);
  return order;
}

/** 2026-11-26 10:00 北京时间（周四，交易时段内） */
const NOW = beijingToTs('2026-11-26', '10:00');

function makeQuote(over: Partial<Quote> = {}): Quote {
  return {
    symbol: SYMBOL,
    name: '海康威视',
    price: toCents('34.76'),
    prevClose: toCents('34.85'),
    open: toCents('34.80'),
    high: toCents('34.90'),
    low: toCents('34.60'),
    volume: 100000,
    amount: 347600000,
    changePct: -0.26,
    fetchedAt: '2026-11-26T02:00:00.000Z',
    ...over,
  };
}

const marketOf = (over: Partial<Quote> = {}) => ({ fetchQuotes: async (_s: StockSymbol[]) => [makeQuote(over)] });

let state: State;
let repo: MatchRepo;

beforeEach(() => {
  state = freshState();
  repo = makeRepo(state);
});

describe('expireStaleOrders 跨交易日委托自动失效', () => {
  it('①跨日 pending 卖单失效后 frozen_qty 归零、可卖数量恢复为持仓数', async () => {
    seedFrozenSell(state);
    const n = await expireStaleOrders(repo, ACCOUNT_ID, NOW);
    expect(n).toBe(1);

    const order = state.orders.get(174)!;
    expect(order.status).toBe('cancelled');
    expect(order.reject_reason).toBe(ORDER_EXPIRED_REASON);
    // UI 靠该判定区分「系统失效」与「用户主动撤单」
    expect(isOrderExpired({ status: order.status, rejectReason: order.reject_reason })).toBe(true);

    const pos = state.positions.get(key(ACCOUNT_ID, SYMBOL))!;
    expect(pos.frozen_qty).toBe(0);
    expect(pos.available_qty).toBe(200);
    expect(pos.available_qty).toBe(pos.qty); // 可卖 == 持仓
  });

  it('②当日（北京日）pending 卖单不失效，冻结保持不动', async () => {
    seedFrozenSell(state, { created_at: new Date(beijingToTs('2026-11-26', '09:31')).toISOString() });
    const n = await expireStaleOrders(repo, ACCOUNT_ID, NOW);
    expect(n).toBe(0);
    expect(state.orders.get(174)!.status).toBe('pending');
    const pos = state.positions.get(key(ACCOUNT_ID, SYMBOL))!;
    expect(pos.frozen_qty).toBe(200);
    expect(pos.available_qty).toBe(0);
  });

  it('③跨日 pending 买单失效后释放 frozen_cash（可用资金回补）', async () => {
    const freeze = toCents('73300.00');
    state.cash.set(ACCOUNT_ID, { cash_available: toCents('1000000') - freeze, frozen_cash: freeze });
    state.orders.set(179, {
      id: 179,
      account_id: ACCOUNT_ID,
      user_id: USER_ID,
      symbol: 'sh688981',
      symbol_name: '中芯国际',
      side: 'buy',
      order_type: 'limit',
      price: toCents('119.00'),
      quantity: 200,
      frozen_cash: freeze,
      filled_qty: 0,
      avg_price: null,
      status: 'pending',
      reject_reason: null,
      last_check_at: null,
      created_at: '2026-11-24T06:10:00.000Z',
      updated_at: '2026-11-24T06:10:00.000Z',
    });

    const n = await expireStaleOrders(repo, ACCOUNT_ID, NOW);
    expect(n).toBe(1);
    const cash = state.cash.get(ACCOUNT_ID)!;
    expect(cash.cash_available).toBe(toCents('1000000'));
    expect(cash.frozen_cash).toBe(0);
    expect(state.orders.get(179)!.frozen_cash).toBe(0);
    expect(state.orders.get(179)!.status).toBe('cancelled');
  });

  it('④已 filled / cancelled 的委托不受影响，也不释放任何冻结', async () => {
    const filled: OrderRow = {
      id: 300,
      account_id: ACCOUNT_ID,
      user_id: USER_ID,
      symbol: SYMBOL,
      symbol_name: '海康威视',
      side: 'buy',
      order_type: 'limit',
      price: toCents('36.00'),
      quantity: 100,
      frozen_cash: 0,
      filled_qty: 100,
      avg_price: toCents('35.90'),
      status: 'filled',
      reject_reason: null,
      last_check_at: null,
      created_at: '2026-11-20T02:00:00.000Z',
      updated_at: '2026-11-20T02:00:00.000Z',
    };
    const cancelled: OrderRow = {
      ...filled,
      id: 301,
      quantity: 100,
      filled_qty: 0,
      status: 'cancelled',
      avg_price: null,
      reject_reason: null,
    };
    state.orders.set(filled.id, filled);
    state.orders.set(cancelled.id, cancelled);

    const n = await expireStaleOrders(repo, ACCOUNT_ID, NOW);
    expect(n).toBe(0);
    expect(state.orders.get(300)!.status).toBe('filled');
    expect(state.orders.get(301)!.status).toBe('cancelled');
    expect(state.orders.get(301)!.reject_reason).toBeNull(); // 未被打上失效标记
    expect(state.adjustCalls.length).toBe(0);
    expect(state.positions.size).toBe(0);
  });

  it('⑤幂等：连续两次日切只释放一次冻结', async () => {
    seedFrozenSell(state);
    const first = await expireStaleOrders(repo, ACCOUNT_ID, NOW);
    const second = await expireStaleOrders(repo, ACCOUNT_ID, NOW);
    expect(first).toBe(1);
    expect(second).toBe(0);

    const pos = state.positions.get(key(ACCOUNT_ID, SYMBOL))!;
    expect(pos.available_qty).toBe(200); // 没有被二次累加到 400
    expect(pos.frozen_qty).toBe(0);
  });

  it('⑥partial 委托只释放未成交部分', async () => {
    seedFrozenSell(state, { id: 400, quantity: 200, filled_qty: 100, status: 'partial' });
    // 覆盖为 partial 场景的持仓：持仓 300，可卖 100，冻结 200（其中 100 已成交）
    state.positions.set(key(ACCOUNT_ID, SYMBOL), {
      symbol_name: '海康威视',
      qty: 300,
      available_qty: 100,
      frozen_qty: 200,
      avg_cost: toCents('35.00'),
      settled_date: '2026-11-25',
    });

    const n = await expireStaleOrders(repo, ACCOUNT_ID, NOW);
    expect(n).toBe(1);
    const pos = state.positions.get(key(ACCOUNT_ID, SYMBOL))!;
    expect(pos.frozen_qty).toBe(100); // 200 − 未成交 100
    expect(pos.available_qty).toBe(200); // 100 + 100
    expect(pos.qty).toBe(300);
  });

  it('⑦按北京日判定：UTC 日期更早但北京日相同 → 不失效', async () => {
    // 2026-11-25T17:00Z = 北京 2026-11-26 01:00（与 NOW 同一北京交易日）
    seedFrozenSell(state, { created_at: '2026-11-25T17:00:00.000Z' });
    const n = await expireStaleOrders(repo, ACCOUNT_ID, NOW);
    expect(n).toBe(0);
    expect(state.orders.get(174)!.status).toBe('pending');
  });
});

describe('runTick 集成', () => {
  it('tick 先让跨日挂单失效，再日切与撮合（不误成交、不误冻结）', async () => {
    seedFrozenSell(state);
    const matched = await runTick(repo, marketOf(), ACCOUNT_ID, NOW);
    expect(matched).toBe(0);
    expect(state.orders.get(174)!.status).toBe('cancelled');
    expect(isOrderExpired({ status: 'cancelled', rejectReason: state.orders.get(174)!.reject_reason })).toBe(true);
    const pos = state.positions.get(key(ACCOUNT_ID, SYMBOL))!;
    expect(pos.frozen_qty).toBe(0);
    expect(pos.available_qty).toBe(200);
    // 说明：settlePositions 含真实日历门禁（isTradingDayTs），此处不断言 settled_date，避免测试依赖执行当天是否为交易日
  });
});

describe('端到端：事故账户次日即可卖出', () => {
  it('陈旧跨日卖单释放冻结后，卖出委托可成功提交并成交', async () => {
    seedFrozenSell(state);
    const result = await submitOrder(
      repo,
      marketOf(),
      { accountId: ACCOUNT_ID, userId: USER_ID, symbol: SYMBOL, side: 'sell', orderType: 'market', price: null, quantity: 200 },
      NOW,
    );
    expect(result.order.status).toBe('filled');
    expect(result.matched).toBe(true);
    // 陈旧的 174 已被惰性失效，新委托另起 id
    expect(state.orders.get(174)!.status).toBe('cancelled');
    const pos = state.positions.get(key(ACCOUNT_ID, SYMBOL))!;
    expect(pos.qty).toBe(0);
    expect(pos.frozen_qty).toBe(0);
    expect(state.cash.get(ACCOUNT_ID)!.cash_available).toBeGreaterThan(toCents('100000'));
  });
});

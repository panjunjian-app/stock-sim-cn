/**
 * matching.ts — 撮合引擎（§5）
 * 模型：下单即刻撮合 + 客户端行情轮询驱动的 tick 重试（无 Cron、无服务器常驻进程）。
 * 成交价一律取实时最新价，限价仅作为触发门槛；不做部分成交（字段已预留）。
 * 冻结：买入冻结资金（含预估费用）、卖出冻结可卖股；撤单退回；日切解锁 T+1。
 */
import { calcBuyFreeze, calcFees, buyNetAmount, sellNetAmount, DAILY_ORDER_LIMIT } from '../../shared/fees';
import { beijingDateKey, isInTradingHours, isTradingDayTs } from '../../shared/trading-calendar';
import { checkLimitPrice, isStName, priceLimitRange } from '../../shared/validate';
import type { Cents, Quote, Side, Symbol as StockSymbol } from '../../shared/types';
import type { D1Database } from './env';

// ---------------- 仓储接口（便于单测替换内存实现） ----------------

export interface OrderRow {
  id: number;
  account_id: number;
  user_id: number;
  symbol: StockSymbol;
  symbol_name: string;
  side: Side;
  order_type: 'limit' | 'market';
  price: Cents | null;
  quantity: number;
  frozen_cash: number;
  filled_qty: number;
  avg_price: number | null;
  status: 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected';
  reject_reason: string | null;
  last_check_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradeRow {
  id: number;
  order_id: number;
  account_id: number;
  user_id: number;
  symbol: StockSymbol;
  symbol_name: string;
  side: Side;
  price: Cents;
  quantity: number;
  amount: Cents;
  fee_commission: Cents;
  fee_stamp: Cents;
  fee_transfer: Cents;
  net_amount: Cents;
  traded_at: string;
}

export interface CashFlowInsert {
  account_id: number;
  type: 'deposit' | 'buy' | 'sell';
  amount: number;
  balance_after: number;
  ref_id: number | null;
  remark: string;
  created_at: string;
}

export interface AccountCash {
  id: number;
  cash_available: number;
  frozen_cash: number;
}

export interface MatchRepo {
  getOrder(id: number): Promise<OrderRow | null>;
  listOpenOrders(accountId: number): Promise<OrderRow[]>;
  insertOrder(o: Omit<OrderRow, 'id'>): Promise<number>; // 返回新 id
  updateOrder(id: number, patch: Partial<Omit<OrderRow, 'id'>>): Promise<void>;
  getAccountCash(accountId: number): Promise<AccountCash | null>;
  /** 原子条件冻结：cash_available >= amount 时扣减并转入 frozen_cash，返回是否成功（并发安全） */
  tryFreezeCash(accountId: number, amount: number): Promise<boolean>;
  /** 增量调整资金（delta 语义，SQL 侧原子计算，避免读改写丢更新） */
  adjustCash(accountId: number, cashDelta: number, frozenDelta: number): Promise<void>;
  /** 乐观锁状态转移：仅当当前 status ∈ fromStatuses 时应用 patch，返回是否成功 */
  updateOrderGuarded(id: number, patch: Partial<Omit<OrderRow, 'id'>>, fromStatuses: string[]): Promise<boolean>;
  getPosition(accountId: number, symbol: StockSymbol): Promise<{
    id: number;
    symbol_name: string;
    qty: number;
    available_qty: number;
    frozen_qty: number;
    avg_cost: number;
    settled_date: string;
  } | null>;
  upsertPosition(p: {
    accountId: number;
    symbol: StockSymbol;
    symbolName: string;
    qty: number;
    availableQty: number;
    frozenQty: number;
    avgCost: number;
    settledDate: string;
  }): Promise<void>;
  insertTrade(t: Omit<TradeRow, 'id'>): Promise<number>;
  insertCashFlow(f: CashFlowInsert): Promise<void>;
  /**
   * 原子成交结算（持久层安全）：成交记录 + 持仓 + 资金 + 流水 在同一事务内
   * （D1 batch 隐式事务：全部成功或全部回滚，杜绝「订单已成交但资金/持仓没更新」的错乱）。
   * 返回生成的 tradeId。流水 ref_id 用委托 id（trade 表自身有 order_id 关联，可追溯）。
   */
  settleTradeAtomic(payload: {
    trade: Omit<TradeRow, 'id'>;
    position: {
      accountId: number;
      symbol: StockSymbol;
      symbolName: string;
      qty: number;
      availableQty: number;
      frozenQty: number;
      avgCost: number;
      settledDate: string;
    };
    accountId: number;
    cashDelta: number;
    frozenDelta: number;
    cashFlow: CashFlowInsert;
  }): Promise<number>;
  /** 原子卖单冻结：冻结持仓 + 落委托单同一事务，返回 orderId（防止「股被冻住但单没立上」） */
  freezeSellAtomic(
    position: {
      accountId: number;
      symbol: StockSymbol;
      symbolName: string;
      qty: number;
      availableQty: number;
      frozenQty: number;
      avgCost: number;
      settledDate: string;
    },
    order: Omit<OrderRow, 'id'>,
  ): Promise<number>;
  /** 当日（北京时间）该账户委托数（含废单），防刷用 */
  countOrdersToday(accountId: number, dayStartIso: string): Promise<number>;
  /** 日切候选：settled_date < today 的持仓（T+1 解锁） */
  listPositionsBelowSettle(
    accountId: number,
    today: string,
  ): Promise<Array<{
    symbol: StockSymbol;
    symbol_name: string;
    qty: number;
    available_qty: number;
    frozen_qty: number;
    avg_cost: number;
    settled_date: string;
  }>>;
}

export interface MarketQuerier {
  fetchQuotes(symbols: StockSymbol[]): Promise<Quote[]>;
}

// ---------------- D1 仓储实现 ----------------

export function createD1Repo(db: D1Database): MatchRepo {
  const nowIso = () => new Date().toISOString();

  return {
    async getOrder(id) {
      return db.prepare('SELECT * FROM orders WHERE id = ?1').bind(id).first<OrderRow>();
    },
    async listOpenOrders(accountId) {
      const r = await db
        .prepare("SELECT * FROM orders WHERE account_id = ?1 AND status IN ('pending','partial') ORDER BY id ASC")
        .bind(accountId)
        .all<OrderRow>();
      return r.results ?? [];
    },
    async insertOrder(o) {
      const r = await db
        .prepare(
          `INSERT INTO orders
             (account_id, user_id, symbol, symbol_name, side, order_type, price, quantity,
              frozen_cash, filled_qty, avg_price, status, reject_reason, last_check_at, created_at, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)`,
        )
        .bind(
          o.account_id, o.user_id, o.symbol, o.symbol_name, o.side, o.order_type,
          o.price, o.quantity, o.frozen_cash, o.filled_qty, o.avg_price,
          o.status, o.reject_reason, o.last_check_at, o.created_at,
        )
        .run();
      return (r.meta?.row_id ?? r.meta?.last_row_id) as number;
    },
    async updateOrder(id, patch) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      const allow = new Set([
        'status', 'filled_qty', 'avg_price', 'frozen_cash', 'reject_reason', 'last_check_at', 'updated_at',
      ]);
      const full = { ...patch, updated_at: patch.updated_at ?? nowIso() };
      for (const [k, v] of Object.entries(full)) {
        if (!allow.has(k)) continue;
        sets.push(`${k} = ?${vals.length + 2}`);
        vals.push(v);
      }
      await db
        .prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?1`)
        .bind(id, ...vals)
        .run();
    },
    async getAccountCash(accountId) {
      return db
        .prepare('SELECT id, cash_available, frozen_cash FROM trade_accounts WHERE id = ?1')
        .bind(accountId)
        .first<AccountCash>();
    },
    async tryFreezeCash(accountId, amount) {
      const r = await db
        .prepare(
          'UPDATE trade_accounts SET cash_available = cash_available - ?2, frozen_cash = frozen_cash + ?3 WHERE id = ?1 AND cash_available >= ?2',
        )
        .bind(accountId, amount, amount)
        .run();
      return (r.meta?.changes ?? 0) === 1;
    },
    async adjustCash(accountId, cashDelta, frozenDelta) {
      await db
        .prepare('UPDATE trade_accounts SET cash_available = cash_available + ?2, frozen_cash = frozen_cash + ?3 WHERE id = ?1')
        .bind(accountId, cashDelta, frozenDelta)
        .run();
    },
    async updateOrderGuarded(id, patch, fromStatuses) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      const allow = new Set(['status', 'filled_qty', 'avg_price', 'frozen_cash', 'reject_reason', 'last_check_at', 'updated_at']);
      const full = { ...patch, updated_at: patch.updated_at ?? nowIso() };
      for (const [k, v] of Object.entries(full)) {
        if (!allow.has(k)) continue;
        sets.push(`${k} = ?${vals.length + 2}`);
        vals.push(v);
      }
      const placeholders = fromStatuses.map((_, i) => `?${vals.length + 2 + i}`).join(',');
      const r = await db
        .prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?1 AND status IN (${placeholders})`)
        .bind(id, ...vals, ...fromStatuses)
        .run();
      return (r.meta?.changes ?? 0) === 1;
    },
    async getPosition(accountId, symbol) {
      return db
        .prepare('SELECT * FROM positions WHERE account_id = ?1 AND symbol = ?2')
        .bind(accountId, symbol)
        .first<{
          id: number;
          symbol_name: string;
          qty: number;
          available_qty: number;
          frozen_qty: number;
          avg_cost: number;
          settled_date: string;
        }>();
    },
    async upsertPosition(p) {
      await db
        .prepare(
          `INSERT INTO positions (account_id, symbol, symbol_name, qty, available_qty, frozen_qty, avg_cost, settled_date, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
           ON CONFLICT (account_id, symbol) DO UPDATE SET
             symbol_name = excluded.symbol_name,
             qty = excluded.qty,
             available_qty = excluded.available_qty,
             frozen_qty = excluded.frozen_qty,
             avg_cost = excluded.avg_cost,
             settled_date = excluded.settled_date,
             updated_at = excluded.updated_at`,
        )
        .bind(p.accountId, p.symbol, p.symbolName, p.qty, p.availableQty, p.frozenQty, p.avgCost, p.settledDate, nowIso())
        .run();
    },
    async insertTrade(t) {
      const r = await db
        .prepare(
          `INSERT INTO trades
             (account_id, order_id, user_id, symbol, symbol_name, side, price, quantity, amount,
              fee_commission, fee_stamp, fee_transfer, net_amount, traded_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`,
        )
        .bind(
          t.account_id, t.order_id, t.user_id, t.symbol, t.symbol_name, t.side,
          t.price, t.quantity, t.amount, t.fee_commission, t.fee_stamp, t.fee_transfer,
          t.net_amount, t.traded_at,
        )
        .run();
      return (r.meta?.row_id ?? r.meta?.last_row_id) as number;
    },
    async insertCashFlow(f) {
      await db
        .prepare(
          `INSERT INTO cash_flows (account_id, type, amount, balance_after, ref_id, remark, created_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7)`,
        )
        .bind(f.account_id, f.type, f.amount, f.balance_after, f.ref_id, f.remark, f.created_at)
        .run();
    },
    async settleTradeAtomic({ trade, position, accountId, cashDelta, frozenDelta, cashFlow }) {
      // D1 batch = 隐式事务：任一语句失败全部回滚，资金/持仓/成交/流水永不错乱
      const res = await db.batch([
        db
          .prepare(
            `INSERT INTO trades
               (account_id, order_id, user_id, symbol, symbol_name, side, price, quantity, amount,
                fee_commission, fee_stamp, fee_transfer, net_amount, traded_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`,
          )
          .bind(
            trade.account_id, trade.order_id, trade.user_id, trade.symbol, trade.symbol_name, trade.side,
            trade.price, trade.quantity, trade.amount, trade.fee_commission, trade.fee_stamp,
            trade.fee_transfer, trade.net_amount, trade.traded_at,
          ),
        db
          .prepare(
            `INSERT INTO positions (account_id, symbol, symbol_name, qty, available_qty, frozen_qty, avg_cost, settled_date, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT (account_id, symbol) DO UPDATE SET
               symbol_name = excluded.symbol_name,
               qty = excluded.qty,
               available_qty = excluded.available_qty,
               frozen_qty = excluded.frozen_qty,
               avg_cost = excluded.avg_cost,
               settled_date = excluded.settled_date,
               updated_at = excluded.updated_at`,
          )
          .bind(
            position.accountId, position.symbol, position.symbolName, position.qty, position.availableQty,
            position.frozenQty, position.avgCost, position.settledDate, nowIso(),
          ),
        db
          .prepare('UPDATE trade_accounts SET cash_available = cash_available + ?2, frozen_cash = frozen_cash + ?3 WHERE id = ?1')
          .bind(accountId, cashDelta, frozenDelta),
        db
          .prepare(
            `INSERT INTO cash_flows (account_id, type, amount, balance_after, ref_id, remark, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7)`,
          )
          .bind(cashFlow.account_id, cashFlow.type, cashFlow.amount, cashFlow.balance_after, cashFlow.ref_id, cashFlow.remark, cashFlow.created_at),
      ]);
      return (res[0]?.meta?.row_id ?? res[0]?.meta?.last_row_id) as number;
    },
    async freezeSellAtomic(position, order) {
      const res = await db.batch([
        db
          .prepare(
            `INSERT INTO positions (account_id, symbol, symbol_name, qty, available_qty, frozen_qty, avg_cost, settled_date, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT (account_id, symbol) DO UPDATE SET
               symbol_name = excluded.symbol_name,
               qty = excluded.qty,
               available_qty = excluded.available_qty,
               frozen_qty = excluded.frozen_qty,
               avg_cost = excluded.avg_cost,
               settled_date = excluded.settled_date,
               updated_at = excluded.updated_at`,
          )
          .bind(
            position.accountId, position.symbol, position.symbolName, position.qty, position.availableQty,
            position.frozenQty, position.avgCost, position.settledDate, nowIso(),
          ),
        db
          .prepare(
            `INSERT INTO orders
               (account_id, user_id, symbol, symbol_name, side, order_type, price, quantity,
                frozen_cash, filled_qty, avg_price, status, reject_reason, last_check_at, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)`,
          )
          .bind(
            order.account_id, order.user_id, order.symbol, order.symbol_name, order.side, order.order_type,
            order.price, order.quantity, order.frozen_cash, order.filled_qty, order.avg_price,
            order.status, order.reject_reason, order.last_check_at, order.created_at,
          ),
      ]);
      return (res[1]?.meta?.row_id ?? res[1]?.meta?.last_row_id) as number;
    },
    async countOrdersToday(accountId, dayStartIso) {
      const r = await db
        .prepare('SELECT COUNT(*) AS c FROM orders WHERE account_id = ?1 AND created_at >= ?2')
        .bind(accountId, dayStartIso)
        .first<{ c: number }>();
      return r?.c ?? 0;
    },
    async listPositionsBelowSettle(accountId, today) {
      const r = await db
        .prepare("SELECT * FROM positions WHERE account_id = ?1 AND qty > 0 AND (settled_date = '' OR settled_date < ?2)")
        .bind(accountId, today)
        .all<{
          symbol: StockSymbol;
          symbol_name: string;
          qty: number;
          available_qty: number;
          frozen_qty: number;
          avg_cost: number;
          settled_date: string;
        }>();
      return r.results ?? [];
    },
  };
}

// ---------------- 撮合核心 ----------------

export interface SubmitOrderInput {
  accountId: number;
  userId: number;
  symbol: StockSymbol;
  side: Side;
  orderType: 'limit' | 'market';
  price: Cents | null;
  quantity: number;
}

export interface SubmitOrderResult {
  order: OrderRow;
  matched: boolean;
  trade?: TradeRow;
}

export class MatchError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/** 计算买单冻结金额（限价单） */
export function freezeForBuy(quantity: number, price: Cents): Cents {
  return calcBuyFreeze(quantity, price);
}

/** 撤单：退回冻结资金/持仓，置 cancelled（乐观锁防并发双撤） */
export async function cancelOrder(repo: MatchRepo, orderId: number): Promise<OrderRow> {
  const order = await repo.getOrder(orderId);
  if (!order) {
    throw new MatchError(4004, '委托不存在');
  }
  if (order.status !== 'pending' && order.status !== 'partial') {
    throw new MatchError(3007, '该委托当前状态不可撤销');
  }
  // 先乐观锁占位状态，防止与 tick 撮合并发双释放
  const guarded = await repo.updateOrderGuarded(
    order.id,
    { status: 'cancelled', frozen_cash: order.side === 'buy' ? 0 : order.frozen_cash, updated_at: new Date().toISOString() },
    ['pending', 'partial'],
  );
  if (!guarded) {
    throw new MatchError(3007, '该委托刚被处理（成交或撤销），请刷新查看');
  }
  if (order.side === 'buy' && order.frozen_cash > 0) {
    // 增量退回冻结资金（原子计算）
    await repo.adjustCash(order.account_id, order.frozen_cash, -order.frozen_cash);
  } else if (order.side === 'sell') {
    const pos = await repo.getPosition(order.account_id, order.symbol);
    if (pos) {
      await repo.upsertPosition({
        accountId: order.account_id,
        symbol: order.symbol,
        symbolName: order.symbol_name,
        qty: pos.qty,
        availableQty: pos.available_qty + order.quantity - order.filled_qty,
        frozenQty: Math.max(pos.frozen_qty - (order.quantity - order.filled_qty), 0),
        avgCost: pos.avg_cost,
        settledDate: pos.settled_date,
      });
    }
  }
  const updated = await repo.getOrder(orderId);
  return updated as OrderRow;
}

/** T+1 日切：settled_date < 今日交易日的持仓解锁为可卖（available = qty - frozen） */
export async function settlePositions(repo: MatchRepo, accountId: number, todayKey?: string): Promise<void> {
  const today = todayKey ?? beijingDateKey();
  if (!isTradingDayTs()) {
    return; // 非交易日不日切
  }
  const rows = await repo.listPositionsBelowSettle(accountId, today);
  for (const p of rows) {
    await repo.upsertPosition({
      accountId,
      symbol: p.symbol,
      symbolName: p.symbol_name,
      qty: p.qty,
      availableQty: p.qty - p.frozen_qty,
      frozenQty: p.frozen_qty,
      avgCost: p.avg_cost,
      settledDate: today,
    });
  }
}

/**
 * 尝试撮合一笔委托。
 * 可成交条件（§5.2）：行情可用且 price>0；市价单直接按最新价；
 * 限价买单 最新价 ≤ 限价；限价卖单 最新价 ≥ 限价；且未封板。
 * 成交后：写成交、更新委托/持仓/资金/流水。
 */
export async function tryMatch(repo: MatchRepo, market: MarketQuerier, order: OrderRow): Promise<{ matched: boolean; trade?: TradeRow }> {
  if (order.status !== 'pending' && order.status !== 'partial') {
    return { matched: false };
  }
  let quotes: Quote[];
  try {
    quotes = await market.fetchQuotes([order.symbol]);
  } catch {
    return { matched: false }; // 行情不可用：保单重试
  }
  const quote = quotes.find((q) => q.symbol === order.symbol);
  if (!quote || quote.price <= 0) {
    return { matched: false };
  }
  await repo.updateOrder(order.id, { last_check_at: new Date().toISOString() });

  const { limitUp, limitDown } = priceLimitRange(quote.prevClose, isStName(quote.name));

  let fillPrice: Cents | null = null;
  if (order.order_type === 'market') {
    fillPrice = quote.price; // 市价：直接按最新价成交（不设滑点）
  } else if (order.side === 'buy' && quote.price <= (order.price ?? 0)) {
    if (quote.price < limitUp) {
      fillPrice = quote.price; // 未封涨停才可买
    }
  } else if (order.side === 'sell' && quote.price >= (order.price ?? Number.MAX_SAFE_INTEGER)) {
    if (quote.price > limitDown) {
      fillPrice = quote.price; // 未封跌停才可卖
    }
  }
  if (fillPrice === null) {
    return { matched: false };
  }
  try {
    const trade = await applyTrade(repo, order, fillPrice);
    return { matched: true, trade };
  } catch (e) {
    // 并发下委托已被其他请求成交/撤销：保本单不重复结算
    if (e instanceof MatchError && e.code === 3007) {
      return { matched: false };
    }
    throw e;
  }
}

/** 成交结算：写成交单 + 乐观锁完结委托 + 持仓 + 资金（多退少补，增量原子）+ 流水 */
export async function applyTrade(repo: MatchRepo, order: OrderRow, fillPrice: Cents): Promise<TradeRow> {
  const acc = await repo.getAccountCash(order.account_id);
  if (!acc) {
    throw new MatchError(4004, '账户不存在');
  }
  const nowIso = new Date().toISOString();
  const todayKey = beijingDateKey(Date.parse(nowIso));
  const amount = fillPrice * order.quantity;
  const fees = calcFees(amount, order.side);

  // 0. 乐观锁占位：仅 pending/partial 可完结（防 tick 与撤单并发双花）
  const guarded = await repo.updateOrderGuarded(
    order.id,
    { status: 'filled', filled_qty: order.quantity, avg_price: fillPrice, updated_at: nowIso },
    ['pending', 'partial'],
  );
  if (!guarded) {
    throw new MatchError(3007, '委托状态已变更，无法重复成交');
  }

  const pos = await repo.getPosition(order.account_id, order.symbol);

  // 1~4. 原子结算：成交记录 + 持仓 + 资金 + 流水 同一事务（任一步失败全部回滚，杜绝错乱）
  const netAmount = order.side === 'buy' ? -buyNetAmount(amount, fees) : sellNetAmount(amount, fees);
  const remark =
    order.side === 'buy'
      ? `买入 ${order.symbol_name} ${order.quantity}股 @${(fillPrice / 100).toFixed(2)} 佣金${(fees.commission / 100).toFixed(2)} 过户费${(fees.transfer / 100).toFixed(2)}`
      : `卖出 ${order.symbol_name} ${order.quantity}股 @${(fillPrice / 100).toFixed(2)} 佣金${(fees.commission / 100).toFixed(2)} 印花税${(fees.stamp / 100).toFixed(2)} 过户费${(fees.transfer / 100).toFixed(2)}`;

  let cashDelta: number;
  let frozenDelta = 0;
  if (order.side === 'buy') {
    // 实际扣款 = 成交额 + 实际费用；冻结多退少补（delta = actualCost - frozen）
    const actualCost = buyNetAmount(amount, fees);
    cashDelta = -(actualCost - order.frozen_cash);
    frozenDelta = -order.frozen_cash;
  } else {
    cashDelta = sellNetAmount(amount, fees);
  }

  // 持仓目标值（T+1：买入当日不可卖；成本摊薄含费用）
  const oldQty = pos?.qty ?? 0;
  const positionPayload =
    order.side === 'buy'
      ? {
          accountId: order.account_id,
          symbol: order.symbol,
          symbolName: order.symbol_name,
          qty: oldQty + order.quantity,
          availableQty: pos?.available_qty ?? 0, // 当日买入不可卖；已有持仓次日日切解锁
          frozenQty: pos?.frozen_qty ?? 0,
          // 摊薄成本保留万分位精度（SQLite NUMERIC 亲和可存 REAL）：
          // 取整会导致 Σ(qty×avg_cost) 与净买入总额产生每股最多 0.5 分的累计偏差，账户级盈亏对不上账
          avgCost: Number((((pos?.avg_cost ?? 0) * oldQty + buyNetAmount(amount, fees)) / (oldQty + order.quantity)).toFixed(4)),
          settledDate: pos?.settled_date ?? '',
        }
      : {
          accountId: order.account_id,
          symbol: order.symbol,
          symbolName: order.symbol_name,
          qty: oldQty - order.quantity,
          availableQty: Math.max((pos?.available_qty ?? 0) - order.quantity, 0),
          frozenQty: Math.max((pos?.frozen_qty ?? 0) - order.quantity, 0),
          avgCost: pos?.avg_cost ?? 0,
          settledDate: pos?.settled_date ?? '',
        };

  const tradeId = await repo.settleTradeAtomic({
    trade: {
      account_id: order.account_id,
      order_id: order.id,
      user_id: order.user_id,
      symbol: order.symbol,
      symbol_name: order.symbol_name,
      side: order.side,
      price: fillPrice,
      quantity: order.quantity,
      amount,
      fee_commission: fees.commission,
      fee_stamp: fees.stamp,
      fee_transfer: fees.transfer,
      net_amount: netAmount,
      traded_at: nowIso,
    },
    position: positionPayload,
    accountId: order.account_id,
    cashDelta,
    frozenDelta,
    cashFlow: {
      account_id: order.account_id,
      type: order.side,
      amount: netAmount,
      balance_after: acc.cash_available + cashDelta,
      ref_id: order.id, // 关联委托（trade 表自带 order_id 双向可追溯）
      remark,
      created_at: nowIso,
    },
  });

  const trade = await (repo as MatchRepo & { getTrade?: (id: number) => Promise<TradeRow | null> }).getTrade?.(tradeId);
  if (trade) {
    return trade;
  }
  return {
    id: tradeId,
    order_id: order.id,
    account_id: order.account_id,
    user_id: order.user_id,
    symbol: order.symbol,
    symbol_name: order.symbol_name,
    side: order.side,
    price: fillPrice,
    quantity: order.quantity,
    amount,
    fee_commission: fees.commission,
    fee_stamp: fees.stamp,
    fee_transfer: fees.transfer,
    net_amount: netAmount,
    traded_at: nowIso,
  };
}

/** 下单入口：校验（时段/防刷/涨跌停/冻结）→ 原子冻结 → 落库 → 即刻撮合（now 可注入便于测试） */
export async function submitOrder(
  repo: MatchRepo,
  market: MarketQuerier,
  input: SubmitOrderInput,
  now: number = Date.now(),
): Promise<SubmitOrderResult> {
  // 1. 交易时段守卫
  if (!isInTradingHours(now)) {
    throw new MatchError(3001, '当前非交易时段（9:30-11:30 / 13:00-15:00）');
  }
  // 2. 防刷：当日委托 < 200 笔
  const todayStartIso = new Date(beijingDateKey(now) + 'T00:00:00+08:00').toISOString();
  const todayCount = await repo.countOrdersToday(input.accountId, todayStartIso);
  if (todayCount >= DAILY_ORDER_LIMIT) {
    throw new MatchError(3005, '今日委托笔数已达上限（200 笔）');
  }
  // 3. 行情可用（未停牌）
  let quotes: Quote[];
  try {
    quotes = await market.fetchQuotes([input.symbol]);
  } catch {
    throw new MatchError(3006, '行情暂不可用，无法委托（可能停牌）');
  }
  const quote = quotes.find((q) => q.symbol === input.symbol);
  if (!quote || quote.price <= 0) {
    throw new MatchError(3006, '行情暂不可用，无法委托（可能停牌）');
  }
  const nowIso = new Date(now).toISOString();

  const baseRow: Omit<OrderRow, 'id'> = {
    account_id: input.accountId,
    user_id: input.userId,
    symbol: input.symbol,
    symbol_name: quote.name,
    side: input.side,
    order_type: input.orderType,
    price: input.orderType === 'limit' ? input.price : null,
    quantity: input.quantity,
    frozen_cash: 0,
    filled_qty: 0,
    avg_price: null,
    status: 'pending',
    reject_reason: null,
    last_check_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  // 4. 账户存在性 + 涨跌停校验（废单不落冻结/不占持仓，但计入防刷额度）
  const acc = await repo.getAccountCash(input.accountId);
  if (!acc) {
    throw new MatchError(4004, '账户不存在');
  }
  // Known Issue#1：限价单买卖两方向统一校验涨跌停（架构 §4.3），越界记 rejected
  if (input.orderType === 'limit') {
    const priceCheck = checkLimitPrice(input.price as Cents, quote.prevClose, isStName(quote.name));
    if (!priceCheck.ok) {
      const rejRow: Omit<OrderRow, 'id'> = { ...baseRow, status: 'rejected', reject_reason: priceCheck.reason ?? '委托价格超出涨跌停范围' };
      const id = await repo.insertOrder(rejRow);
      return { order: { ...rejRow, id } as OrderRow, matched: false };
    }
  }
  if (input.side === 'buy') {
    // Bug#1：市价单与限价单统一走「按最新价预估冻结」路径，杜绝现金买成负数
    const freezePrice = input.orderType === 'limit' ? (input.price as Cents) : quote.price;
    const need = freezeForBuy(input.quantity, freezePrice);
    // Bug#4：原子条件冻结（cash_available >= need 才扣减），并发安全
    const frozen = await repo.tryFreezeCash(input.accountId, need);
    if (!frozen) {
      const rejRow: Omit<OrderRow, 'id'> = { ...baseRow, status: 'rejected', reject_reason: '可用资金不足' };
      const id = await repo.insertOrder(rejRow);
      return { order: { ...rejRow, id } as OrderRow, matched: false };
    }
    const id = await repo.insertOrder({ ...baseRow, frozen_cash: need });
    const order = await repo.getOrder(id);
    const r = await tryMatch(repo, market, order as OrderRow);
    return { order: (await repo.getOrder(id)) as OrderRow, matched: r.matched, trade: r.trade };
  }

  // 卖出：校验可卖数量（available - frozen）并冻结
  const pos = await repo.getPosition(input.accountId, input.symbol);
  const sellable = (pos?.available_qty ?? 0) - (pos?.frozen_qty ?? 0);
  if (!pos || sellable < input.quantity) {
    const rejRow: Omit<OrderRow, 'id'> = { ...baseRow, status: 'rejected', reject_reason: '可卖数量不足' };
    const id = await repo.insertOrder(rejRow);
    return { order: { ...rejRow, id } as OrderRow, matched: false };
  }
  // 原子：冻结持仓 + 落委托单同一事务（防「股被冻住但单没立上」）
  const id = await repo.freezeSellAtomic(
    {
      accountId: input.accountId,
      symbol: input.symbol,
      symbolName: pos.symbol_name,
      qty: pos.qty,
      availableQty: pos.available_qty,
      frozenQty: pos.frozen_qty + input.quantity,
      avgCost: pos.avg_cost,
      settledDate: pos.settled_date,
    },
    baseRow,
  );
  const order = await repo.getOrder(id);
  const r = await tryMatch(repo, market, order as OrderRow);
  return { order: (await repo.getOrder(id)) as OrderRow, matched: r.matched, trade: r.trade };
}

/** tick：处理账户全部未成交委托（幂等：无 open 委托返回 0） */
export async function runTick(repo: MatchRepo, market: MarketQuerier, accountId: number): Promise<number> {
  const todayKey = beijingDateKey();
  // 日切结算优先（T+1 解锁 + 遗留委托处理）
  await settlePositions(repo, accountId, todayKey);
  const open = await repo.listOpenOrders(accountId);
  let matchedCount = 0;
  for (const o of open) {
    const fresh = await repo.getOrder(o.id);
    if (!fresh) continue;
    const r = await tryMatch(repo, market, fresh);
    if (r.matched) {
      matchedCount++;
    }
  }
  return matchedCount;
}

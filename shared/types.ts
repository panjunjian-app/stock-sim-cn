/**
 * shared/types.ts — 前后端共享领域类型（唯一类型入口）
 * 约定：金额一律整数「分」（Cents）；时间一律 ISO 8601 UTC 字符串；
 *       交易日为北京时间 'YYYY-MM-DD'；股票代码统一小写 'sh600519' / 'sz000001'。
 */

export type Symbol = string; // 'sh600519'
export type Side = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';
export type OrderStatus = 'pending' | 'partial' | 'filled' | 'cancelled' | 'rejected';

/** 全链路金额单位：分（整数） */
export type Cents = number;

/** 当前登录用户（API 返回的最小用户信息） */
export interface User {
  id: number;
  email: string;
}

/** 行情快照（代理接口返回，价格字段为分） */
export interface Quote {
  symbol: Symbol;
  name: string;
  price: Cents;
  prevClose: Cents;
  open: Cents;
  high: Cents;
  low: Cents;
  /** 成交量（手） */
  volume: number;
  /** 成交额（分） */
  amount: Cents;
  /** 涨跌幅（百分数，两位小数），如 2.35 */
  changePct: number;
  /** 上游抓取时间，ISO UTC */
  fetchedAt: string;
}

/** K 线单根（展示层用元为单位，不参与费用计算） */
export interface KLineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export type KLinePeriod = 'day' | 'week' | 'month';

/** 分时单点（元为单位） */
export interface MinutePoint {
  /** 'HH:mm' 北京时间 */
  time: string;
  price: number;
  avgPrice: number;
  volume: number;
}

export interface MinuteSeries {
  points: MinutePoint[];
  prevClose: number;
}

/** 委托（API DTO） */
export interface Order {
  id: number;
  accountId: number;
  symbol: Symbol;
  symbolName: string;
  side: Side;
  orderType: OrderType;
  price: Cents | null;
  quantity: number;
  frozenCash: Cents;
  filledQty: number;
  avgPrice: Cents | null;
  status: OrderStatus;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 下单请求体 */
export interface OrderInput {
  symbol: Symbol;
  side: Side;
  orderType: OrderType;
  /** 限价（分）；市价单不传或传 null */
  price?: Cents | null;
  quantity: number;
}

/** 持仓（API DTO，lastPrice/marketValue/pnl 由前端合并快照计算） */
export interface Position {
  symbol: Symbol;
  symbolName: string;
  qty: number;
  availableQty: number;
  frozenQty: number;
  /** 摊薄成本（分） */
  avgCost: Cents;
  /** 由前端用快照合并 */
  lastPrice: Cents;
  /** 前端计算展示 */
  marketValue: Cents;
  pnl: Cents;
  pnlPct: number;
}

/** 账户总览（后端只给现金与累计入金基础值；市值/总资产/盈亏由前端合并快照计算） */
export interface AccountOverview {
  accountId: number;
  name: string;
  cashAvailable: Cents;
  frozenCash: Cents;
  /** 累计入金 = init_cash + Σ deposit 流水（分） */
  totalDeposit: Cents;
  /** 持仓市值 = Σ qty×最新价（前端合并快照） */
  marketValue: Cents;
  /** 可用 + 冻结 + 市值 */
  totalAsset: Cents;
  /** 当日盈亏（对昨收） */
  dayPnl: Cents;
  dayPnlPct: number;
  /** 累计盈亏（对累计入金） */
  totalPnl: Cents;
  totalPnlPct: number;
}

/** 交易账户（列表 DTO） */
export interface AccountInfo {
  id: number;
  name: string;
  cashAvailable: Cents;
  frozenCash: Cents;
  initCash: Cents;
  createdAt: string;
  /** 持仓股票数 */
  positionsCount: number;
  /** 累计入金（分）= init_cash + Σ deposit 流水 */
  totalDeposit: Cents;
  /** 持仓简表（供列表页合并行情计算总资产） */
  positionSymbols: Array<{ symbol: Symbol; symbolName: string; qty: number; avgCost: Cents }>;
}

/** 成交（交割单 DTO） */
export interface Trade {
  id: number;
  orderId: number;
  symbol: Symbol;
  symbolName: string;
  side: Side;
  price: Cents;
  quantity: number;
  amount: Cents;
  feeCommission: Cents;
  feeStamp: Cents;
  feeTransfer: Cents;
  netAmount: Cents;
  tradedAt: string;
}

/** 资金流水 DTO */
export interface CashFlow {
  id: number;
  type: 'deposit' | 'buy' | 'sell';
  amount: Cents;
  balanceAfter: Cents;
  refId: number | null;
  remark: string;
  createdAt: string;
}

/** 统一 API 响应信封 */
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// ==================== BI 报表（/api/bi/*） ====================

/** BI 时间范围 */
export type BiRange = '7d' | '30d' | '90d' | 'ytd' | 'all';

/** 账户维度：all=全部账户汇总，否则为账户 id 字符串 */
export type BiAcct = 'all' | string;

/** 资产净值序列点（金额为分） */
export interface BiNavPoint {
  date: string;
  totalAssets: Cents;
  /** 以区间首日资产归一为 1.0 的净值 */
  nav: number;
}

/** 每日盈亏序列点（分） */
export interface BiDailyPnlPoint {
  date: string;
  pnl: Cents;
}

/** KPI 卡片组（金额为分，比率为百分数两位小数） */
export interface BiKpi {
  totalAssets: Cents;
  rangeReturnPct: number;
  rangePnl: Cents;
  dayPnl: Cents;
  realizedPnl: Cents;
  unrealizedPnl: Cents;
  maxDrawdownPct: number;
  maxDrawdownDate: string | null;
}

/** 持仓对比行（成本 vs 现价） */
export interface BiPositionRow {
  symbol: Symbol;
  name: string;
  qty: number;
  avgCost: Cents;
  price: Cents;
  marketValue: Cents;
  pnl: Cents;
  pnlPct: number;
  weightPct: number;
}

/** 资产构成扇区 */
export interface BiAllocationSlice {
  name: string;
  value: Cents;
  pct: number;
}

/** 个股盈亏贡献项 */
export interface BiContributionItem {
  symbol: Symbol;
  name: string;
  pnl: Cents;
  pct: number;
}

/** BI 聚合报表（GET /api/bi/report） */
export interface BiReport {
  range: BiRange;
  acct: BiAcct;
  accounts: Array<{ id: number; name: string }>;
  kpi: BiKpi;
  navSeries: BiNavPoint[];
  dailyPnlSeries: BiDailyPnlPoint[];
  positions: BiPositionRow[];
  allocation: BiAllocationSlice[];
  concentration: { top1Pct: number; top5Pct: number };
  topContribution: BiContributionItem[];
  pnlRatio: BiContributionItem[];
  replay: { triggered: boolean; filledDays: number; complete: boolean };
}

/** 快照上报响应（POST /api/bi/snapshot） */
export interface BiSnapshotResult {
  date: string;
  accounts: Array<{ accountId: number; action: 'created' | 'updated' | 'skipped' }>;
}

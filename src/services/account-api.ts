import { apiDelete, apiGet, apiPost } from './http';
import type {
  AccountInfo,
  AccountOverview,
  CashFlow,
  Order,
  OrderInput,
  Position,
  Symbol as StockSymbol,
  Trade,
} from '../../shared/types';

export interface AccountBase {
  id: number;
  name: string;
  cashAvailable: number;
  frozenCash: number;
  initCash: number;
  createdAt: string;
  totalDeposit: number;
}

export interface OrderResult {
  order: Order;
  matched: boolean;
  trade?: Trade;
}

export const accountApi = {
  listAccounts(): Promise<{ accounts: AccountInfo[] }> {
    return apiGet('/api/accounts');
  },
  openAccount(name: string, initCash: number): Promise<{ account: AccountBase }> {
    return apiPost('/api/accounts', { name, initCash });
  },
  getAccount(id: number): Promise<{ account: AccountBase }> {
    return apiGet(`/api/accounts/${id}`);
  },
  deleteAccount(id: number): Promise<Record<string, never>> {
    return apiDelete(`/api/accounts/${id}`);
  },
  /** 总览基础值（市值/盈亏由前端合并快照计算） */
  getOverview(id: number): Promise<{ overview: Omit<AccountOverview, 'marketValue' | 'totalAsset' | 'dayPnl' | 'dayPnlPct' | 'totalPnl' | 'totalPnlPct'> }> {
    return apiGet(`/api/accounts/${id}/overview`);
  },
  deposit(id: number, amount: number): Promise<{ cashFlow: CashFlow }> {
    return apiPost(`/api/accounts/${id}/deposit`, { amount });
  },
  getPositions(id: number): Promise<{ positions: Position[] }> {
    return apiGet(`/api/accounts/${id}/positions`);
  },
  getOrders(id: number, status?: string): Promise<{ orders: Order[] }> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiGet(`/api/accounts/${id}/orders${q}`);
  },
  submitOrder(id: number, input: OrderInput): Promise<OrderResult> {
    return apiPost(`/api/accounts/${id}/orders`, input);
  },
  cancelOrder(orderId: number): Promise<{ order: Order }> {
    return apiPost(`/api/orders/${orderId}/cancel`);
  },
  getTrades(id: number, page = 1, pageSize = 20): Promise<{ trades: Trade[]; total: number; page: number; pageSize: number }> {
    return apiGet(`/api/accounts/${id}/trades?page=${page}&pageSize=${pageSize}`);
  },
  getCashFlows(id: number, page = 1, pageSize = 20): Promise<{ cashFlows: CashFlow[]; total: number; page: number; pageSize: number }> {
    return apiGet(`/api/accounts/${id}/cash-flows?page=${page}&pageSize=${pageSize}`);
  },
  /** 撮合重试（轮询驱动，幂等） */
  tick(accountId: number): Promise<{ matchedCount: number }> {
    return apiPost('/api/market/tick', { accountId });
  },
};

/** 持仓 symbol 集合（供行情轮询合并） */
export function collectSymbols(accounts: AccountInfo[]): StockSymbol[] {
  const set = new Set<StockSymbol>();
  for (const a of accounts) {
    for (const p of a.positionSymbols) {
      set.add(p.symbol);
    }
  }
  return Array.from(set);
}

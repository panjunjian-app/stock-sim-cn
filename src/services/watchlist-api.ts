import { apiDelete, apiGet, apiPost } from './http';

export interface WatchlistItem {
  symbol: string; // sh600519 / sz300308
  name: string;
}

/** 自选股（登录用户维度，D1 持久化） */
export const watchlistApi = {
  async list(): Promise<WatchlistItem[]> {
    const data = await apiGet<{ items: WatchlistItem[] }>('/api/watchlist');
    return data.items ?? [];
  },
  async add(symbol: string, name: string): Promise<void> {
    await apiPost('/api/watchlist', { symbol, name });
  },
  async remove(symbol: string): Promise<void> {
    await apiDelete(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`);
  },
};

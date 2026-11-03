import { apiGet } from './http';
import type { KLineBar, KLinePeriod, MinutePoint, Quote, Symbol as StockSymbol } from '../../shared/types';

export const marketApi = {
  /** 批量实时行情（≤30 个/次；超量自动分批） */
  async getQuotes(symbols: StockSymbol[]): Promise<Quote[]> {
    const unique = Array.from(new Set(symbols)).filter((s) => s.length > 0);
    const results: Quote[] = [];
    for (let i = 0; i < unique.length; i += 30) {
      const batch = unique.slice(i, i + 30);
      const data = await apiGet<{ quotes: Quote[] }>(
        `/api/market/quote?codes=${encodeURIComponent(batch.join(','))}`,
      );
      results.push(...data.quotes);
    }
    return results;
  },
  async getKline(symbol: StockSymbol, period: KLinePeriod, count = 250): Promise<{ klines: KLineBar[]; degraded?: boolean }> {
    return apiGet(`/api/market/kline?symbol=${symbol}&period=${period}&count=${count}`);
  },
  async getMinute(symbol: StockSymbol): Promise<{ points: MinutePoint[]; prevClose: number; degraded?: boolean }> {
    return apiGet(`/api/market/minute?symbol=${symbol}`);
  },
};

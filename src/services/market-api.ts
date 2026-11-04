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
  /** 个股新闻+公司公告（东方财富免费公开接口代理） */
  async getNews(symbol: StockSymbol): Promise<{ news: StockNewsItem[]; degraded?: boolean }> {
    return apiGet(`/api/market/news?symbol=${symbol}`);
  },
  /** 全市场股票搜索（代码/名称/拼音，东财免费 suggest 接口代理） */
  async searchStocks(keyword: string): Promise<StockSearchItem[]> {
    const data = await apiGet<{ items: StockSearchItem[] }>(`/api/market/search?keyword=${encodeURIComponent(keyword)}`);
    return data.items ?? [];
  },
};

export interface StockNewsItem {
  title: string;
  url: string;
  time: string;
  source: string;
  type: 'ann' | 'news';
}

export interface StockSearchItem {
  symbol: string; // sh600519 / sz300308
  name: string;
  market: string; // 沪A / 深A
}

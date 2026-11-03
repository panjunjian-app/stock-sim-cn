import { create } from 'zustand';
import type { Quote, Symbol as StockSymbol } from '../../shared/types';

interface QuoteState {
  /** 最后一次成功的行情快照（降级数据源：上游失败时保留展示） */
  quotes: Record<StockSymbol, Quote>;
  lastUpdatedAt: string | null;
  degraded: boolean;
  setQuotes: (quotes: Quote[]) => void;
  markDegraded: () => void;
}

export const useQuoteStore = create<QuoteState>((set) => ({
  quotes: {},
  lastUpdatedAt: null,
  degraded: false,
  setQuotes: (list) => {
    set((state) => {
      const next = { ...state.quotes };
      for (const q of list) {
        next[q.symbol] = q;
      }
      return { quotes: next, lastUpdatedAt: new Date().toISOString(), degraded: false };
    });
  },
  markDegraded: () => set({ degraded: true }),
}));

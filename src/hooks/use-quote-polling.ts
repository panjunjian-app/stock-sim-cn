import { useEffect, useMemo, useRef, useState } from 'react';
import type { Quote, Symbol as StockSymbol } from '../../shared/types';
import { marketApi } from '../services/market-api';
import { accountApi } from '../services/account-api';
import { useQuoteStore } from '../store/quote-store';

const POLL_INTERVAL_MS = 5_000;

export interface UseQuotePollingOptions {
  /** 提供账户 ID 时，每次轮询顺带触发撮合 tick（有未成交委托时由服务端处理） */
  accountId?: number;
  /** 是否启用轮询（默认 true） */
  enabled?: boolean;
}

export interface UseQuotePollingResult {
  quotes: Record<StockSymbol, Quote>;
  loading: boolean;
  /** 最近一次拉取是否失败（false=正常；true=已降级保快照） */
  degraded: boolean;
  refresh: () => void;
}

/**
 * use-quote-polling — 5s 轮询行情：
 * 成功 → 写入 quote-store 快照；失败 → 保留最后快照（降级）；
 * 传入 accountId 时顺带 POST /api/market/tick 驱动撮合重试。
 */
export function useQuotePolling(symbols: StockSymbol[], options: UseQuotePollingOptions = {}): UseQuotePollingResult {
  const { accountId, enabled = true } = options;
  const key = useMemo(() => Array.from(new Set(symbols)).sort().join(','), [symbols]);
  const quotes = useQuoteStore((s) => s.quotes);
  const setQuotes = useQuoteStore((s) => s.setQuotes);
  const markDegraded = useQuoteStore((s) => s.markDegraded);
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [tick, setTick] = useState(0);
  const symbolsRef = useRef<StockSymbol[]>([]);
  symbolsRef.current = key.length > 0 ? key.split(',') : [];

  useEffect(() => {
    if (!enabled || symbolsRef.current.length === 0) {
      return;
    }
    let cancelled = false;

    const poll = async () => {
      setLoading(true);
      try {
        const list = await marketApi.getQuotes(symbolsRef.current);
        if (!cancelled) {
          setQuotes(list);
          setDegraded(false);
        }
      } catch {
        // 降级：保留最后快照
        if (!cancelled) {
          markDegraded();
          setDegraded(true);
        }
      } finally {
        if (accountId) {
          // 顺带触发撮合（失败静默，下轮再试）
          try {
            await accountApi.tick(accountId);
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [key, enabled, accountId, setQuotes, markDegraded, tick]);

  const refresh = () => setTick((t) => t + 1);

  return { quotes, loading, degraded, refresh };
}

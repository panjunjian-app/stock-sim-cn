/**
 * StockDetailMobilePage — M3 个股详情（移动版两级页第二级）：
 * QuoteHeader + 分时/日K/周K/月K Segmented + 加自选（常显）+ 新闻流 +
 * 底部固定「买入/卖出」双按钮条（跳全屏下单页 /order/:symbol）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Snackbar, Typography } from '@mui/material';
import type { KLineBar, KLinePeriod, MinutePoint, Quote, Symbol as StockSymbol } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { marketApi } from '../../services/market-api';
import { watchlistApi, type WatchlistItem } from '../../services/watchlist-api';
import { nameMap } from '../../components/StockSearch';
import QuoteHeader from '../../components/QuoteHeader';
import KLineChart from '../../components/KLineChart';
import MinuteChart from '../../components/MinuteChart';
import NewsList from '../../components/NewsList';
import { useQuotePolling } from '../../hooks/use-quote-polling';
import { useQuoteStore } from '../../store/quote-store';
import { checkSymbol } from '../../../shared/validate';
import SegmentedControl from '../components/SegmentedControl';
import TradeButtonBar from '../components/TradeButtonBar';

type ChartTab = 'minute' | KLinePeriod;

const CHART_TABS: Array<{ value: ChartTab; label: string }> = [
  { value: 'minute', label: '分时' },
  { value: 'day', label: '日K' },
  { value: 'week', label: '周K' },
  { value: 'month', label: '月K' },
];

export default function StockDetailMobilePage() {
  const params = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const symbol = params.symbol ?? 'sh600519';
  const symbolOk = checkSymbol(symbol).ok;

  const [chartTab, setChartTab] = useState<ChartTab>('day');
  const [klines, setKlines] = useState<KLineBar[]>([]);
  const [minute, setMinute] = useState<{ points: MinutePoint[]; prevClose: number }>({ points: [], prevClose: 0 });
  const [chartLoading, setChartLoading] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [snack, setSnack] = useState<string | null>(null);

  // 自选（失败静默，不影响看盘）
  useEffect(() => {
    let cancelled = false;
    watchlistApi
      .list()
      .then((items) => {
        if (!cancelled) setWatchlist(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const watchSymbolsSet = useMemo(() => new Set(watchlist.map((w) => w.symbol)), [watchlist]);
  const inWatch = watchSymbolsSet.has(symbol);

  // 行情轮询（仅当前标的）
  const { quotes: polled } = useQuotePolling(symbolOk ? [symbol as StockSymbol] : []);
  const cachedQuotes = useQuoteStore((s) => s.quotes);
  const quote: Quote | undefined = polled[symbol as StockSymbol] ?? cachedQuotes[symbol as StockSymbol];

  // K 线 / 分时加载
  const loadChart = useCallback(async () => {
    if (!symbolOk) return;
    setChartLoading(true);
    try {
      if (chartTab === 'minute') {
        const data = await marketApi.getMinute(symbol as StockSymbol);
        setMinute({ points: data.points, prevClose: data.prevClose });
      } else {
        const data = await marketApi.getKline(symbol as StockSymbol, chartTab, 250);
        setKlines(data.klines);
      }
    } catch {
      /* 降级：图表区显示空态 */
    } finally {
      setChartLoading(false);
    }
  }, [symbol, symbolOk, chartTab]);

  useEffect(() => {
    void loadChart();
  }, [loadChart]);

  // 加自选 / 移出自选（乐观更新 + 失败回滚）
  const toggleWatch = async (): Promise<void> => {
    const prev = watchlist;
    if (inWatch) {
      setWatchlist((ws) => ws.filter((w) => w.symbol !== symbol));
      try {
        await watchlistApi.remove(symbol);
      } catch {
        setWatchlist(prev);
        setSnack('移出自选失败，请稍后重试');
      }
    } else {
      const name = nameMap.get(symbol) ?? quote?.name ?? symbol.replace(/^(sh|sz)/, '');
      setWatchlist((ws) => [{ symbol, name }, ...ws]);
      try {
        await watchlistApi.add(symbol, name);
      } catch {
        setWatchlist(prev);
        setSnack('加入自选失败，请稍后重试');
      }
    }
  };

  if (!symbolOk) {
    return (
      <Box sx={{ flex: 1, p: 4 }}>
        <Typography sx={{ fontSize: 13, color: MUJI.up }}>股票代码不合法：{symbol}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* 行情大字区 + 周期切换 + 加自选 */}
      <Box sx={{ px: 2, pt: 2 }}>
        <QuoteHeader quote={quote} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <SegmentedControl value={chartTab} options={CHART_TABS} onChange={setChartTab} scrollable />
          </Box>
          <Button
            variant="outlined"
            onClick={() => void toggleWatch()}
            sx={{
              minHeight: 44,
              px: 1.75,
              fontSize: 12.5,
              whiteSpace: 'nowrap',
              ...(inWatch
                ? { color: MUJI.red, borderColor: MUJI.red }
                : { color: MUJI.ink2, borderColor: MUJI.line }),
            }}
          >
            {inWatch ? '★ 已自选' : '☆ 加自选'}
          </Button>
        </Box>
      </Box>

      {/* 图表 */}
      <Box sx={{ px: 2, mt: 1.5 }}>
        <Box sx={{ height: 300, bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', overflow: 'hidden' }}>
          {chartLoading ? (
            <Typography sx={{ p: 4, textAlign: 'center', fontSize: 12, color: MUJI.ink3 }}>图表加载中…</Typography>
          ) : chartTab === 'minute' ? (
            <MinuteChart points={minute.points} prevClose={minute.prevClose} />
          ) : klines.length > 0 ? (
            <KLineChart bars={klines} />
          ) : (
            <Typography sx={{ p: 4, textAlign: 'center', fontSize: 12, color: MUJI.ink3 }}>
              暂无 K 线数据（可能非交易时段或上游暂时不可用）
            </Typography>
          )}
        </Box>
      </Box>

      {/* 个股新闻 + 公告 */}
      <Box sx={{ px: 2, mt: 2, pb: 2, flex: 1 }}>
        <NewsList symbol={symbol as StockSymbol} />
      </Box>

      {/* 底部固定买卖条 → 全屏下单页 */}
      <TradeButtonBar
        onBuy={() => navigate(`/order/${symbol}?side=buy`)}
        onSell={() => navigate(`/order/${symbol}?side=sell`)}
      />

      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} message={snack ?? ''} />
    </Box>
  );
}

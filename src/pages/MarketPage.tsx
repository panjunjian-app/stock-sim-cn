import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import type { KLineBar, KLinePeriod, MinutePoint, OrderInput, Position, Quote, Symbol as StockSymbol } from '../../shared/types';
import { STOCKS } from '../components/StockSearch';
import StockSearch from '../components/StockSearch';
import QuoteHeader from '../components/QuoteHeader';
import KLineChart from '../components/KLineChart';
import MinuteChart from '../components/MinuteChart';
import NewsList from '../components/NewsList';
import MarketStatusBanner from '../components/MarketStatusBanner';
import OrderPanel from '../components/OrderPanel';
import { marketApi } from '../services/market-api';
import { accountApi } from '../services/account-api';
import { useQuotePolling } from '../hooks/use-quote-polling';
import { useQuoteStore } from '../store/quote-store';
import { ApiError } from '../services/http';
import { MUJI } from '../theme/muji-theme';

type ChartTab = 'minute' | KLinePeriod;

const CHART_TABS: Array<{ key: ChartTab; label: string }> = [
  { key: 'minute', label: '分时' },
  { key: 'day', label: '日K' },
  { key: 'week', label: '周K' },
  { key: 'month', label: '月K' },
];

/** MarketPage — ⑤ 看盘三栏：自选股列表 | 行情图表 | 下单面板（⑥ 下单确认在面板内弹出） */
export default function MarketPage() {
  const params = useParams<{ symbol?: string }>();
  const navigate = useNavigate();

  const [symbol, setSymbol] = useState<StockSymbol>(params.symbol ?? 'sh600519');
  const [chartTab, setChartTab] = useState<ChartTab>('day');
  const [klines, setKlines] = useState<KLineBar[]>([]);
  const [minute, setMinute] = useState<{ points: MinutePoint[]; prevClose: number }>({ points: [], prevClose: 0 });
  const [chartLoading, setChartLoading] = useState(false);

  // 账户上下文（取第一个账户用于下单与 tick）
  const [accountId, setAccountId] = useState<number | null>(null);
  const [cashAvailable, setCashAvailable] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    if (params.symbol && params.symbol !== symbol) {
      setSymbol(params.symbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.symbol]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accounts } = await accountApi.listAccounts();
        if (cancelled || accounts.length === 0) {
          return;
        }
        const first = accounts[0];
        setAccountId(first.id);
        const [{ account }, { positions: ps }] = await Promise.all([
          accountApi.getAccount(first.id),
          accountApi.getPositions(first.id),
        ]);
        if (cancelled) return;
        setCashAvailable(account.cashAvailable);
        setPositions(ps);
      } catch {
        /* 静默：看盘页不依赖账户也可用 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 行情轮询：自选池 + 持仓标的（内部自动 ≤30 分批）
  const watchSymbols = useMemo<StockSymbol[]>(() => {
    const base = STOCKS.map((s) => s.symbol);
    return [...base, ...positions.map((p) => p.symbol)];
  }, [positions]);
  const { quotes: polled, degraded } = useQuotePolling(watchSymbols, { accountId: accountId ?? undefined });
  const cachedQuotes = useQuoteStore((s) => s.quotes);
  const quotes = degraded ? cachedQuotes : polled;
  const quote: Quote | undefined = quotes[symbol] ?? cachedQuotes[symbol];

  // K 线 / 分时加载
  const loadChart = useCallback(async () => {
    setChartLoading(true);
    try {
      if (chartTab === 'minute') {
        const data = await marketApi.getMinute(symbol);
        setMinute({ points: data.points, prevClose: data.prevClose });
      } else {
        const data = await marketApi.getKline(symbol, chartTab, 250);
        setKlines(data.klines);
      }
    } catch {
      /* 降级：图表区显示空态 */
    } finally {
      setChartLoading(false);
    }
  }, [symbol, chartTab]);

  useEffect(() => {
    void loadChart();
  }, [loadChart]);

  const selectSymbol = (s: StockSymbol) => {
    setSymbol(s);
    navigate(`/trade/${s}`, { replace: true });
  };

  const submitOrder = async (input: OrderInput): Promise<string | null> => {
    if (accountId === null) {
      return '尚未开立交易账户，请先到「我的账户」开户';
    }
    try {
      const result = await accountApi.submitOrder(accountId, input);
      // 废单（资金不足/涨跌停越界等）直接显示服务端原因
      if (result.order.status === 'rejected') {
        return result.order.rejectReason ?? '委托被拒绝';
      }
      if (result.matched) {
        // 成交后刷新资金与持仓
        const [{ account }, { positions: ps }] = await Promise.all([
          accountApi.getAccount(accountId),
          accountApi.getPositions(accountId),
        ]);
        setCashAvailable(account.cashAvailable);
        setPositions(ps);
        return null;
      }
      return '委托已提交，等待行情触发成交';
    } catch (e) {
      return e instanceof ApiError ? e.message : '委托失败，请稍后重试';
    }
  };

  const position = positions.find((p) => p.symbol === symbol);

  return (
    <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
      {/* 左：自选股 */}
      <Box sx={{ flex: '0 0 232px', bgcolor: MUJI.card, borderRight: `1px solid ${MUJI.line}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <Box sx={{ px: 3.5, pt: 2.5, pb: 2 }}>
          <StockSearch value={symbol} onChange={selectSymbol} />
        </Box>
        <Box sx={{ px: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 400, letterSpacing: '0.05em' }}>
          <span>自选股（{STOCKS.length}）</span>
        </Box>
        {STOCKS.map((s) => {
          const q = quotes[s.symbol];
          const chg = q ? q.price - q.prevClose : 0;
          const pct = q ? q.changePct : 0;
          const selected = s.symbol === symbol;
          return (
            <Box
              key={s.symbol}
              onClick={() => selectSymbol(s.symbol)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 2,
                py: 1.1,
                cursor: 'pointer',
                position: 'relative',
                bgcolor: selected ? MUJI.paper2 : 'transparent',
                '&:hover': { bgcolor: selected ? MUJI.paper2 : '#f5f2ec' },
                ...(selected ? { '&::before': { content: '""', position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, bgcolor: MUJI.red } } : {}),
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 400, letterSpacing: '0.1em' }}>{s.name}</Typography>
                <Typography className="num" sx={{ fontSize: 9.5, color: MUJI.ink3 }}>
                  {s.symbol.replace(/^(sh|sz)/, '')}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', mr: 1.5 }}>
                <Typography className="num" sx={{ fontSize: 12.5, fontWeight: 400, color: q ? (chg >= 0 ? MUJI.up : MUJI.down) : MUJI.ink3 }}>
                  {q ? (q.price / 100).toFixed(2) : '—'}
                </Typography>
                <Typography className="num" sx={{ fontSize: 9.5, color: q ? (chg >= 0 ? MUJI.up : MUJI.down) : MUJI.ink3 }}>
                  {q ? `${chg >= 0 ? '+' : ''}${(chg / 100).toFixed(2)}` : ''}
                </Typography>
              </Box>
              <Box
                className="num"
                sx={{
                  minWidth: 52,
                  textAlign: 'center',
                  fontSize: 11.5,
                  fontWeight: 400,
                  py: 0.6,
                  borderRadius: '2px',
                  bgcolor: q ? (chg > 0 ? MUJI.upBg : chg < 0 ? MUJI.downBg : 'transparent') : 'transparent',
                  color: q ? (chg > 0 ? MUJI.up : chg < 0 ? MUJI.down : MUJI.ink2) : MUJI.ink3,
                }}
              >
                {q ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* 中：行情 + 图表 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, px: 2.75, pt: 2, overflowY: 'auto' }}>
        <QuoteHeader quote={quote} />
        <Box sx={{ display: 'flex', gap: 3, mt: 1.75, borderBottom: `1px solid ${MUJI.line}`, alignItems: 'center' }}>
          {CHART_TABS.map((t) => {
            const active = chartTab === t.key;
            return (
              <Box
                key={t.key}
                onClick={() => setChartTab(t.key)}
                sx={{
                  fontSize: 12.5,
                  letterSpacing: '0.05em',
                  py: 1,
                  cursor: 'pointer',
                  color: active ? MUJI.ink : MUJI.ink3,
                  borderBottom: `1.5px solid ${active ? MUJI.red : 'transparent'}`,
                  mb: '-1px',
                }}
              >
                {t.label}
              </Box>
            );
          })}
          <Box sx={{ ml: 'auto', pb: 1 }}>
            <MarketStatusBanner />
          </Box>
        </Box>
        <Box sx={{ height: 420, position: 'relative' }}>
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

        {/* 相关新闻：个股经营动态与资讯（可能影响股价） */}
        <NewsList symbol={symbol} />
      </Box>

      {/* 右：下单面板 */}
      <OrderPanel
        symbol={symbol}
        quote={quote}
        position={position}
        cashAvailable={cashAvailable}
        onSubmit={submitOrder}
      />
    </Box>
  );
}

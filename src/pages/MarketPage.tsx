import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import type { KLineBar, KLinePeriod, MinutePoint, OrderInput, Position, Quote, Symbol as StockSymbol } from '../../shared/types';
import { STOCKS, nameMap } from '../components/StockSearch';
import StockSearch from '../components/StockSearch';
import QuoteHeader from '../components/QuoteHeader';
import KLineChart from '../components/KLineChart';
import MinuteChart from '../components/MinuteChart';
import NewsList from '../components/NewsList';
import MarketStatusBanner from '../components/MarketStatusBanner';
import OrderPanel from '../components/OrderPanel';
import { marketApi } from '../services/market-api';
import { accountApi } from '../services/account-api';
import { watchlistApi, WatchlistItem } from '../services/watchlist-api';
import type { AccountInfo } from '../../shared/types';
import { useQuotePolling } from '../hooks/use-quote-polling';
import { useQuoteStore } from '../store/quote-store';
import { ApiError } from '../services/http';
import { MUJI } from '../theme/muji-theme';

type ChartTab = 'minute' | KLinePeriod;
type ListTab = 'default' | 'mine';

const CHART_TABS: Array<{ key: ChartTab; label: string }> = [
  { key: 'minute', label: '分时' },
  { key: 'day', label: '日K' },
  { key: 'week', label: '周K' },
  { key: 'month', label: '月K' },
];

/** MarketPage — ⑤ 看盘三栏：自选股列表（大盘推荐/我的自选）| 行情图表 | 下单面板 */
export default function MarketPage() {
  const params = useParams<{ symbol?: string }>();
  const navigate = useNavigate();

  const [symbol, setSymbol] = useState<StockSymbol>(params.symbol ?? 'sh600519');
  const [chartTab, setChartTab] = useState<ChartTab>('day');
  const [klines, setKlines] = useState<KLineBar[]>([]);
  const [minute, setMinute] = useState<{ points: MinutePoint[]; prevClose: number }>({ points: [], prevClose: 0 });
  const [chartLoading, setChartLoading] = useState(false);

  // 自选股（登录用户维度；未登录时降级为空列表）
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [listTab, setListTab] = useState<ListTab>('default');

  // 账户上下文：全部账户（个人 + 比赛）可选，用于下单与 tick
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [cashAvailable, setCashAvailable] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    if (params.symbol && params.symbol !== symbol) {
      setSymbol(params.symbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.symbol]);

  // 登录后拉取我的自选
  useEffect(() => {
    let cancelled = false;
    watchlistApi
      .list()
      .then((items) => {
        if (!cancelled) setWatchlist(items);
      })
      .catch(() => {
        /* 未登录或失败：自选为空，不影响看盘 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 切换/选定账户后加载其资金与持仓
  const loadAccountContext = useCallback(async (id: number) => {
    const [{ account }, { positions: ps }] = await Promise.all([
      accountApi.getAccount(id),
      accountApi.getPositions(id),
    ]);
    setCashAvailable(account.cashAvailable);
    setPositions(ps);
  }, []);

  // 首次拉取账户列表（个人 + 比赛账户），默认选第一个
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accounts: list } = await accountApi.listAccounts();
        if (cancelled || list.length === 0) {
          return;
        }
        setAccounts(list);
        const first = list[0];
        setAccountId(first.id);
        await loadAccountContext(first.id);
      } catch {
        /* 静默：看盘页不依赖账户也可用 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAccountContext]);

  // 下单面板切换交易账户
  const selectAccount = useCallback(
    (id: number) => {
      if (id === accountId) return;
      setAccountId(id);
      void loadAccountContext(id).catch(() => {
        /* 切换失败静默，面板资金/持仓维持原值 */
      });
    },
    [accountId, loadAccountContext],
  );

  // 行情轮询池：默认池 + 我的自选 + 当前选中 + 持仓（关键：当前选中必须在池内，
  // 否则远程搜索选中的股票不在默认池时 QuoteHeader 一直显示「等待行情数据」）
  const watchSymbols = useMemo<StockSymbol[]>(() => {
    const base = STOCKS.map((s) => s.symbol);
    const mine = watchlist.map((w) => w.symbol as StockSymbol);
    return Array.from(new Set([...base, ...mine, symbol, ...positions.map((p) => p.symbol)]));
  }, [positions, watchlist, symbol]);
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

  // 自选增删（乐观更新 + 失败回滚）
  const watchSymbolsSet = useMemo(() => new Set(watchlist.map((w) => w.symbol)), [watchlist]);
  const addWatch = async (item: { symbol: string; name: string }) => {
    if (watchSymbolsSet.has(item.symbol)) return;
    setWatchlist((ws) => [{ symbol: item.symbol, name: item.name }, ...ws]);
    try {
      await watchlistApi.add(item.symbol, item.name);
    } catch {
      setWatchlist((ws) => ws.filter((w) => w.symbol !== item.symbol));
    }
  };
  const removeWatch = async (sym: string) => {
    const prev = watchlist;
    setWatchlist((ws) => ws.filter((w) => w.symbol !== sym));
    try {
      await watchlistApi.remove(sym);
    } catch {
      setWatchlist(prev);
    }
  };
  const toggleCurrentWatch = async () => {
    if (watchSymbolsSet.has(symbol)) {
      await removeWatch(symbol);
    } else {
      await addWatch({ symbol, name: nameMap.get(symbol) ?? quote?.name ?? symbol.replace(/^(sh|sz)/, '') });
    }
  };

  const position = positions.find((p) => p.symbol === symbol);
  const inWatch = watchSymbolsSet.has(symbol);

  /** 左栏股票行（默认池与我的自选共用渲染） */
  const renderStockRow = (s: { symbol: string; name: string }, deletable = false) => {
    const sym = s.symbol as StockSymbol;
    const q = quotes[sym];
    const chg = q ? q.price - q.prevClose : 0;
    const pct = q ? q.changePct : 0;
    const selected = s.symbol === symbol;
    return (
      <Box
        key={s.symbol}
        onClick={() => selectSymbol(sym)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1.1,
          cursor: 'pointer',
          position: 'relative',
          bgcolor: selected ? MUJI.paper2 : 'transparent',
          '&:hover': { bgcolor: selected ? MUJI.paper2 : '#f5f2ec' },
          '&:hover .watch-del': { opacity: 1 },
          ...(selected ? { '&::before': { content: '""', position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, bgcolor: MUJI.red } } : {}),
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 400, letterSpacing: '0.1em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {q?.name || s.name}
          </Typography>
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
        {deletable && (
          <Box
            className="watch-del"
            title="移出自选"
            onClick={(e) => {
              e.stopPropagation();
              void removeWatch(s.symbol);
            }}
            sx={{
              position: 'absolute',
              top: 2,
              right: 4,
              width: 16,
              height: 16,
              lineHeight: '14px',
              textAlign: 'center',
              fontSize: 11,
              color: MUJI.ink3,
              borderRadius: '2px',
              opacity: 0,
              transition: 'opacity .15s',
              '&:hover': { color: MUJI.down, bgcolor: 'rgba(0,0,0,.05)' },
            }}
          >
            ×
          </Box>
        )}
      </Box>
    );
  };

  const listTabStyle = (active: boolean) => ({
    fontSize: 12.5,
    fontWeight: 400,
    letterSpacing: '0.05em',
    py: 0.75,
    cursor: 'pointer',
    color: active ? MUJI.ink : MUJI.ink3,
    borderBottom: `1.5px solid ${active ? MUJI.red : 'transparent'}`,
  });

  return (
    <Box sx={{ flex: 1, display: 'flex', minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {/* 左：搜索 + 自选股（大盘推荐 / 我的自选 双 Tab，列表超出一屏内部滚动） */}
      <Box sx={{ flex: '0 0 232px', bgcolor: MUJI.card, borderRight: `1px solid ${MUJI.line}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ px: 3.5, pt: 2.5, pb: 2, flex: '0 0 auto' }}>
          <StockSearch value={symbol} onChange={selectSymbol} onAddWatchlist={addWatch} watchlistSymbols={watchlist.map((w) => w.symbol)} />
        </Box>
        <Box sx={{ px: 2, display: 'flex', gap: 2.5, alignItems: 'center', flex: '0 0 auto' }}>
          <Box onClick={() => setListTab('default')} sx={listTabStyle(listTab === 'default')}>
            大盘推荐（{STOCKS.length}）
          </Box>
          <Box onClick={() => setListTab('mine')} sx={listTabStyle(listTab === 'mine')}>
            我的自选（{watchlist.length}）
          </Box>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {listTab === 'default'
            ? STOCKS.map((s) => renderStockRow(s))
            : watchlist.length === 0
              ? (
                <Typography sx={{ px: 2.5, py: 4, fontSize: 12, color: MUJI.ink3, lineHeight: 1.9 }}>
                  还没有自选股。
                  <br />
                  用上方搜索框查到股票后，
                  <br />
                  点「+ 自选」即可加进来跟踪。
                </Typography>
              )
              : watchlist.map((w) => renderStockRow(w, true))}
        </Box>
      </Box>

      {/* 中：行情 + 图表（quote/tabs 固定，图表自适应剩余高度，小屏整列滚动兜底） */}
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
          <Box sx={{ ml: 'auto', pb: 1, display: 'flex', alignItems: 'center', gap: 2.5 }}>
            <Box
              onClick={() => void toggleCurrentWatch()}
              title={inWatch ? '点击移出自选' : '点击加入自选'}
              sx={{
                fontSize: 11.5,
                letterSpacing: '0.05em',
                px: 1.25,
                py: 0.5,
                borderRadius: '2px',
                cursor: 'pointer',
                ...(inWatch
                  ? { color: MUJI.red, bgcolor: 'rgba(240,131,0,.08)' }
                  : { color: MUJI.ink2, border: `1px solid ${MUJI.line}`, '&:hover': { color: MUJI.red, borderColor: MUJI.red } }),
              }}
            >
              {inWatch ? '★ 已自选' : '☆ 加自选'}
            </Box>
            <MarketStatusBanner />
          </Box>
        </Box>
        {/* 图表：自适应撑满剩余高度（小屏保底 280px，超出则整列滚动） */}
        <Box sx={{ flex: '1 1 auto', minHeight: 280, position: 'relative' }}>
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

      {/* 右：下单面板（可切换个人账户 / 比赛账户） */}
      <OrderPanel
        symbol={symbol}
        quote={quote}
        position={position}
        cashAvailable={cashAvailable}
        accounts={accounts}
        selectedAccountId={accountId}
        onSelectAccount={selectAccount}
        onSubmit={submitOrder}
      />
    </Box>
  );
}

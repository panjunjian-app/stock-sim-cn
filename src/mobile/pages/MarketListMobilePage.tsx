/**
 * MarketListMobilePage — M3 行情列表（移动版）：
 * 搜索置顶（东财全市场）+ 大盘推荐/我的自选 Tab + 股票卡片列表。
 * 行情复用 useQuotePolling（P0 轮询 + 手动刷新按钮，下拉刷新 P1）。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, IconButton, Snackbar, TextField, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import type { Symbol as StockSymbol } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { marketApi, type StockSearchItem } from '../../services/market-api';
import { watchlistApi, type WatchlistItem } from '../../services/watchlist-api';
import { STOCKS } from '../../components/StockSearch';
import { useQuotePolling } from '../../hooks/use-quote-polling';
import StockQuoteCard from '../components/StockQuoteCard';

type ListTab = 'default' | 'mine';

export default function MarketListMobilePage() {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [listTab, setListTab] = useState<ListTab>('default');
  const [keyword, setKeyword] = useState('');
  const [remote, setRemote] = useState<StockSearchItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  // 我的自选（登录用户维度；失败降级为空列表不阻塞看盘）
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

  // 行情轮询池：默认池 + 我的自选（5s）
  const pollSymbols = useMemo<StockSymbol[]>(
    () => Array.from(new Set([...STOCKS.map((s) => s.symbol), ...watchlist.map((w) => w.symbol as StockSymbol)])),
    [watchlist],
  );
  const { quotes, refresh, loading } = useQuotePolling(pollSymbols);

  // 远程搜索：≥2 字符防抖 300ms
  useEffect(() => {
    const k = keyword.trim();
    if (k.length < 2) {
      setRemote(null);
      setSearching(false);
      return undefined;
    }
    let alive = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      marketApi
        .searchStocks(k)
        .then((r) => alive && setRemote(r))
        .catch(() => alive && setRemote([]))
        .finally(() => alive && setSearching(false));
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [keyword]);

  const watchSymbolsSet = useMemo(() => new Set(watchlist.map((w) => w.symbol)), [watchlist]);

  // 自选增删（乐观更新 + 失败回滚 + Snackbar）
  const addWatch = async (item: { symbol: string; name: string }): Promise<void> => {
    if (watchSymbolsSet.has(item.symbol)) return;
    setWatchlist((ws) => [{ symbol: item.symbol, name: item.name }, ...ws]);
    try {
      await watchlistApi.add(item.symbol, item.name);
    } catch {
      setWatchlist((ws) => ws.filter((w) => w.symbol !== item.symbol));
      setSnack('加入自选失败，请稍后重试');
    }
  };
  const removeWatch = async (sym: string): Promise<void> => {
    const prev = watchlist;
    setWatchlist((ws) => ws.filter((w) => w.symbol !== sym));
    try {
      await watchlistApi.remove(sym);
    } catch {
      setWatchlist(prev);
      setSnack('移出自选失败，请稍后重试');
    }
  };

  const listTabStyle = (active: boolean) => ({
    fontSize: 13,
    fontWeight: 400,
    letterSpacing: '0.05em',
    py: 1,
    cursor: 'pointer',
    color: active ? MUJI.ink : MUJI.ink3,
    borderBottom: `1.5px solid ${active ? MUJI.red : 'transparent'}`,
  });

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* 搜索置顶 + 手动刷新 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="输入代码 / 名称 / 拼音搜全市场"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          inputProps={{ enterKeyHint: 'search' }}
          sx={{ '& .MuiInputBase-root': { height: 44, bgcolor: MUJI.card } }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ fontSize: 18, color: MUJI.ink3, mr: 1 }} />,
            endAdornment: searching ? <CircularProgress size={14} sx={{ color: MUJI.ink3 }} /> : undefined,
          }}
        />
        <IconButton aria-label="刷新行情" onClick={refresh} sx={{ width: 44, height: 44, color: loading ? MUJI.red : MUJI.ink2 }}>
          <RefreshIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* 远程搜索结果（≥2 字符时展示） */}
      {remote !== null && (
        <Box sx={{ mx: 2, mb: 1.5, bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', overflow: 'hidden' }}>
          {remote.length === 0 ? (
            <Typography sx={{ px: 2, py: 1.5, fontSize: 12, color: MUJI.ink3 }}>未找到「{keyword.trim()}」对应的沪深 A 股</Typography>
          ) : (
            remote.slice(0, 20).map((it) => {
              const added = watchSymbolsSet.has(it.symbol);
              return (
                <Box key={it.symbol} sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderBottom: `1px solid ${MUJI.lineSoft}`, '&:last-child': { borderBottom: 'none' } }}>
                  <Box sx={{ flex: 1, minWidth: 0, minHeight: 44, display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }} onClick={() => navigate(`/trade/${it.symbol}`)}>
                    <Typography sx={{ fontSize: 13.5, color: MUJI.ink }}>{it.name}</Typography>
                    <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3 }}>
                      {it.symbol.replace(/^(sh|sz)/, '')} · {it.market}
                    </Typography>
                  </Box>
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!added) void addWatch({ symbol: it.symbol, name: it.name });
                    }}
                    sx={{
                      flex: '0 0 auto',
                      ml: 1,
                      fontSize: 11.5,
                      px: 1.25,
                      py: 0.75,
                      borderRadius: '4px',
                      cursor: added ? 'default' : 'pointer',
                      ...(added
                        ? { color: MUJI.ink3, border: `1px solid ${MUJI.line}` }
                        : { color: MUJI.red, border: `1px solid ${MUJI.red}` }),
                    }}
                  >
                    {added ? '已自选' : '+ 自选'}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      )}

      {/* 大盘推荐 / 我的自选 Tab */}
      <Box sx={{ px: 2, display: 'flex', gap: 3, alignItems: 'center' }}>
        <Box onClick={() => setListTab('default')} sx={listTabStyle(listTab === 'default')}>
          大盘推荐（{STOCKS.length}）
        </Box>
        <Box onClick={() => setListTab('mine')} sx={listTabStyle(listTab === 'mine')}>
          我的自选（{watchlist.length}）
        </Box>
      </Box>

      {/* 股票卡片列表 */}
      <Box sx={{ flex: 1, px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {listTab === 'default' ? (
          STOCKS.map((s) => (
            <StockQuoteCard
              key={s.symbol}
              symbol={s.symbol as StockSymbol}
              name={s.name}
              quote={quotes[s.symbol as StockSymbol]}
              onClick={() => navigate(`/trade/${s.symbol}`)}
            />
          ))
        ) : watchlist.length === 0 ? (
          <Typography sx={{ py: 6, textAlign: 'center', fontSize: 12.5, color: MUJI.ink3, lineHeight: 2 }}>
            还没有自选股。
            <br />
            用上方搜索框查到股票后，点「+ 自选」即可加进来跟踪。
          </Typography>
        ) : (
          watchlist.map((w) => (
            <StockQuoteCard
              key={w.symbol}
              symbol={w.symbol as StockSymbol}
              name={w.name}
              quote={quotes[w.symbol as StockSymbol]}
              onClick={() => navigate(`/trade/${w.symbol}`)}
              onDelete={() => void removeWatch(w.symbol)}
            />
          ))
        )}
      </Box>

      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} message={snack ?? ''} />
    </Box>
  );
}

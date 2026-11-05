import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Tab, Tabs, Typography } from '@mui/material';
import type { CashFlow, Order, OrderInput, Position, Quote, Symbol as StockSymbol, Trade } from '../../shared/types';
import { formatPct, formatSignedYuan, formatYuanSymbol } from '../../shared/money';
import { computeOverview, mergePositions } from '../utils/overview';
import { accountApi } from '../services/account-api';
import { ApiError } from '../services/http';
import { useQuotePolling } from '../hooks/use-quote-polling';
import { useQuoteStore } from '../store/quote-store';
import PositionsTable from '../components/PositionsTable';
import OrdersTable from '../components/OrdersTable';
import TradesTable from '../components/TradesTable';
import CashFlowTable from '../components/CashFlowTable';
import { pnlColor } from '../components/PnlText';
import { MUJI } from '../theme/muji-theme';
import MarketStatusBanner from '../components/MarketStatusBanner';

type DetailTab = 'positions' | 'orders' | 'trades' | 'flows';

interface OverviewBaseState {
  accountId: number;
  name: string;
  cashAvailable: number;
  frozenCash: number;
  totalDeposit: number;
}

/** AccountDetailPage — ④ 账户详情：资产总览条 + 持仓/委托/成交/流水四 Tab */
export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const accountId = Number(params.id);

  const [base, setBase] = useState<OverviewBaseState | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [flows, setFlows] = useState<CashFlow[]>([]);
  const [tab, setTab] = useState<DetailTab>('positions');
  const [error, setError] = useState<string | null>(null);

  const cachedQuotes = useQuoteStore((s) => s.quotes);

  const loadAll = useCallback(async () => {
    if (!Number.isInteger(accountId) || accountId <= 0) {
      setError('账户 ID 不合法');
      return;
    }
    try {
      const [{ overview }, { positions: ps }, { orders: os }, { trades: ts }, { cashFlows: fs }] = await Promise.all([
        accountApi.getOverview(accountId),
        accountApi.getPositions(accountId),
        accountApi.getOrders(accountId),
        accountApi.getTrades(accountId, 1, 50),
        accountApi.getCashFlows(accountId, 1, 50),
      ]);
      setBase(overview);
      setPositions(ps);
      setOrders(os);
      setTrades(ts);
      setFlows(fs);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '账户数据加载失败');
    }
  }, [accountId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // 轮询：持仓 + 未成交委托相关标的；顺带驱动 tick 撮合
  const pollSymbols = useMemo<StockSymbol[]>(() => {
    const set = new Set<StockSymbol>();
    for (const p of positions) {
      set.add(p.symbol);
    }
    for (const o of orders) {
      if (o.status === 'pending' || o.status === 'partial') {
        set.add(o.symbol);
      }
    }
    return Array.from(set);
  }, [positions, orders]);
  const { quotes: polled } = useQuotePolling(pollSymbols, { accountId, enabled: pollSymbols.length > 0 });
  const quotes = polled ?? cachedQuotes;

  const overview = base ? computeOverview(base, positions, quotes) : null;
  const mergedPositions = useMemo(() => mergePositions(positions, quotes), [positions, quotes]);
  const openOrders = orders.filter((o) => o.status === 'pending' || o.status === 'partial');

  const handleQuickOrder = (input: Pick<OrderInput, 'symbol' | 'side'>) => {
    navigate(`/trade/${input.symbol}`);
  };

  if (error) {
    return (
      <Box sx={{ flex: 1, p: 4, overflowY: 'auto', minHeight: 0 }}>
        <Typography sx={{ fontSize: 13, color: MUJI.up }}>{error}</Typography>
        <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/accounts')}>
          返回账户列表
        </Button>
      </Box>
    );
  }
  if (!overview) {
    return (
      <Box sx={{ flex: 1, p: 4, overflowY: 'auto', minHeight: 0 }}>
        <Typography sx={{ fontSize: 13, color: MUJI.ink3, letterSpacing: '0.1em' }}>加载中…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, px: 6.5, pt: 3, overflowY: 'auto' }}>
      {/* 返回账户列表 */}
      <Box
        onClick={() => navigate('/accounts')}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', mb: 1, px: 1, py: 0.5, borderRadius: '3px', '&:hover': { bgcolor: MUJI.paper2 } }}
      >
        <Typography sx={{ fontSize: 13, color: MUJI.red, letterSpacing: '0.05em' }}>← 返回账户列表</Typography>
      </Box>
      <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 2, letterSpacing: '0.1em' }}>
        我的账户 / <b style={{ fontWeight: 400, color: MUJI.ink }}>{overview.name}</b>（账户 No.{overview.accountId}）
      </Typography>

      {/* 资产总览条 */}
      <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '2px', p: '26px 30px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
        <Box>
          <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>总资产（元）</Typography>
          <Typography className="num" sx={{ fontSize: 31, fontWeight: 500, mt: 1 }}>
            {formatYuanSymbol(overview.totalAsset)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 5.5, pl: 5.5, borderLeft: `1px solid ${MUJI.lineSoft}`, flex: 1, flexWrap: 'wrap' }}>
          <Box>
            <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>可用资金</Typography>
            <Typography className="num" sx={{ fontSize: 17, fontWeight: 400, mt: 1.1 }}>
              {formatYuanSymbol(overview.cashAvailable)}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>持仓市值</Typography>
            <Typography className="num" sx={{ fontSize: 17, fontWeight: 400, mt: 1.1 }}>
              {formatYuanSymbol(overview.marketValue)}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>在途冻结</Typography>
            <Typography className="num" sx={{ fontSize: 17, fontWeight: 400, mt: 1.1 }}>
              {formatYuanSymbol(overview.frozenCash)}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>当日盈亏</Typography>
            <Typography className="num" sx={{ fontSize: 17, fontWeight: 400, mt: 1.1, color: pnlColor(overview.dayPnl) }}>
              {formatSignedYuan(overview.dayPnl)}
            </Typography>
            <Typography className="num" sx={{ fontSize: 11, color: pnlColor(overview.dayPnl) }}>
              {formatPct(overview.dayPnlPct)}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>累计收益率</Typography>
            <Typography className="num" sx={{ fontSize: 17, fontWeight: 400, mt: 1.1, color: pnlColor(overview.totalPnl) }}>
              {formatPct(overview.totalPnlPct)}
            </Typography>
            <Typography className="num" sx={{ fontSize: 11, color: MUJI.ink3 }}>
              累计盈亏 {formatSignedYuan(overview.totalPnl)} · 本金 {formatYuanSymbol(overview.totalDeposit)}
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', alignSelf: 'flex-start' }}>
            <MarketStatusBanner />
          </Box>
        </Box>
      </Box>

      {/* Tab 头 */}
      <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderBottom: 'none', mt: 3, px: 3, borderRadius: '2px 2px 0 0' }}>
        <Tabs value={tab} onChange={(_, v: DetailTab) => setTab(v)}>
          <Tab value="positions" label={`持仓（${mergedPositions.length}）`} />
          <Tab value="orders" label={`委托（${openOrders.length}）`} />
          <Tab value="trades" label="成交" />
          <Tab value="flows" label="交割 / 流水" />
        </Tabs>
      </Box>

      {/* Tab 内容 */}
      {tab === 'positions' && (
        <PositionsTable positions={mergedPositions} onQuickOrder={(input) => handleQuickOrder(input)} />
      )}
      {tab === 'orders' && <OrdersTable orders={orders} onChanged={() => void loadAll()} />}
      {tab === 'trades' && <TradesTable trades={trades} />}
      {tab === 'flows' && <CashFlowTable cashFlows={flows} />}

      {tab === 'positions' && mergedPositions.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2.25, fontSize: 11.5, color: MUJI.ink3, letterSpacing: '0.05em' }}>
          <span>＊ 可卖数量 = 0 表示今日买入，受 A股 T+1 规则限制，次一交易日方可卖出</span>
          <span className="num">共 {mergedPositions.length} 只持仓 · 市值合计 {formatYuanSymbol(overview.marketValue)}</span>
        </Box>
      )}
    </Box>
  );
}

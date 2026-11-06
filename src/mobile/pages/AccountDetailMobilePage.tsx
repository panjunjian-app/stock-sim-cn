/**
 * AccountDetailMobilePage — M6 账户详情（移动版）：
 * 资产总览 2×2 网格 + 四 Tab（持仓/委托/成交/流水）卡片流。
 * 持仓卡片「交易」跳全屏下单页；「一键清仓」与撤单带二次确认；
 * 轮询复用 useQuotePolling（含 tick 撮合驱动）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, IconButton, Snackbar, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { CashFlow, Order, Position, Quote, Symbol as StockSymbol, Trade } from '../../../shared/types';
import { formatYuanSymbol } from '../../../shared/money';
import { MUJI } from '../../theme/muji-theme';
import { accountApi } from '../../services/account-api';
import { ApiError } from '../../services/http';
import { computeOverview, mergePositions } from '../../utils/overview';
import { useQuotePolling } from '../../hooks/use-quote-polling';
import { useQuoteStore } from '../../store/quote-store';
import MarketStatusBanner from '../../components/MarketStatusBanner';
import AssetSummaryGrid from '../components/AssetSummaryGrid';
import PositionCard from '../components/PositionCard';
import OrderCard from '../components/OrderCard';
import { CashFlowRecordList, TradeRecordList } from '../components/RecordCardList';
import SegmentedControl from '../components/SegmentedControl';

type DetailTab = 'positions' | 'orders' | 'trades' | 'flows';

interface OverviewBaseState {
  accountId: number;
  name: string;
  cashAvailable: number;
  frozenCash: number;
  totalDeposit: number;
  prevSettledTotal?: number | null;
}

interface SnackState {
  text: string;
  ok: boolean;
}

const TAB_OPTIONS: Array<{ value: DetailTab; label: string }> = [
  { value: 'positions', label: '持仓' },
  { value: 'orders', label: '委托' },
  { value: 'trades', label: '成交' },
  { value: 'flows', label: '流水' },
];

export default function AccountDetailMobilePage() {
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
  const [snack, setSnack] = useState<SnackState | null>(null);
  const [liquidateTarget, setLiquidateTarget] = useState<Position | null>(null);
  const [acting, setActing] = useState(false);

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
    for (const p of positions) set.add(p.symbol);
    for (const o of orders) {
      if (o.status === 'pending' || o.status === 'partial') set.add(o.symbol);
    }
    return Array.from(set);
  }, [positions, orders]);
  const { quotes: polled } = useQuotePolling(pollSymbols, { accountId, enabled: pollSymbols.length > 0 });
  const quotes: Record<StockSymbol, Quote> = polled ?? cachedQuotes;

  const overview = base ? computeOverview(base, positions, quotes) : null;
  const mergedPositions = useMemo(() => mergePositions(positions, quotes), [positions, quotes]);
  const openOrders = orders.filter((o) => o.status === 'pending' || o.status === 'partial');

  /** 一键清仓：市价卖出全部可卖数量 */
  const liquidate = async (): Promise<void> => {
    const p = liquidateTarget;
    if (!p) return;
    const sellable = p.availableQty - p.frozenQty;
    if (sellable <= 0) {
      setLiquidateTarget(null);
      setSnack({ text: '可卖数量不足（T+1 限制或已冻结）', ok: false });
      return;
    }
    setActing(true);
    try {
      const result = await accountApi.submitOrder(accountId, {
        symbol: p.symbol,
        side: 'sell',
        orderType: 'market',
        quantity: sellable,
      });
      setLiquidateTarget(null);
      if (result.order.status === 'rejected') {
        setSnack({ text: result.order.rejectReason ?? '委托被拒绝', ok: false });
      } else {
        setSnack({ text: `「${p.symbolName}」清仓委托已提交`, ok: true });
      }
      await loadAll();
    } catch (e) {
      setSnack({ text: e instanceof ApiError ? e.message : '清仓失败，请稍后重试', ok: false });
    } finally {
      setActing(false);
    }
  };

  /** 撤单（OrderCard 回调，约定不向外抛错） */
  const cancelOrder = async (order: Order): Promise<void> => {
    try {
      await accountApi.cancelOrder(order.id);
      setSnack({ text: `「${order.symbolName}」委托已撤销`, ok: true });
      await loadAll();
    } catch (e) {
      setSnack({ text: e instanceof ApiError ? e.message : '撤单失败，请稍后重试', ok: false });
    }
  };

  if (error) {
    return (
      <Box sx={{ flex: 1, p: 3 }}>
        <Typography sx={{ fontSize: 13, color: MUJI.up, mb: 2 }}>{error}</Typography>
        <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => navigate('/accounts')}>
          返回账户列表
        </Button>
      </Box>
    );
  }
  if (!overview) {
    return (
      <Box sx={{ flex: 1, p: 4 }}>
        <Typography sx={{ fontSize: 13, color: MUJI.ink3, letterSpacing: '0.1em' }}>加载中…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* 顶栏：返回 + 账户名 + 市场状态 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.75, bgcolor: MUJI.card, borderBottom: `1px solid ${MUJI.line}` }}>
        <IconButton aria-label="返回账户列表" onClick={() => navigate('/accounts')} sx={{ width: 44, height: 44 }}>
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14.5, fontWeight: 500, color: MUJI.ink }} noWrap>
            {overview.name}
            <Typography component="span" className="num" sx={{ fontSize: 11, color: MUJI.ink3, ml: 1 }}>
              No.{overview.accountId}
            </Typography>
          </Typography>
        </Box>
        <Box sx={{ pr: 1 }}>
          <MarketStatusBanner />
        </Box>
      </Box>

      <Box sx={{ flex: 1, px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 资产总览 2×2 */}
        <AssetSummaryGrid
          totalAsset={overview.totalAsset}
          cashAvailable={overview.cashAvailable}
          marketValue={overview.marketValue}
          dayPnl={overview.dayPnl}
          dayPnlPct={overview.dayPnlPct}
        />
        <Typography className="num" sx={{ fontSize: 11, color: MUJI.ink3 }}>
          在途冻结 {formatYuanSymbol(overview.frozenCash)} · 累计盈亏 {formatYuanSymbol(overview.totalPnl)} · 本金 {formatYuanSymbol(overview.totalDeposit)}
        </Typography>

        {/* 四 Tab（可横向滚动） */}
        <SegmentedControl value={tab} options={TAB_OPTIONS} onChange={setTab} scrollable />

        {/* 持仓卡片流 */}
        {tab === 'positions' && (
          mergedPositions.length === 0 ? (
            <Typography sx={{ py: 4, textAlign: 'center', fontSize: 12.5, color: MUJI.ink3 }}>暂无持仓，去行情页挑选第一只股票吧</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {mergedPositions.map((p) => (
                <PositionCard
                  key={p.symbol}
                  position={p}
                  quote={quotes[p.symbol]}
                  onTrade={() => navigate(`/order/${p.symbol}`)}
                  onLiquidate={() => setLiquidateTarget(p)}
                />
              ))}
              <Typography sx={{ fontSize: 10.5, color: MUJI.ink3, lineHeight: 1.8 }}>
                ＊ 可卖数量 = 0 表示今日买入，受 A股 T+1 规则限制，次一交易日方可卖出
              </Typography>
            </Box>
          )
        )}

        {/* 委托卡片流 */}
        {tab === 'orders' && (
          orders.length === 0 ? (
            <Typography sx={{ py: 4, textAlign: 'center', fontSize: 12.5, color: MUJI.ink3 }}>暂无委托记录</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {orders.map((o) => (
                <OrderCard key={o.id} order={o} onCancel={cancelOrder} />
              ))}
            </Box>
          )
        )}

        {/* 成交 / 流水时间线 */}
        {tab === 'trades' && <TradeRecordList trades={trades} />}
        {tab === 'flows' && <CashFlowRecordList cashFlows={flows} />}
      </Box>

      {/* 一键清仓二次确认 */}
      <Dialog open={liquidateTarget !== null} onClose={() => !acting && setLiquidateTarget(null)} fullWidth maxWidth="xs">
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13.5, lineHeight: 1.9 }}>
            确认一键清仓「{liquidateTarget?.symbolName}」吗？
            <br />
            将以市价委托卖出全部可卖数量（{liquidateTarget ? liquidateTarget.availableQty - liquidateTarget.frozenQty : 0} 股），按成交结果结算。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.25 }}>
          <Button disabled={acting} onClick={() => setLiquidateTarget(null)} sx={{ flex: 1, minHeight: 44, color: MUJI.ink2 }}>
            取消
          </Button>
          <Button disabled={acting} onClick={() => void liquidate()} sx={{ flex: 1, minHeight: 44, color: MUJI.down }}>
            {acting ? '委托中…' : '确认清仓'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 结果 Snackbar */}
      <Snackbar
        open={snack !== null}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message={snack?.text ?? ''}
        sx={{ '& .MuiSnackbarContent-root': { bgcolor: snack?.ok ? MUJI.down : MUJI.up } }}
      />
    </Box>
  );
}

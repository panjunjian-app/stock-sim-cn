/**
 * OrderMobilePage — M4 全屏下单页（/order/:symbol?side=buy|sell）：
 * 股票信息头 + 账户选择 + 买/卖 Segmented + 限价/市价 + 价格/数量
 * （inputMode 数字键盘 + 步进）+ 可用资金/可卖股数 + 费用预估 +
 * OrderConfirmDialog 二次确认（复用 PC 组件）；废单原因顶部 Snackbar。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, IconButton, MenuItem, Snackbar, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { AccountInfo, OrderInput, Position, Quote, Side, Symbol as StockSymbol } from '../../../shared/types';
import { calcBuyFreeze, calcFees } from '../../../shared/fees';
import { formatYuan, formatYuanSymbol, toCents } from '../../../shared/money';
import { isStName, priceLimitRange, sideText } from '../../../shared/validate';
import { MUJI } from '../../theme/muji-theme';
import { accountApi } from '../../services/account-api';
import { ApiError } from '../../services/http';
import { useTradingTime } from '../../hooks/use-trading-time';
import { useQuotePolling } from '../../hooks/use-quote-polling';
import { useQuoteStore } from '../../store/quote-store';
import MarketStatusBanner from '../../components/MarketStatusBanner';
import OrderConfirmDialog from '../../components/OrderConfirmDialog';
import SegmentedControl from '../components/SegmentedControl';
import PriceField from '../components/PriceField';

type OrderTypeKind = 'limit' | 'market';

interface SnackState {
  text: string;
  ok: boolean;
}

export default function OrderMobilePage() {
  const params = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const symbol = params.symbol ?? '';
  const { isOpen } = useTradingTime();

  const [side, setSide] = useState<Side>(searchParams.get('side') === 'sell' ? 'sell' : 'buy');
  const [orderType, setOrderType] = useState<OrderTypeKind>('limit');
  const [priceYuan, setPriceYuan] = useState('');
  const [qtyText, setQtyText] = useState('');

  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [cashAvailable, setCashAvailable] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<SnackState | null>(null);

  const isBuy = side === 'buy';

  // 账户列表（首次默认选第一个）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accounts: list } = await accountApi.listAccounts();
        if (cancelled || list.length === 0) return;
        setAccounts(list);
        setAccountId(list[0].id);
      } catch {
        /* 静默：无账户时提交前会提示 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 选中账户的资金与持仓
  const loadAccountContext = useCallback(async (id: number) => {
    const [{ account }, { positions: ps }] = await Promise.all([accountApi.getAccount(id), accountApi.getPositions(id)]);
    setCashAvailable(account.cashAvailable);
    setPositions(ps);
  }, []);

  useEffect(() => {
    if (accountId === null) return;
    void loadAccountContext(accountId).catch(() => undefined);
  }, [accountId, loadAccountContext]);

  const position = positions.find((p) => p.symbol === symbol);

  // 行情轮询（含 tick 撮合驱动）
  const { quotes: polled } = useQuotePolling(symbol ? [symbol as StockSymbol] : [], { accountId: accountId ?? undefined });
  const cachedQuotes = useQuoteStore((s) => s.quotes);
  const quote: Quote | undefined = polled[symbol as StockSymbol] ?? cachedQuotes[symbol as StockSymbol];

  const qty = parseInt(qtyText, 10) || 0;
  const inputPrice = priceYuan.trim() === '' ? NaN : toCents(priceYuan);

  const limits = useMemo(() => {
    if (!quote || quote.prevClose <= 0) return null;
    return priceLimitRange(quote.prevClose, isStName(quote.name));
  }, [quote]);

  const estPriceCents = orderType === 'market' ? quote?.price ?? 0 : Number.isNaN(inputPrice) ? 0 : inputPrice;
  const estAmount = estPriceCents * qty;
  const estFees = qty > 0 && estPriceCents > 0 ? calcFees(estAmount, side) : null;
  const maxBuyLots =
    quote && orderType === 'limit' && !Number.isNaN(inputPrice) && inputPrice > 0
      ? Math.floor(cashAvailable / calcBuyFreeze(100, inputPrice)) * 100
      : orderType === 'market' && quote
        ? Math.floor(cashAvailable / calcBuyFreeze(100, quote.price)) * 100
        : 0;
  const sellable = position ? position.availableQty - position.frozenQty : 0;

  const validate = (): string | null => {
    if (!quote || quote.price <= 0) return '行情不可用，暂无法委托（可能停牌）';
    if (!isOpen) return '当前非交易时段，无法委托';
    if (qty <= 0 || qty % 100 !== 0) return '委托数量须为 100 股整数倍（1 手 = 100 股）';
    if (orderType === 'limit') {
      if (Number.isNaN(inputPrice) || inputPrice <= 0) return '请输入有效的委托价格';
      if (limits && (inputPrice > limits.limitUp || inputPrice < limits.limitDown)) return '委托价格超出涨跌停范围';
    }
    if (isBuy) {
      const need = orderType === 'limit' ? calcBuyFreeze(qty, inputPrice) : quote.price * qty * 1.001;
      if (need > cashAvailable) return '可用资金不足';
    } else if (qty > sellable) {
      return sellable <= 0 ? '可卖数量不足（T+1 限制或已冻结）' : '可卖数量不足';
    }
    return null;
  };

  const openConfirm = (): void => {
    const err = validate();
    if (err) {
      setSnack({ text: err, ok: false });
      return;
    }
    setConfirmOpen(true);
  };

  // 提交委托：返回错误信息（null=成功）
  const submitOrder = async (input: OrderInput): Promise<string | null> => {
    if (accountId === null) return '尚未开立交易账户，请先到「账户」开户';
    try {
      const result = await accountApi.submitOrder(accountId, input);
      if (result.order.status === 'rejected') {
        return result.order.rejectReason ?? '委托被拒绝';
      }
      if (result.matched) {
        await loadAccountContext(accountId).catch(() => undefined);
        setSnack({ text: '委托已成交', ok: true });
      } else {
        setSnack({ text: '委托已提交，等待行情触发成交', ok: true });
      }
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.message : '委托失败，请稍后重试';
    }
  };

  const confirm = async (): Promise<void> => {
    setSubmitting(true);
    try {
      const err = await submitOrder({
        symbol,
        side,
        orderType,
        price: orderType === 'limit' && !Number.isNaN(inputPrice) ? inputPrice : null,
        quantity: qty,
      });
      setConfirmOpen(false);
      if (err) {
        setSnack({ text: err, ok: false });
      } else {
        setQtyText('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = (): void => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/market');
    }
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%', bgcolor: MUJI.paper }}>
      {/* 顶栏：返回 + 标的 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.75, bgcolor: MUJI.card, borderBottom: `1px solid ${MUJI.line}` }}>
        <IconButton aria-label="返回" onClick={goBack} sx={{ width: 44, height: 44 }}>
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14.5, fontWeight: 500, color: MUJI.ink }}>
            {sideText(side)} · {quote?.name ?? symbol.replace(/^(sh|sz)/, '')}
          </Typography>
          <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3 }}>
            {symbol.replace(/^(sh|sz)/, '')} · {symbol.startsWith('sh') ? '沪A' : '深A'} · 现价 {quote ? formatYuan(quote.price) : '—'}
          </Typography>
        </Box>
      </Box>

      {/* 表单区 */}
      <Box sx={{ flex: 1, px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SegmentedControl
          value={side}
          options={[
            { value: 'buy' as Side, label: '买入' },
            { value: 'sell' as Side, label: '卖出' },
          ]}
          onChange={setSide}
        />

        {accounts.length > 0 && (
          <TextField
            select
            fullWidth
            label="交易账户"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(Number(e.target.value))}
            sx={{ '& .MuiInputBase-root': { height: 48, bgcolor: MUJI.card } }}
          >
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id} sx={{ fontSize: 13 }}>
                {a.contestId ? '🏁 ' : ''}
                {a.contestId ? a.contestName || a.name : a.name}
                <Box component="span" sx={{ ml: 1, fontSize: 11, color: MUJI.ink3 }} className="num">
                  {formatYuanSymbol(a.cashAvailable)}
                </Box>
              </MenuItem>
            ))}
          </TextField>
        )}

        <SegmentedControl
          value={orderType}
          options={[
            { value: 'limit' as OrderTypeKind, label: '限价委托' },
            { value: 'market' as OrderTypeKind, label: '市价委托' },
          ]}
          onChange={setOrderType}
        />

        {orderType === 'limit' && (
          <PriceField
            label="委托价格（元）"
            value={priceYuan}
            onChange={setPriceYuan}
            step={0.01}
            placeholder={quote ? (quote.price / 100).toFixed(2) : '0.00'}
            hint={limits ? `涨停 ${formatYuan(limits.limitUp)} · 跌停 ${formatYuan(limits.limitDown)}` : undefined}
          />
        )}

        <PriceField
          label="委托数量（股）"
          value={qtyText}
          onChange={(v) => setQtyText(v.replace(/\D/g, '').slice(0, 7))}
          step={100}
          placeholder="100 的整数倍"
          hint={isBuy ? `可买上限 ${maxBuyLots} 股 · 可用资金 ${formatYuanSymbol(cashAvailable)}` : `可卖数量 ${sellable} 股 · 可用资金 ${formatYuanSymbol(cashAvailable)}`}
        />

        {/* 市值与费用预估 */}
        <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', px: 2, py: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em' }}>预估金额</Typography>
            <Typography className="num" sx={{ fontSize: 19, fontWeight: 500 }}>
              {estAmount > 0 ? formatYuanSymbol(estAmount) : '—'}
            </Typography>
          </Box>
          {estFees && (
            <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3, mt: 0.5 }}>
              费用预估：佣金 {formatYuan(estFees.commission)} · 印花税 {formatYuan(estFees.stamp)} · 过户费 {formatYuan(estFees.transfer)}
            </Typography>
          )}
          <Typography sx={{ fontSize: 10.5, color: MUJI.ink3, mt: 0.75, lineHeight: 1.8 }}>
            ＊ 模拟盘遵循 A股交易规则：T+1、±10% 涨跌幅（ST ±5%）、按手交易
          </Typography>
        </Box>

        {!isOpen && (
          <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', p: 1.5 }}>
            <MarketStatusBanner />
            <Typography sx={{ fontSize: 10.5, color: MUJI.ink3, mt: 0.5 }}>休市期间委托将被拒绝</Typography>
          </Box>
        )}
      </Box>

      {/* 底部全宽确认按钮（≥48px） */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          px: 2,
          pt: 1.25,
          pb: 'calc(12px + env(safe-area-inset-bottom))',
          bgcolor: MUJI.card,
          borderTop: `1px solid ${MUJI.line}`,
          marginTop: 'auto',
        }}
      >
        <Box
          component="button"
          onClick={openConfirm}
          disabled={!quote}
          sx={{
            width: '100%',
            height: 48,
            border: 'none',
            borderRadius: '4px',
            bgcolor: isBuy ? MUJI.up : MUJI.down,
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '0.1em',
            cursor: quote ? 'pointer' : 'default',
            opacity: quote ? 1 : 0.55,
          }}
        >
          {isBuy ? '买入' : '卖出'}
        </Box>
      </Box>

      {/* 二次确认（复用 PC OrderConfirmDialog） */}
      <OrderConfirmDialog
        open={confirmOpen}
        input={{
          symbol,
          side,
          orderType,
          price: orderType === 'limit' && !Number.isNaN(inputPrice) ? inputPrice : null,
          quantity: qty,
        }}
        quote={quote}
        cashAvailable={cashAvailable}
        submitting={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void confirm()}
      />

      {/* 错误 / 结果统一 Snackbar（顶部） */}
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

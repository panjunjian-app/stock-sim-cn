import { useMemo, useState } from 'react';
import { Box, MenuItem, TextField, Typography, Button } from '@mui/material';
import type { AccountInfo, OrderInput, Position, Quote, Side } from '../../shared/types';
import { calcBuyFreeze, calcFees } from '../../shared/fees';
import { formatYuan, formatYuanSymbol, toCents } from '../../shared/money';
import { isStName, priceLimitRange } from '../../shared/validate';
import { useTradingTime } from '../hooks/use-trading-time';
import { MUJI } from '../theme/muji-theme';
import OrderConfirmDialog from './OrderConfirmDialog';
import MarketStatusBanner from './MarketStatusBanner';

export interface OrderPanelProps {
  symbol: string;
  quote: Quote | undefined;
  /** 该标的当前持仓（可卖数量） */
  position: Position | undefined;
  /** 账户可用资金（分） */
  cashAvailable: number;
  /** 全部可交易账户（个人 + 比赛） */
  accounts: AccountInfo[];
  /** 当前选中的交易账户 */
  selectedAccountId: number | null;
  /** 切换交易账户 */
  onSelectAccount: (id: number) => void;
  /** 提交委托；返回错误信息（null=成功） */
  onSubmit: (input: OrderInput) => Promise<string | null>;
}

/**
 * OrderPanel — 账户选择（个人/比赛）、买/卖切换、限价/市价、价格数量输入、可买/可卖上限、费用预估
 */
export default function OrderPanel({
  symbol,
  quote,
  position,
  cashAvailable,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onSubmit,
}: OrderPanelProps) {
  const { isOpen } = useTradingTime();
  const [side, setSide] = useState<Side>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [priceYuan, setPriceYuan] = useState('');
  const [qtyText, setQtyText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const isBuy = side === 'buy';
  const accent = isBuy ? MUJI.up : MUJI.down;

  const qty = parseInt(qtyText, 10) || 0;
  const inputPrice = priceYuan.trim() === '' ? NaN : toCents(priceYuan);

  const limits = useMemo(() => {
    if (!quote || quote.prevClose <= 0) {
      return null;
    }
    return priceLimitRange(quote.prevClose, isStName(quote.name));
  }, [quote]);

  const lastPriceYuan = quote ? (quote.price / 100).toFixed(2) : '';

  const estPriceCents = orderType === 'market' ? (quote?.price ?? 0) : Number.isNaN(inputPrice) ? 0 : inputPrice;
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
    if (!quote || quote.price <= 0) {
      return '行情不可用，暂无法委托（可能停牌）';
    }
    if (!isOpen) {
      return '当前非交易时段，无法委托';
    }
    if (qty <= 0 || qty % 100 !== 0) {
      return '委托数量须为 100 股整数倍（1 手 = 100 股）';
    }
    if (orderType === 'limit') {
      if (Number.isNaN(inputPrice) || inputPrice <= 0) {
        return '请输入有效的委托价格';
      }
      if (limits && (inputPrice > limits.limitUp || inputPrice < limits.limitDown)) {
        return '委托价格超出涨跌停范围';
      }
    }
    if (isBuy) {
      const need = orderType === 'limit' ? calcBuyFreeze(qty, inputPrice) : quote.price * qty * 1.001;
      if (need > cashAvailable) {
        return '可用资金不足';
      }
    } else if (qty > sellable) {
      return sellable <= 0 ? '可卖数量不足（T+1 限制或已冻结）' : '可卖数量不足';
    }
    return null;
  };

  const openConfirm = () => {
    const err = validate();
    if (err) {
      setFeedback({ ok: false, text: err });
      return;
    }
    setFeedback(null);
    setConfirmOpen(true);
  };

  const confirm = async () => {
    setSubmitting(true);
    try {
      const err = await onSubmit({
        symbol,
        side,
        orderType,
        price: orderType === 'limit' ? inputPrice : null,
        quantity: qty,
      });
      setConfirmOpen(false);
      setFeedback(err ? { ok: false, text: err } : { ok: true, text: '委托已提交，成交结果见账户详情页' });
      if (!err) {
        setQtyText('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputSx = {
    '& .MuiInputBase-root': { bgcolor: MUJI.card, fontSize: 14, fontWeight: 400, height: 40 },
  } as const;

  return (
    <Box sx={{ flex: '0 0 292px', bgcolor: MUJI.card, borderLeft: `1px solid ${MUJI.line}`, p: '20px 24px', display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
      {/* 买/卖 Tab */}
      <Box sx={{ display: 'flex', borderBottom: `1px solid ${MUJI.line}` }}>
        {(['buy', 'sell'] as Side[]).map((s) => {
          const active = side === s;
          const c = s === 'buy' ? MUJI.up : MUJI.down;
          return (
            <Box
              key={s}
              onClick={() => setSide(s)}
              sx={{
                flex: 1,
                textAlign: 'center',
                fontSize: 14,
                fontWeight: 400,
                letterSpacing: '0.08em',
                py: 1.25,
                cursor: 'pointer',
                color: active ? c : MUJI.ink3,
                borderBottom: `1.5px solid ${active ? c : 'transparent'}`,
                mb: '-1px',
              }}
            >
              {s === 'buy' ? '买入' : '卖出'}
            </Box>
          );
        })}
      </Box>

      {/* 交易账户选择（个人 / 比赛） */}
      {accounts.length > 0 && (
        <>
          <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2.5, mb: 1 }}>交易账户</Typography>
          <TextField
            select
            fullWidth
            value={selectedAccountId ?? ''}
            onChange={(e) => onSelectAccount(Number(e.target.value))}
            sx={inputSx}
          >
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id} sx={{ fontSize: 13 }}>
                {a.contestId ? '🏁 ' : ''}
                {a.contestId ? (a.contestName || a.name) : a.name}
                <Box component="span" sx={{ ml: 1, fontSize: 11.5, color: MUJI.ink3 }}>
                  ¥{(a.cashAvailable / 100).toLocaleString('zh-CN')}
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </>
      )}

      <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2.5, mb: 1 }}>委托类型</Typography>
      <TextField
        select
        fullWidth
        value={orderType}
        onChange={(e) => {
          setOrderType(e.target.value as 'limit' | 'market');
          setPriceYuan('');
        }}
        sx={inputSx}
      >
        <MenuItem value="limit" sx={{ fontSize: 13 }}>限价委托</MenuItem>
        <MenuItem value="market" sx={{ fontSize: 13 }}>市价委托（按最新价）</MenuItem>
      </TextField>

      {orderType === 'limit' && (
        <>
          <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2.5, mb: 1 }}>委托价格（元）</Typography>
          <TextField
            fullWidth
            placeholder={lastPriceYuan || '0.00'}
            value={priceYuan}
            onChange={(e) => setPriceYuan(e.target.value.replace(/[^\d.]/g, ''))}
            inputProps={{ inputMode: 'decimal' }}
            sx={inputSx}
          />
        </>
      )}
      {limits && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MUJI.ink3, mt: 1.75 }} className="num">
          <span>
            涨停价 <b style={{ color: MUJI.up, fontWeight: 400 }}>{formatYuan(limits.limitUp)}</b>
          </span>
          <span>
            跌停价 <b style={{ color: MUJI.down, fontWeight: 400 }}>{formatYuan(limits.limitDown)}</b>
          </span>
        </Box>
      )}

      <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2.5, mb: 1 }}>委托数量（股）</Typography>
      <TextField
        fullWidth
        placeholder="100 的整数倍"
        value={qtyText}
        onChange={(e) => setQtyText(e.target.value.replace(/\D/g, '').slice(0, 7))}
        inputProps={{ inputMode: 'numeric' }}
        sx={inputSx}
      />
      <Typography sx={{ fontSize: 11, color: MUJI.ink3, mt: 0.75 }}>＊ 须为 100 股整数倍（1 手 = 100 股）</Typography>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MUJI.ink3, mt: 1.75 }} className="num">
        <span>{isBuy ? '可买上限' : '可卖数量'}</span>
        <b style={{ color: MUJI.ink, fontWeight: 400 }}>{isBuy ? `${maxBuyLots} 股` : `${sellable} 股`}</b>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MUJI.ink3, mt: 1 }} className="num">
        <span>可用资金</span>
        <b style={{ color: MUJI.ink, fontWeight: 400 }}>{formatYuanSymbol(cashAvailable)}</b>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 2.75, pt: 2, borderTop: `1px solid ${MUJI.lineSoft}` }}>
        <span style={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em' }}>预估金额</span>
        <span className="num" style={{ fontSize: 20, fontWeight: 500 }}>
          {estAmount > 0 ? formatYuanSymbol(estAmount) : '—'}
        </span>
      </Box>
      {estFees && (
        <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3, mt: 0.75 }}>
          费用预估：佣金 {formatYuan(estFees.commission)} · 印花税 {formatYuan(estFees.stamp)} · 过户费 {formatYuan(estFees.transfer)}
        </Typography>
      )}

      <Button
        fullWidth
        variant="contained"
        sx={{ height: 46, mt: 2.25, fontSize: 15, bgcolor: accent }}
        onClick={openConfirm}
      >
        {isBuy ? '买入' : '卖出'}
      </Button>
      {feedback && (
        <Typography sx={{ fontSize: 11.5, mt: 1.5, color: feedback.ok ? MUJI.down : MUJI.up }}>
          {feedback.ok ? '✓ ' : '✕ '}
          {feedback.text}
        </Typography>
      )}
      <Typography sx={{ mt: 1.5, fontSize: 10.5, color: MUJI.ink3, lineHeight: 1.9, letterSpacing: '0.05em' }}>
        ＊ 模拟盘遵循 A股交易规则：T+1、±10% 涨跌幅（ST ±5%）、按手交易
        <br />＊ 模拟费用：佣金万2.5（最低 ¥5）· 印花税 0.05%（卖出）· 过户费 0.001%
      </Typography>

      {!isOpen && (
        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Box sx={{ bgcolor: MUJI.paper, border: `1px solid ${MUJI.line}`, borderRadius: '2px', p: 1.5 }}>
            <MarketStatusBanner />
            <Typography sx={{ fontSize: 10.5, color: MUJI.ink3, mt: 0.5 }}>休市期间委托将被拒绝</Typography>
          </Box>
        </Box>
      )}

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
    </Box>
  );
}

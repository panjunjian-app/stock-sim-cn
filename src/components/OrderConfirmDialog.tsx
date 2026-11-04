import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { OrderInput, Quote } from '../../shared/types';
import { calcFees } from '../../shared/fees';
import { formatYuan, formatYuanSymbol } from '../../shared/money';
import { sideText } from '../../shared/validate';
import { MUJI } from '../theme/muji-theme';

export interface OrderConfirmDialogProps {
  open: boolean;
  input: OrderInput | null;
  quote: Quote | undefined;
  /** 账户可用资金（分） */
  cashAvailable: number;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** OrderConfirmDialog — ⑥ 下单确认弹窗（纸卡细线框 + 费用明细） */
export default function OrderConfirmDialog({ open, input, quote, cashAvailable, submitting, onCancel, onConfirm }: OrderConfirmDialogProps) {
  if (!input) {
    return null;
  }
  const price = input.orderType === 'market' ? (quote?.price ?? 0) : (input.price ?? 0);
  const amount = price * input.quantity;
  const fees = calcFees(amount, input.side);
  const isBuy = input.side === 'buy';
  const totalCost = isBuy ? amount + fees.total : amount - fees.total;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth={false} PaperProps={{ sx: { width: 420, bgcolor: MUJI.card } }}>
      <DialogTitle sx={{ fontWeight: 400, letterSpacing: '0.08em', fontSize: 15 }}>
        确认{sideText(input.side)}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            bgcolor: isBuy ? MUJI.upBg : MUJI.downBg,
            borderRadius: '2px',
            p: 1.75,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 1,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 400, letterSpacing: '0.1em' }}>{quote?.name ?? input.symbol}</Typography>
            <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3, mt: 0.5 }}>
              {input.symbol.replace(/^(sh|sz)/, '')} · {input.symbol.startsWith('sh') ? '沪A' : '深A'} ·{' '}
              {input.orderType === 'limit' ? '限价委托' : '市价委托'}
            </Typography>
          </Box>
          <Typography className="num" sx={{ fontSize: 15, fontWeight: 400, color: isBuy ? MUJI.up : MUJI.down }}>
            {price > 0 ? formatYuanSymbol(price) : '—'}
          </Typography>
        </Box>
        <Box sx={{ mt: 1 }}>
          {(
            [
              ['委托价格', price > 0 ? `${formatYuanSymbol(price)}` : '按最新价成交'],
              ['委托数量', `${input.quantity} 股（${input.quantity / 100} 手）`],
              ['预估金额', formatYuanSymbol(amount)],
              ['可用资金', formatYuanSymbol(cashAvailable)],
            ] as Array<[string, string]>
          ).map(([k, v]) => (
            <Box
              key={k}
              className="num"
              sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, py: 1.25, px: 0.25, borderBottom: `1px solid ${MUJI.lineSoft}` }}
            >
              <span style={{ color: MUJI.ink3, letterSpacing: '0.1em' }}>{k}</span>
              <span>{v}</span>
            </Box>
          ))}
        </Box>
        <Box sx={{ bgcolor: MUJI.paper2, borderRadius: '2px', p: 1.5, px: 1.9, mt: 1.5, fontSize: 10.5, color: MUJI.ink3, lineHeight: 2 }} className="num">
          预估{isBuy ? '费用合计' : '净入金额'} <b style={{ color: MUJI.ink }}>{formatYuanSymbol(isBuy ? fees.total : totalCost)}</b>　
          佣金 {formatYuan(fees.commission)} · 印花税 {formatYuan(fees.stamp)}（卖出时收取）· 过户费 {formatYuan(fees.transfer)}
          <br />
          实际以成交结果为准，模拟费用仅供练习参考
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" onClick={onCancel} sx={{ flex: 1, height: 44, color: MUJI.ink2 }}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={submitting || price <= 0}
          sx={{ flex: 1, height: 44, bgcolor: isBuy ? MUJI.up : MUJI.down }}
        >
          {submitting ? '委托中…' : `确认${sideText(input.side)}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

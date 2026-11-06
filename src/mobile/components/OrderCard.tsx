/**
 * OrderCard — 委托卡片：方向/标的/价格/数量/状态，进行中委托附带
 * ≥44px「撤单」按钮 + 二次确认弹窗（错误提示由页面 Snackbar 统一处理）。
 */
import { useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, Typography } from '@mui/material';
import type { Order } from '../../../shared/types';
import { formatYuan, formatYuanSymbol } from '../../../shared/money';
import { sideText } from '../../../shared/validate';
import { MUJI } from '../../theme/muji-theme';

const STATUS_TEXT: Record<Order['status'], string> = {
  pending: '待成交',
  partial: '部分成交',
  filled: '已成交',
  cancelled: '已撤单',
  rejected: '已废单',
};

export interface OrderCardProps {
  order: Order;
  /** 撤单动作（页面负责错误提示与刷新，约定不向外抛错） */
  onCancel: (order: Order) => Promise<void>;
}

export default function OrderCard({ order, onCancel }: OrderCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const isBuy = order.side === 'buy';
  const actionable = order.status === 'pending' || order.status === 'partial';

  const doCancel = async (): Promise<void> => {
    setCancelling(true);
    try {
      await onCancel(order);
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  };

  return (
    <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', px: 2, py: 1.5 }}>
      {/* 方向 / 标的 / 状态 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          className="num"
          sx={{ fontSize: 11.5, px: 1, py: '2px', borderRadius: '3px', bgcolor: isBuy ? MUJI.upBg : MUJI.downBg, color: isBuy ? MUJI.up : MUJI.down }}
        >
          {sideText(order.side)}
        </Box>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: MUJI.ink }}>{order.symbolName}</Typography>
        <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3 }}>
          {order.symbol.replace(/^(sh|sz)/, '')}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: order.status === 'rejected' ? MUJI.up : MUJI.ink3, ml: 'auto' }}>
          {STATUS_TEXT[order.status]}
        </Typography>
      </Box>

      {/* 明细 */}
      <Box className="num" sx={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', mt: 1, fontSize: 11.5, color: MUJI.ink3 }}>
        <span>{order.orderType === 'limit' ? `限价 ${order.price !== null ? formatYuan(order.price) : '—'}` : '市价委托'}</span>
        <span>数量 {order.quantity} 股</span>
        {order.filledQty > 0 && <span>已成交 {order.filledQty} 股</span>}
        {order.avgPrice !== null && order.avgPrice > 0 && <span>均价 {formatYuan(order.avgPrice)}</span>}
        <span>冻结 {formatYuanSymbol(order.frozenCash)}</span>
      </Box>

      {order.status === 'rejected' && order.rejectReason && (
        <Typography sx={{ fontSize: 11.5, color: MUJI.up, mt: 0.75 }}>废单原因：{order.rejectReason}</Typography>
      )}

      <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3, mt: 0.75 }}>
        {order.createdAt.slice(0, 19).replace('T', ' ')}（UTC）提交
      </Typography>

      {/* 撤单按钮（≥44px，常显，二次确认） */}
      {actionable && (
        <Button
          fullWidth
          variant="outlined"
          onClick={() => setConfirmOpen(true)}
          sx={{ minHeight: 44, mt: 1.25, fontSize: 13.5, color: MUJI.up, borderColor: MUJI.up, '&:hover': { borderColor: MUJI.up } }}
        >
          撤单
        </Button>
      )}

      {/* 撤单二次确认 */}
      <Dialog open={confirmOpen} onClose={() => !cancelling && setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13.5, lineHeight: 1.9 }}>
            确定撤销「{sideText(order.side)} {order.symbolName} {order.quantity} 股」的委托吗？
            <br />
            已冻结资金/股票将立即解冻。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.25 }}>
          <Button disabled={cancelling} onClick={() => setConfirmOpen(false)} sx={{ flex: 1, minHeight: 44, color: MUJI.ink2 }}>
            再等等
          </Button>
          <Button disabled={cancelling} onClick={() => void doCancel()} sx={{ flex: 1, minHeight: 44, color: MUJI.up }}>
            {cancelling ? '撤单中…' : '确认撤单'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

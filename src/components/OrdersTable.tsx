import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper, Button, Typography } from '@mui/material';
import type { Order } from '../../shared/types';
import { formatYuan } from '../../shared/money';
import { isOrderExpired } from '../../shared/order-expiry';
import { MUJI } from '../theme/muji-theme';
import { ApiError } from '../services/http';
import { accountApi } from '../services/account-api';

export interface OrdersTableProps {
  orders: Order[];
  onChanged: () => void;
}

const STATUS_TEXT: Record<Order['status'], string> = {
  pending: '待成交',
  partial: '部分成交',
  filled: '已成交',
  cancelled: '已撤单',
  rejected: '废单',
};

/** 状态文案：系统自动失效（跨交易日未成交）与用户主动撤单共用 cancelled 状态，需区分展示 */
function statusTextOf(o: Order): string {
  return isOrderExpired(o) ? '已失效' : STATUS_TEXT[o.status];
}

const HEADERS = ['时间', '股票名称 / 代码', '方向', '类型', '委托价', '数量', '成交价', '状态', '操作'];

/** OrdersTable — 委托列表（pending/partial 可撤单） */
export default function OrdersTable({ orders, onChanged }: OrdersTableProps) {
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancel = async (orderId: number) => {
    setCancelling(orderId);
    setError(null);
    try {
      await accountApi.cancelOrder(orderId);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '撤单失败');
    } finally {
      setCancelling(null);
    }
  };

  if (orders.length === 0) {
    return (
      <Typography sx={{ p: 4, textAlign: 'center', fontSize: 13, color: MUJI.ink3, letterSpacing: '0.1em' }}>
        暂无委托记录
      </Typography>
    );
  }

  const fmtTime = (iso: string) => `${iso.slice(5, 10)} ${iso.slice(11, 19)}`;
  const hasOpen = orders.some((o) => o.status === 'pending' || o.status === 'partial');

  return (
    <>
      {error && (
        <Typography sx={{ px: 2, py: 1, fontSize: 12, color: MUJI.up }}>{error}</Typography>
      )}
      <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${MUJI.line}`, borderRadius: '0 0 2px 2px', borderTop: 'none' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {HEADERS.map((h, i) => (
                <TableCell key={h} align={i === 0 || i === 1 ? 'left' : 'right'} sx={{ pl: i === 0 ? 3.25 : 2.25, pr: 2.25 }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id} hover>
                <TableCell className="num" sx={{ pl: 3.25 }}>{fmtTime(o.createdAt)}</TableCell>
                <TableCell>
                  <span style={{ letterSpacing: '0.1em' }}>{o.symbolName}</span>
                  <span className="num" style={{ fontSize: 10.5, color: MUJI.ink3, marginLeft: 8 }}>
                    {o.symbol.replace(/^(sh|sz)/, '')}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <Typography component="span" sx={{ color: o.side === 'buy' ? MUJI.up : MUJI.down }}>
                    {o.side === 'buy' ? '买入' : '卖出'}
                  </Typography>
                </TableCell>
                <TableCell align="right">{o.orderType === 'limit' ? '限价' : '市价'}</TableCell>
                <TableCell align="right" className="num">{o.price !== null ? formatYuan(o.price) : '—'}</TableCell>
                <TableCell align="right" className="num">{o.quantity}</TableCell>
                <TableCell align="right" className="num">{o.avgPrice !== null ? formatYuan(o.avgPrice) : '—'}</TableCell>
                <TableCell align="right">
                  <Typography
                    component="span"
                    sx={{
                      color:
                        o.status === 'filled' ? MUJI.down : o.status === 'rejected' ? MUJI.up : MUJI.ink2,
                    }}
                    title={o.rejectReason ?? undefined}
                  >
                    {statusTextOf(o)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {(o.status === 'pending' || o.status === 'partial') && (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={cancelling === o.id}
                      sx={{ fontSize: 11, height: 24, px: 1, color: MUJI.ink2, borderColor: MUJI.line }}
                      onClick={() => void cancel(o.id)}
                    >
                      {cancelling === o.id ? '撤单中…' : '撤单'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {/* 撤单引导：挂单会冻结股数/资金，用户需知道「委托当日有效 + 可主动撤单解冻」 */}
      {hasOpen && (
        <Typography sx={{ px: 3.25, py: 1.25, fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>
          ＊ 未成交委托仅当日有效，收盘后自动失效并解冻；若持仓「可卖数量」为 0 且显示「挂单冻结」，点右侧「撤单」即可立即解冻卖出。
        </Typography>
      )}
    </>
  );
}

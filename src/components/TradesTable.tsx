import { Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper, Typography } from '@mui/material';
import type { Trade } from '../../shared/types';
import { formatYuan } from '../../shared/money';
import { MUJI } from '../theme/muji-theme';

export interface TradesTableProps {
  trades: Trade[];
}

const HEADERS = ['成交时间', '股票名称 / 代码', '方向', '成交价', '数量', '成交额', '佣金', '印花税', '过户费', '净额'];

/** TradesTable — 成交（交割）记录 */
export default function TradesTable({ trades }: TradesTableProps) {
  if (trades.length === 0) {
    return (
      <Typography sx={{ p: 4, textAlign: 'center', fontSize: 13, color: MUJI.ink3, letterSpacing: '0.1em' }}>
        暂无成交记录
      </Typography>
    );
  }
  const fmtTime = (iso: string) => `${iso.slice(5, 10)} ${iso.slice(11, 19)}`;
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${MUJI.line}`, borderRadius: '0 0 2px 2px', borderTop: 'none' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {HEADERS.map((h, i) => (
              <TableCell key={h} align={i === 0 || i === 1 ? 'left' : 'right'} sx={{ pl: i === 0 ? 3.25 : 2, pr: 2 }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {trades.map((t) => (
            <TableRow key={t.id} hover>
              <TableCell className="num" sx={{ pl: 3.25 }}>{fmtTime(t.tradedAt)}</TableCell>
              <TableCell>
                <span style={{ letterSpacing: '0.1em' }}>{t.symbolName}</span>
                <span className="num" style={{ fontSize: 10.5, color: MUJI.ink3, marginLeft: 8 }}>
                  {t.symbol.replace(/^(sh|sz)/, '')}
                </span>
              </TableCell>
              <TableCell align="right">
                <Typography component="span" sx={{ color: t.side === 'buy' ? MUJI.up : MUJI.down }}>
                  {t.side === 'buy' ? '买入' : '卖出'}
                </Typography>
              </TableCell>
              <TableCell align="right" className="num">{formatYuan(t.price)}</TableCell>
              <TableCell align="right" className="num">{t.quantity}</TableCell>
              <TableCell align="right" className="num">{formatYuan(t.amount)}</TableCell>
              <TableCell align="right" className="num">{formatYuan(t.feeCommission)}</TableCell>
              <TableCell align="right" className="num">{formatYuan(t.feeStamp)}</TableCell>
              <TableCell align="right" className="num">{formatYuan(t.feeTransfer)}</TableCell>
              <TableCell align="right" className="num">
                <Typography component="span" sx={{ color: t.netAmount >= 0 ? MUJI.down : MUJI.up }}>
                  {t.side === 'buy' ? '-' : '+'}
                  {formatYuan(Math.abs(t.netAmount))}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

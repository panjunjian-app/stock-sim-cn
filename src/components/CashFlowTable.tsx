import { Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper, Typography } from '@mui/material';
import type { CashFlow } from '../../shared/types';
import { formatYuan } from '../../shared/money';
import { MUJI } from '../theme/muji-theme';

export interface CashFlowTableProps {
  cashFlows: CashFlow[];
}

const TYPE_TEXT: Record<CashFlow['type'], string> = {
  deposit: '入金',
  buy: '买入',
  sell: '卖出',
  penalty: '游手好闲费',
};

const HEADERS = ['时间', '类型', '金额（元）', '变动后可用', '备注'];

/** CashFlowTable — 资金流水（含费用明细备注） */
export default function CashFlowTable({ cashFlows }: CashFlowTableProps) {
  if (cashFlows.length === 0) {
    return (
      <Typography sx={{ p: 4, textAlign: 'center', fontSize: 13, color: MUJI.ink3, letterSpacing: '0.1em' }}>
        暂无资金流水
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
              <TableCell key={h} align={i === 0 || i === 4 ? 'left' : 'right'} sx={{ pl: i === 0 ? 3.25 : 2.25, pr: i === 4 ? 3.25 : 2.25 }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {cashFlows.map((f) => (
            <TableRow key={f.id} hover>
              <TableCell className="num" sx={{ pl: 3.25 }}>{fmtTime(f.createdAt)}</TableCell>
              <TableCell align="right">
                <Typography component="span" sx={{ color: f.type === 'buy' ? MUJI.up : f.type === 'sell' ? MUJI.down : MUJI.ink2 }}>
                  {TYPE_TEXT[f.type]}
                </Typography>
              </TableCell>
              <TableCell align="right" className="num">
                <Typography component="span" sx={{ color: f.amount >= 0 ? MUJI.down : MUJI.up }}>
                  {f.amount > 0 ? '+' : ''}
                  {formatYuan(f.amount)}
                </Typography>
              </TableCell>
              <TableCell align="right" className="num">{formatYuan(f.balanceAfter)}</TableCell>
              <TableCell align="left" sx={{ pr: 3.25, color: MUJI.ink2, fontSize: 12 }}>
                {f.remark}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

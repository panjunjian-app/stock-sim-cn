/**
 * PositionsCompareTable — 持仓成本 vs 现价对比表（按盈亏% 排序）
 */
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { BiPositionRow } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { fmtCents, fmtPct, fmtPnl, pnlColor } from './chart-theme';

export default function PositionsCompareTable({ positions }: { positions: BiPositionRow[] }) {
  const navigate = useNavigate();
  const rows = [...positions].sort((a, b) => b.pnlPct - a.pnlPct);

  if (rows.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center', color: MUJI.ink3, fontSize: 13 }}>当前无持仓</Box>
    );
  }

  const head = ['股票', '持仓/股', '成本价', '现价', '市值', '盈亏', '盈亏%', '占比%'];
  return (
    <TableContainer sx={{ maxHeight: 320 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {head.map((h) => (
              <TableCell key={h} align={h === '股票' ? 'left' : 'right'} sx={{ fontSize: 12, color: MUJI.ink3, bgcolor: MUJI.card, borderColor: MUJI.lineSoft, py: 1 }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.symbol}
              hover
              onClick={() => navigate(`/trade/${r.symbol}`)}
              sx={{ cursor: 'pointer', '&:hover': { bgcolor: MUJI.paper } }}
            >
              <TableCell sx={{ fontSize: 13, color: MUJI.ink, borderColor: MUJI.lineSoft }}>{r.name}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, color: MUJI.ink2, borderColor: MUJI.lineSoft }}>{r.qty}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, color: MUJI.ink2, borderColor: MUJI.lineSoft }}>{(r.avgCost / 100).toFixed(2)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, color: MUJI.ink, borderColor: MUJI.lineSoft }}>{(r.price / 100).toFixed(2)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, color: MUJI.ink2, borderColor: MUJI.lineSoft }}>{fmtCents(r.marketValue)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, color: pnlColor(r.pnl), borderColor: MUJI.lineSoft }}>{fmtPnl(r.pnl)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, color: pnlColor(r.pnl), borderColor: MUJI.lineSoft }}>{fmtPct(r.pnlPct)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, color: MUJI.ink2, borderColor: MUJI.lineSoft }}>{r.weightPct.toFixed(1)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

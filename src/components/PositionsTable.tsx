import { Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper, Button, Typography } from '@mui/material';
import type { OrderInput, Position } from '../../shared/types';
import { formatPct, formatSignedYuan, formatYuan } from '../../shared/money';
import PnlText from './PnlText';
import { MUJI } from '../theme/muji-theme';

export interface PositionsTableProps {
  positions: Position[];
  /** 行内快捷买/卖：预填看盘页下单面板 */
  onQuickOrder: (input: Pick<OrderInput, 'symbol' | 'side'>, position: Position) => void;
}

const HEADERS = ['股票名称 / 代码', '持仓数量', '可卖数量', '成本价', '现价', '盈亏（元）', '盈亏比例', '操作'];

/** PositionsTable — 持仓明细（行内买/卖快捷按钮，T+1 可卖提示） */
export default function PositionsTable({ positions, onQuickOrder }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <Typography sx={{ p: 4, textAlign: 'center', fontSize: 13, color: MUJI.ink3, letterSpacing: '0.1em' }}>
        暂无持仓 · 去行情页买入第一笔吧
      </Typography>
    );
  }
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${MUJI.line}`, borderRadius: '0 0 2px 2px', borderTop: 'none' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {HEADERS.map((h, i) => (
              <TableCell key={h} align={i === 0 ? 'left' : 'right'} sx={{ pl: i === 0 ? 3.25 : 2.25, pr: 2.25 }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {positions.map((p) => (
            <TableRow key={p.symbol} hover>
              <TableCell sx={{ pl: 3.25 }}>
                <span style={{ letterSpacing: '0.1em' }}>{p.symbolName}</span>
                <span className="num" style={{ fontSize: 10.5, color: MUJI.ink3, marginLeft: 8 }}>
                  {p.symbol.replace(/^(sh|sz)/, '')}
                </span>
              </TableCell>
              <TableCell align="right" className="num">{p.qty}</TableCell>
              <TableCell align="right" className="num">
                {p.availableQty > 0 ? (
                  p.availableQty
                ) : (
                  <Typography component="span" sx={{ color: MUJI.ink3 }}>0（T+1）</Typography>
                )}
              </TableCell>
              <TableCell align="right" className="num">{formatYuan(p.avgCost)}</TableCell>
              <TableCell align="right" className="num">
                <PnlText value={p.lastPrice - p.avgCost} text={formatYuan(p.lastPrice)} />
              </TableCell>
              <TableCell align="right" className="num">
                <PnlText value={p.pnl} text={formatSignedYuan(p.pnl)} />
              </TableCell>
              <TableCell align="right" className="num">
                <PnlText value={p.pnl} text={formatPct(p.pnlPct)} />
              </TableCell>
              <TableCell align="right">
                <span style={{ display: 'inline-flex', gap: 8 }}>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ bgcolor: MUJI.up, fontSize: 12, height: 26, px: 1, letterSpacing: '0.1em' }}
                    onClick={() => onQuickOrder({ symbol: p.symbol, side: 'buy' }, p)}
                  >
                    买入
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={p.availableQty <= 0}
                    sx={{ fontSize: 12, height: 26, px: 1, letterSpacing: '0.1em', color: MUJI.down, borderColor: 'rgba(79,125,92,.45)' }}
                    onClick={() => onQuickOrder({ symbol: p.symbol, side: 'sell' }, p)}
                  >
                    卖出
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

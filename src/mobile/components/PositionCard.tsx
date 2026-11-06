/**
 * PositionCard — 持仓卡片：名称/代码、现价 vs 摊薄成本、持仓量/可卖量、
 * 盈亏额与盈亏%、常显「交易」「一键清仓」按钮（零 hover 依赖）。
 */
import { Box, Button, Typography } from '@mui/material';
import type { Position, Quote } from '../../../shared/types';
import { formatPct, formatSignedYuan, formatYuan } from '../../../shared/money';
import { pnlColor } from '../../components/PnlText';
import { MUJI } from '../../theme/muji-theme';

export interface PositionCardProps {
  position: Position;
  quote: Quote | undefined;
  /** 快捷交易（跳全屏下单页） */
  onTrade: () => void;
  /** 一键清仓（页面负责二次确认） */
  onLiquidate: () => void;
}

export default function PositionCard({ position, quote, onTrade, onLiquidate }: PositionCardProps) {
  // 无快照时以摊薄成本兜底（与 utils/overview.mergePositions 口径一致）
  const last = quote ? quote.price : position.lastPrice || position.avgCost;
  const cost = position.qty * position.avgCost;
  const marketValue = position.qty * last;
  const pnl = marketValue - cost;
  const pnlPct = cost > 0 ? Number(((pnl / cost) * 100).toFixed(2)) : 0;
  const color = pnlColor(pnl);

  return (
    <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', px: 2, py: 1.5 }}>
      {/* 名称 / 代码 */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 500, color: MUJI.ink }}>{position.symbolName}</Typography>
        <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3 }}>
          {position.symbol.replace(/^(sh|sz)/, '')}
        </Typography>
        <Typography className="num" sx={{ fontSize: 15, fontWeight: 500, color: pnlColor(last - position.avgCost), ml: 'auto' }}>
          {formatYuan(last)}
        </Typography>
      </Box>

      {/* 成本 / 持仓 / 可卖 */}
      <Box className="num" sx={{ display: 'flex', gap: 2.5, mt: 1, fontSize: 11.5, color: MUJI.ink3 }}>
        <span>成本 {formatYuan(position.avgCost)}</span>
        <span>持仓 {position.qty} 股</span>
        <span>可卖 {position.availableQty} 股</span>
      </Box>

      {/* 盈亏 */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mt: 0.75 }}>
        <Typography sx={{ fontSize: 11, color: MUJI.ink3 }}>浮动盈亏</Typography>
        <Typography className="num" sx={{ fontSize: 14, fontWeight: 500, color }}>
          {formatSignedYuan(pnl)}
        </Typography>
        <Typography className="num" sx={{ fontSize: 12, color }}>
          {formatPct(pnlPct)}
        </Typography>
        <Typography className="num" sx={{ fontSize: 11, color: MUJI.ink3, ml: 'auto' }}>
          市值 {formatYuan(marketValue)}
        </Typography>
      </Box>

      {/* 常显操作按钮（≥44px） */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={onTrade}
          sx={{ minHeight: 44, fontSize: 13.5, color: MUJI.ink2, borderColor: MUJI.line, '&:hover': { borderColor: '#c7c9cd' } }}
        >
          交易
        </Button>
        <Button
          fullWidth
          variant="outlined"
          onClick={onLiquidate}
          sx={{ minHeight: 44, fontSize: 13.5, color: MUJI.down, borderColor: MUJI.down, '&:hover': { borderColor: MUJI.down } }}
        >
          一键清仓
        </Button>
      </Box>
    </Box>
  );
}

/**
 * AssetSummaryGrid — 资产总览 2×2 网格：总资产 / 可用资金 / 持仓市值 / 今日盈亏。
 * 金额换算全部走 shared/money.ts。
 */
import { Box, Typography } from '@mui/material';
import { formatPct, formatSignedYuan, formatYuanSymbol } from '../../../shared/money';
import { pnlColor } from '../../components/PnlText';
import { MUJI } from '../../theme/muji-theme';

export interface AssetSummaryGridProps {
  /** 总资产（分） */
  totalAsset: number;
  /** 可用资金（分） */
  cashAvailable: number;
  /** 持仓市值（分） */
  marketValue: number;
  /** 当日盈亏（分） */
  dayPnl: number;
  /** 当日盈亏百分比 */
  dayPnlPct: number;
}

export default function AssetSummaryGrid({ totalAsset, cashAvailable, marketValue, dayPnl, dayPnlPct }: AssetSummaryGridProps) {
  const cellSx = {
    bgcolor: MUJI.card,
    border: `1px solid ${MUJI.line}`,
    borderRadius: '6px',
    px: 2,
    py: 1.5,
  } as const;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
      <Box sx={{ ...cellSx, gridColumn: '1 / -1' }}>
        <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>总资产（元）</Typography>
        <Typography className="num" sx={{ fontSize: 26, fontWeight: 500, mt: 0.5 }}>
          {formatYuanSymbol(totalAsset)}
        </Typography>
      </Box>
      <Box sx={cellSx}>
        <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>可用资金</Typography>
        <Typography className="num" sx={{ fontSize: 16, fontWeight: 500, mt: 0.5 }}>
          {formatYuanSymbol(cashAvailable)}
        </Typography>
      </Box>
      <Box sx={cellSx}>
        <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>持仓市值</Typography>
        <Typography className="num" sx={{ fontSize: 16, fontWeight: 500, mt: 0.5 }}>
          {formatYuanSymbol(marketValue)}
        </Typography>
      </Box>
      <Box sx={{ ...cellSx, gridColumn: '1 / -1' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.05em' }}>今日盈亏</Typography>
          <Typography className="num" sx={{ fontSize: 12.5, color: pnlColor(dayPnl) }}>
            {formatPct(dayPnlPct)}
          </Typography>
        </Box>
        <Typography className="num" sx={{ fontSize: 18, fontWeight: 500, mt: 0.5, color: pnlColor(dayPnl) }}>
          {formatSignedYuan(dayPnl)}
        </Typography>
      </Box>
    </Box>
  );
}

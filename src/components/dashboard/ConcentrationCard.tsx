/**
 * ConcentrationCard — 持仓集中度（TOP1/TOP5，>50% 标红警示）
 */
import { Box, LinearProgress, Typography } from '@mui/material';
import { MUJI } from '../../theme/muji-theme';
import { BI_COLORS } from './chart-theme';

function Bar(props: { label: string; pct: number }) {
  const risk = props.pct > 50;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: 12.5, color: MUJI.ink2 }}>{props.label}</Typography>
        <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: risk ? BI_COLORS.up : MUJI.ink }}>
          {props.pct.toFixed(1)}%{risk ? ' ⚠ 集中度过高' : ''}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, props.pct)}
        sx={{
          height: 8,
          borderRadius: 1,
          bgcolor: MUJI.paper2,
          '& .MuiLinearProgress-bar': { bgcolor: risk ? BI_COLORS.up : BI_COLORS.primary },
        }}
      />
    </Box>
  );
}

export default function ConcentrationCard({ top1Pct, top5Pct }: { top1Pct: number; top5Pct: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
      <Bar label="第一大持仓占总资产" pct={top1Pct} />
      <Bar label="前五大持仓占总资产" pct={top5Pct} />
      <Typography sx={{ fontSize: 11.5, color: MUJI.ink3, lineHeight: 1.6 }}>
        集中度反映组合对单一股票的依赖度；单一持仓超过 50% 时建议适当分散。
      </Typography>
    </Box>
  );
}

/**
 * DailyPnlChart — 每日盈亏柱状图（正红负绿）
 */
import { Box, Typography } from '@mui/material';
import { Bar, BarChart, Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BiDailyPnlPoint } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { BI_COLORS, biAxisProps, biGridProps, fmtCents, fmtPnl } from './chart-theme';

export default function DailyPnlChart({ series }: { series: BiDailyPnlPoint[] }) {
  const data = series.map((p) => ({ date: p.date.slice(5), pnl: p.pnl / 100 }));

  if (series.length === 0) {
    return (
      <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUJI.ink3, fontSize: 13 }}>
        区间内暂无每日盈亏数据
      </Box>
    );
  }

  return (
    <Box>
      <Typography sx={{ fontSize: 14, fontWeight: 500, color: MUJI.ink, mb: 0.5 }}>每日盈亏（元）</Typography>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid {...biGridProps} />
          <XAxis dataKey="date" {...biAxisProps} minTickGap={32} />
          <YAxis {...biAxisProps} width={64} tickFormatter={(v: number) => fmtCents(Math.round(v * 100))} />
          <ReferenceLine y={0} stroke={MUJI.ink3} strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{ fontSize: 12, border: `1px solid ${MUJI.line}`, borderRadius: 4 }}
            formatter={(v: unknown) => [fmtPnl(Math.round(Number(v) * 100)), '当日盈亏'] as [string, string]}
            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
          />
          <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? BI_COLORS.up : BI_COLORS.down} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

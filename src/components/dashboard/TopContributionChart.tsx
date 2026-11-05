/**
 * TopContributionChart — 单股盈亏贡献 TOP（正负双向横向条形）
 */
import { Box, Typography } from '@mui/material';
import { Bar, BarChart, Cell, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { BiContributionItem } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { BI_COLORS, biAxisProps, biGridProps, fmtCents, fmtPnl } from './chart-theme';

export default function TopContributionChart({ items }: { items: BiContributionItem[] }) {
  const navigate = useNavigate();
  const data = items.map((c) => ({ name: c.name, pnl: c.pnl / 100 }));

  if (data.length === 0) {
    return <Box sx={{ py: 4, textAlign: 'center', color: MUJI.ink3, fontSize: 13 }}>区间内暂无个股盈亏数据</Box>;
  }

  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 0.5 }}>点击条形可跳转个股页</Typography>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid {...biGridProps} horizontal={false} />
          <XAxis type="number" {...biAxisProps} tickFormatter={(v: number) => fmtCents(Math.round(v * 100))} />
          <YAxis type="category" dataKey="name" {...biAxisProps} width={76} tick={{ fontSize: 11.5, fill: BI_COLORS.ink2 }} />
          <ReferenceLine x={0} stroke={MUJI.ink3} />
          <Tooltip
            contentStyle={{ fontSize: 12, border: `1px solid ${MUJI.line}`, borderRadius: 4 }}
            formatter={(v: unknown) => [fmtPnl(Math.round(Number(v) * 100)), '区间盈亏'] as [string, string]}
            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
          />
          <Bar dataKey="pnl" radius={[0, 2, 2, 0]} onClick={(d: { payload?: { name?: string } }) => {
            const item = items.find((c) => c.name === d.payload?.name);
            if (item) {
              navigate(`/trade/${item.symbol}`);
            }
          }}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? BI_COLORS.up : BI_COLORS.down} cursor="pointer" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

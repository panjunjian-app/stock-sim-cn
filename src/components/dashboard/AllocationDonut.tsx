/**
 * AllocationDonut — 持仓市值分布环形图（含现金扇区）
 */
import { Box, Typography } from '@mui/material';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { BiAllocationSlice } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { BI_COLORS, fmtCents } from './chart-theme';

export default function AllocationDonut({ slices }: { slices: BiAllocationSlice[] }) {
  if (slices.length === 0) {
    return <Box sx={{ py: 4, textAlign: 'center', color: MUJI.ink3, fontSize: 13 }}>暂无资产分布</Box>;
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <ResponsiveContainer width="55%" height={210}>
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={1.5} strokeWidth={1} stroke={MUJI.card}>
            {slices.map((_, i) => (
              <Cell key={i} fill={BI_COLORS.palette[i % BI_COLORS.palette.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, border: `1px solid ${MUJI.line}`, borderRadius: 4 }}
            formatter={(v: unknown, n: unknown) => {
              const name = String(n);
              const s = slices.find((x) => x.name === name);
              return [`${fmtCents(Number(v))}（${s?.pct.toFixed(1) ?? 0}%）`, name] as [string, string];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {slices.map((s, i) => (
          <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: BI_COLORS.palette[i % BI_COLORS.palette.length], flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</Typography>
            <Typography sx={{ fontSize: 12.5, color: MUJI.ink }}>{s.pct.toFixed(1)}%</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * PnlRatioDonut — 个股盈亏占比环形图（仅盈利贡献）
 */
import { Box, Typography } from '@mui/material';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { BiContributionItem } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { BI_COLORS, fmtCents, fmtPnl } from './chart-theme';

export default function PnlRatioDonut({ items }: { items: BiContributionItem[] }) {
  if (items.length === 0) {
    return <Box sx={{ py: 4, textAlign: 'center', color: MUJI.ink3, fontSize: 13 }}>区间内暂无盈利个股</Box>;
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <ResponsiveContainer width="55%" height={200}>
        <PieChart>
          <Pie data={items} dataKey="pnl" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={1.5} strokeWidth={1} stroke={MUJI.card}>
            {items.map((_, i) => (
              <Cell key={i} fill={BI_COLORS.palette[i % BI_COLORS.palette.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, border: `1px solid ${MUJI.line}`, borderRadius: 4 }}
            formatter={(v: unknown, n: unknown) => {
              const it = items.find((x) => x.name === String(n));
              return [`${fmtPnl(Number(v))}（占盈利 ${it?.pct.toFixed(1) ?? 0}%）`, String(n)] as [string, string];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {items.map((c, i) => (
          <Box key={c.symbol} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: BI_COLORS.palette[i % BI_COLORS.palette.length], flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</Typography>
            <Typography sx={{ fontSize: 12.5, color: BI_COLORS.up }}>{fmtPnl(c.pnl)}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

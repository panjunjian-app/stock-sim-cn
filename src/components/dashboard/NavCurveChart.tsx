/**
 * NavCurveChart — 资产净值曲线（金额 / 净值双视图，Recharts 面积图）
 */
import { useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BiNavPoint } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { BI_COLORS, biAxisProps, biGridProps, fmtCents } from './chart-theme';

export default function NavCurveChart({ series }: { series: BiNavPoint[] }) {
  const [mode, setMode] = useState<'amount' | 'nav'>('amount');

  const data = useMemo(
    () =>
      series.map((p) => ({
        date: p.date.slice(5), // MM-DD
        value: mode === 'amount' ? p.totalAssets / 100 : p.nav, // 展示用元
        label: mode === 'amount' ? fmtCents(p.totalAssets) : p.nav.toFixed(4),
      })),
    [series, mode]
  );

  if (series.length === 0) {
    return (
      <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUJI.ink3, fontSize: 13 }}>
        区间内暂无资产数据
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: MUJI.ink }}>{mode === 'amount' ? '资产走势（元）' : '净值走势（期初 = 1.0）'}</Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {(
            [
              ['amount', '金额'],
              ['nav', '净值'],
            ] as const
          ).map(([v, label]) => (
            <Button
              key={v}
              size="small"
              disableRipple
              onClick={() => setMode(v)}
              sx={{
                minWidth: 0,
                px: 1.25,
                py: 0.25,
                fontSize: 12,
                color: mode === v ? '#ffffff' : MUJI.ink2,
                bgcolor: mode === v ? MUJI.red : 'transparent',
                border: `1px solid ${mode === v ? MUJI.red : MUJI.line}`,
                borderRadius: '3px',
              }}
            >
              {label}
            </Button>
          ))}
        </Box>
      </Box>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="navGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BI_COLORS.primary} stopOpacity={0.22} />
              <stop offset="100%" stopColor={BI_COLORS.primary} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...biGridProps} />
          <XAxis dataKey="date" {...biAxisProps} minTickGap={32} />
          <YAxis {...biAxisProps} width={64} domain={['auto', 'auto']} tickFormatter={(v: number) => (mode === 'amount' ? fmtCents(Math.round(v * 100)) : v.toFixed(2))} />
          <Tooltip
            contentStyle={{ fontSize: 12, border: `1px solid ${MUJI.line}`, borderRadius: 4 }}
            formatter={(v: unknown) => [mode === 'amount' ? `¥${Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` : Number(v).toFixed(4), mode === 'amount' ? '总资产' : '净值'] as [string, string]}
          />
          <Area type="monotone" dataKey="value" stroke={BI_COLORS.primary} strokeWidth={1.75} fill="url(#navGrad)" dot={false} activeDot={{ r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

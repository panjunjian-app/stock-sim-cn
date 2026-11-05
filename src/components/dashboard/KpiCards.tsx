/**
 * KpiCards — 收益总览 KPI 卡片（7 张，红涨绿跌）
 */
import { Box, Typography } from '@mui/material';
import type { BiKpi } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { BI_COLORS, fmtCents, fmtPct, fmtPnl, pnlColor } from './chart-theme';

function Card(props: { label: string; value: string; color?: string; sub?: string; subColor?: string }) {
  return (
    <Box
      sx={{
        flex: '1 1 0',
        minWidth: 148,
        bgcolor: MUJI.card,
        border: `1px solid ${MUJI.line}`,
        borderRadius: '4px',
        px: 2.25,
        py: 1.75,
      }}
    >
      <Typography sx={{ fontSize: 12, color: MUJI.ink3, letterSpacing: '0.05em', mb: 0.75 }}>{props.label}</Typography>
      <Typography sx={{ fontSize: 21, fontWeight: 500, color: props.color ?? MUJI.ink, lineHeight: 1.2 }}>{props.value}</Typography>
      {props.sub && (
        <Typography sx={{ fontSize: 11.5, color: props.subColor ?? MUJI.ink3, mt: 0.5 }}>{props.sub}</Typography>
      )}
    </Box>
  );
}

export default function KpiCards({ kpi }: { kpi: BiKpi }) {
  const dirColor = pnlColor(kpi.rangePnl);
  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      <Card label="总资产" value={fmtCents(kpi.totalAssets)} sub="按最新行情估算" />
      <Card label="区间收益率" value={fmtPct(kpi.rangeReturnPct)} color={pnlColor(kpi.rangeReturnPct)} />
      <Card label="区间盈亏" value={fmtPnl(kpi.rangePnl)} color={dirColor} />
      <Card label="当日盈亏" value={fmtPnl(kpi.dayPnl)} color={pnlColor(kpi.dayPnl)} sub="截至最新行情" />
      <Card label="已实现盈亏" value={fmtPnl(kpi.realizedPnl)} color={pnlColor(kpi.realizedPnl)} sub="区间内卖出落袋" />
      <Card label="浮动盈亏" value={fmtPnl(kpi.unrealizedPnl)} color={pnlColor(kpi.unrealizedPnl)} sub="当前在持按现价" />
      <Card
        label="最大回撤"
        value={`-${kpi.maxDrawdownPct.toFixed(2)}%`}
        color={kpi.maxDrawdownPct > 0 ? BI_COLORS.down : MUJI.ink}
        sub={kpi.maxDrawdownDate ? `发生于 ${kpi.maxDrawdownDate}` : '区间内无回撤'}
      />
    </Box>
  );
}

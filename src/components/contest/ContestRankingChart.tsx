/**
 * ContestRankingChart — 比赛排行榜柱状图（Recharts）
 * active：柱=当前总资产（按名次降序），柱色=昨日盈亏（正红负绿灰），tooltip 显示昵称/总资金/昨日盈亏；
 * finished：柱=定格总资产，冠军柱顶戴 👑 皇冠。
 */
import { Box, Button, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { ContestInfo } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { BI_COLORS, biAxisProps, biGridProps, fmtCents, fmtPnl } from '../dashboard/chart-theme';

/** 冠军柱顶皇冠标签（loose typing 适配 Recharts LabelList content） */
const crownLabel = (props: { x?: number | string; y?: number | string; width?: number | string; value?: unknown }): ReturnType<() => JSX.Element> => {
  if (!props.value || props.x === undefined || props.y === undefined) {
    return null as unknown as JSX.Element;
  }
  const cx = (Number(props.x) + Number(props.width ?? 0)) / 2;
  const cy = Math.max(14, Number(props.y) - 6);
  return <text x={cx} y={cy} textAnchor="middle" fontSize={16}>👑</text>;
};

interface Props {
  contest: ContestInfo;
}

const DUR: Record<number, string> = { 1: '1 个月', 3: '3 个月', 6: '半年', 12: '1 年' };

export default function ContestRankingChart({ contest }: Props) {
  const navigate = useNavigate();
  const finished = contest.status === 'finished';

  const ranked = [...contest.participants]
    .filter((p) => p.inviteStatus === 'accepted')
    .map((p) => ({
      ...p,
      total: finished ? (p.finalTotal ?? 0) : (p.currentTotal ?? 0),
    }))
    .sort((a, b) => b.total - a.total);

  const data = ranked.map((p) => ({
    name: p.nickname.length > 6 ? `${p.nickname.slice(0, 6)}…` : p.nickname,
    total: p.total / 100, // 元
    yesterdayPnl: p.yesterdayPnl,
    isWinner: p.isWinner,
    userId: p.userId,
    accountId: p.accountId,
  }));

  const statusLabel =
    contest.status === 'pending'
      ? '⏳ 等待被邀请人确认'
      : contest.status === 'active'
        ? `🏁 进行中 · ${contest.startDate ?? ''} ~ ${contest.endDate ?? ''}`
        : `🏆 已结束 · ${contest.startDate ?? ''} ~ ${contest.endDate ?? ''}`;

  return (
    <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '4px', p: 2.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500, color: MUJI.ink }}>{contest.name}</Typography>
        <Typography sx={{ fontSize: 12, color: MUJI.ink3 }}>
          每人初始 ¥{(contest.initCash / 100).toLocaleString('zh-CN')} ｜ 周期 {DUR[contest.durationMonths] ?? contest.durationMonths + ' 个月'}
        </Typography>
        <Typography sx={{ fontSize: 12, color: MUJI.ink3, ml: 'auto' }}>{statusLabel}</Typography>
        {finished && (
          <Button size="small" onClick={() => { const w = ranked[0]; if (w?.accountId) navigate(`/accounts/${w.accountId}`); }} sx={{ fontSize: 12, color: MUJI.red, minWidth: 0, px: 1 }}>
            查看冠军账户
          </Button>
        )}
      </Box>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ top: 26, right: 16, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid {...biGridProps} />
          <XAxis dataKey="name" {...biAxisProps} tick={{ fontSize: 12.5, fill: BI_COLORS.ink }} />
          <YAxis {...biAxisProps} width={64} domain={['auto', 'auto']} tickFormatter={(v: number) => fmtCents(Math.round(v * 100))} />
          <ReferenceLine y={contest.initCash / 100} stroke={MUJI.line} strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{ fontSize: 12, border: `1px solid ${MUJI.line}`, borderRadius: 4 }}
            formatter={(v: unknown, n: unknown) => {
              if (n === 'total') {
                return [`当前总资金 ${fmtCents(Math.round(Number(v) * 100))}`, '总资金'] as [string, string];
              }
              return [String(v), ''] as [string, string];
            }}
            labelFormatter={(label: unknown, payload) => {
              const item = payload?.[0]?.payload as { yesterdayPnl: number | null; isWinner: boolean } | undefined;
              if (!item) {
                return String(label);
              }
              const lines = [String(label)];
              if (item.isWinner) {
                lines.push('👑 本场冠军');
              }
              if (item.yesterdayPnl !== null && item.yesterdayPnl !== undefined) {
                lines.push(`昨日盈亏 ${fmtPnl(item.yesterdayPnl)}`);
              }
              return lines.join(' ｜ ');
            }}
            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
          />
          <Bar dataKey="total" radius={[3, 3, 0, 0]} onClick={(d: { payload?: { accountId?: number | null } }) => {
            if (d.payload?.accountId) {
              navigate(`/accounts/${d.payload.accountId}`);
            }
          }}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={finished ? BI_COLORS.primary : d.yesterdayPnl === null || d.yesterdayPnl === undefined ? MUJI.ink3 : d.yesterdayPnl >= 0 ? BI_COLORS.up : BI_COLORS.down}
                cursor="pointer"
              />
            ))}
            <LabelList dataKey="isWinner" content={crownLabel as never} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {!finished && (
        <Typography sx={{ fontSize: 11.5, color: MUJI.ink3, mt: 0.5 }}>
          柱色 = 昨日盈亏（<span style={{ color: BI_COLORS.up }}>红涨</span> / <span style={{ color: BI_COLORS.down }}>绿跌</span>）；虚线 = 初始资金；点击柱形可查看该用户比赛账户（不可见各自持仓明细）
        </Typography>
      )}
      {finished && <Typography sx={{ fontSize: 11.5, color: MUJI.ink3, mt: 0.5 }}>👑 冠军产生，比赛账户已封存，点击柱形可复盘全过程</Typography>}
    </Box>
  );
}

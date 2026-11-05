/**
 * ContestRankingChart — 比赛排行榜柱状图（Recharts）
 * 柱色 = 每位参赛者专属颜色（按 userId 稳定分配，同场比赛互不撞色）；
 * 柱顶 = 参赛者头像（未设置头像显示昵称首字母圆底），冠军头像右上角戴 👑；
 * active：柱=当前总资产（按名次降序），tooltip 显示昵称/总资金/昨日盈亏；
 * finished：柱=定格总资产。
 */
import { Box, Button, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { ContestInfo } from '../../../shared/types';
import { MUJI } from '../../theme/muji-theme';
import { BI_COLORS, biAxisProps, biGridProps, fmtCents, fmtPnl } from '../dashboard/chart-theme';

interface Props {
  contest: ContestInfo;
}

/** 调色板兜底色（理论不可达：assignPlayerColors 保证每人一色） */
const BI_FALLBACK = '#c0564a';

/** 参赛者专属调色板（与 MUJI 纸感风格协调，8 色轮转，同场按 userId 稳定取色且互不重复） */
const PLAYER_PALETTE = ['#c0564a', '#5b7fa6', '#6a9e76', '#c2884e', '#8e7aa8', '#4f9e9e', '#c26a8d', '#94856a'];

/** 按 userId 稳定分配专属色：先哈希取色，撞色顺延，保证同场比赛每人颜色不同 */
function assignPlayerColors(members: Array<{ userId: number }>): Map<number, string> {
  const used = new Set<number>();
  const out = new Map<number, string>();
  for (const m of members) {
    let idx = m.userId % PLAYER_PALETTE.length;
    let probe = 0;
    while (used.has(idx) && probe < PLAYER_PALETTE.length) {
      idx = (idx + 1) % PLAYER_PALETTE.length;
      probe += 1;
    }
    used.add(idx);
    out.set(m.userId, PLAYER_PALETTE[idx]);
  }
  return out;
}

/** 柱顶头像标签：圆形头像（无头像用首字母圆底），冠军右上角戴 👑（loose typing 适配 LabelList content） */
interface AvatarLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  index?: number;
}

interface AvatarDatum {
  avatar: string;
  nickname: string;
  isWinner: boolean;
  color: string;
  userId: number;
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

  const colorMap = assignPlayerColors(ranked);

  const data = ranked.map((p) => ({
    name: p.nickname.length > 6 ? `${p.nickname.slice(0, 6)}…` : p.nickname,
    nickname: p.nickname,
    total: p.total / 100, // 元
    yesterdayPnl: p.yesterdayPnl,
    isWinner: p.isWinner,
    userId: p.userId,
    accountId: p.accountId,
    avatar: p.avatar ?? '',
    color: colorMap.get(p.userId) ?? BI_FALLBACK,
  }));

  const statusLabel =
    contest.status === 'pending'
      ? '⏳ 等待被邀请人确认'
      : contest.status === 'active'
        ? `🏁 进行中 · ${contest.startDate ?? ''} ~ ${contest.endDate ?? ''}`
        : `🏆 已结束 · ${contest.startDate ?? ''} ~ ${contest.endDate ?? ''}`;

  /** 柱顶头像渲染（通过 index 回查数据行，含头像/首字母/皇冠角标） */
  const avatarLabel = (props: AvatarLabelProps): ReturnType<() => JSX.Element> => {
    const item: AvatarDatum | undefined = props.index !== undefined ? data[props.index] : undefined;
    if (!item || props.x === undefined || props.y === undefined) {
      return null as unknown as JSX.Element;
    }
    const cx = (Number(props.x) + Number(props.width ?? 0)) / 2;
    const r = 13;
    const cy = Math.max(r + 4, Number(props.y) - r - 6);
    const clipId = `av-${contest.id}-${item.userId}`;
    const initial = (item.nickname || '?').slice(0, 1).toUpperCase();
    return (
      <g>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <circle cx={cx} cy={cy} r={r} fill="#f5f2ec" stroke={item.color} strokeWidth={2} />
        {item.avatar ? (
          <image href={item.avatar} x={cx - r} y={cy - r} width={r * 2} height={r * 2} clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <text x={cx} y={cy + 4.5} textAnchor="middle" fontSize={12} fill="#8a8378" fontWeight={500}>
            {initial}
          </text>
        )}
        {item.isWinner && (
          <text x={cx + r - 2} y={cy - r + 4} textAnchor="middle" fontSize={12}>
            👑
          </text>
        )}
      </g>
    );
  };

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
        <BarChart data={data} margin={{ top: 44, right: 16, left: 4, bottom: 0 }} barCategoryGap="28%">
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
              <Cell key={i} fill={d.color} cursor="pointer" />
            ))}
            <LabelList dataKey="total" content={avatarLabel as never} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {!finished && (
        <Typography sx={{ fontSize: 11.5, color: MUJI.ink3, mt: 0.5 }}>
          每位参赛者专属颜色 ｜ 虚线 = 初始资金；点击柱形可查看该用户比赛账户（不可见各自持仓明细）
        </Typography>
      )}
      {finished && <Typography sx={{ fontSize: 11.5, color: MUJI.ink3, mt: 0.5 }}>👑 冠军产生，比赛账户已封存，点击柱形可复盘全过程</Typography>}
    </Box>
  );
}

/**
 * PositionsDayPnlSummary — 移动端持仓合计条：持仓当日盈亏合计 +（今日卖出已实现）+ 合计当日盈亏。
 * 目的：持仓卡片只列 qty>0 的股票，今日卖出（清仓）那部分已实现盈亏不在卡片里，
 * 需在卡片区底部补齐，使明细合计与顶部汇总「当日盈亏」（资金口径）对齐。
 * 无今日卖出时隐藏「今日卖出已实现」行，避免噪音。
 */
import { Box, Typography } from '@mui/material';
import type { Position, TodayRealized } from '../../../shared/types';
import { formatSignedYuan } from '../../../shared/money';
import { formatRealizedDetail, summarizeDayPnl } from '../../../shared/today-realized';
import { pnlColor } from '../../components/PnlText';
import { MUJI } from '../../theme/muji-theme';

export interface PositionsDayPnlSummaryProps {
  /** 已合并行情快照的持仓行 */
  positions: Position[];
  /** 今日卖出已实现（后端 positions 接口返回） */
  todayRealized?: TodayRealized | null;
}

export default function PositionsDayPnlSummary({ positions, todayRealized }: PositionsDayPnlSummaryProps) {
  const summary = summarizeDayPnl(positions, todayRealized);
  // 既无持仓也无今日卖出 → 整块不渲染
  if (positions.length === 0 && !summary.hasRealized) {
    return null;
  }
  const realizedHint = summary.hasRealized ? formatRealizedDetail(summary.realizedItems) : undefined;

  return (
    <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', px: 2, py: 1.25 }}>
      <Box className="num" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11.5, color: MUJI.ink3 }}>
        <span style={{ letterSpacing: '0.05em' }}>持仓当日盈亏合计</span>
        <span style={{ color: summary.holdingsComplete ? pnlColor(summary.holdings) : MUJI.ink3, fontWeight: 500 }}>
          {summary.holdingsComplete ? formatSignedYuan(summary.holdings) : '—'}
        </span>
      </Box>

      {summary.hasRealized && (
        <Box
          className="num"
          title={realizedHint}
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 0.75, fontSize: 11.5, color: MUJI.ink3 }}
        >
          <span style={{ letterSpacing: '0.05em' }}>今日卖出已实现（{summary.realizedItems.length} 只）</span>
          <span style={{ color: summary.realized === null ? MUJI.ink3 : pnlColor(summary.realized), fontWeight: 500 }}>
            {summary.realized === null ? '—' : formatSignedYuan(summary.realized)}
          </span>
        </Box>
      )}

      <Box
        className="num"
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 1, pt: 1, borderTop: `1px solid ${MUJI.lineSoft}` }}
      >
        <Typography sx={{ fontSize: 12, color: MUJI.ink, fontWeight: 500, letterSpacing: '0.05em' }}>合计当日盈亏</Typography>
        <Typography
          className="num"
          sx={{ fontSize: 14.5, fontWeight: 600, color: summary.total === null ? MUJI.ink3 : pnlColor(summary.total) }}
        >
          {summary.total === null ? '—' : formatSignedYuan(summary.total)}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 10, color: MUJI.ink3, mt: 0.5, lineHeight: 1.6 }}>
        ＊ 合计 = 持仓当日盈亏 + 今日卖出已实现，与顶部「当日盈亏」同口径
      </Typography>
    </Box>
  );
}

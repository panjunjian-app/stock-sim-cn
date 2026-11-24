import { Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper, Button, Typography, Box } from '@mui/material';
import type { OrderInput, Position, TodayRealized } from '../../shared/types';
import { formatPct, formatSignedYuan, formatYuan } from '../../shared/money';
import { formatRealizedDetail, summarizeDayPnl } from '../../shared/today-realized';
import type { DayPnlSummary } from '../../shared/today-realized';
import PnlText, { pnlColor } from './PnlText';
import { MUJI } from '../theme/muji-theme';

export interface PositionsTableProps {
  positions: Position[];
  /** 今日卖出已实现（后端 positions 接口返回；缺省视为无卖出） */
  todayRealized?: TodayRealized | null;
  /** 行内快捷买/卖：预填看盘页下单面板 */
  onQuickOrder: (input: Pick<OrderInput, 'symbol' | 'side'>, position: Position) => void;
}

const HEADERS = ['股票名称 / 代码', '持仓数量', '可卖数量', '成本价', '现价', '当日盈亏', '当日盈亏比例', '盈亏（元）', '盈亏比例', '操作'];

/** 合计条单行：前 5 列（名称/数量/可卖/成本/现价）合并放标签，第 6 列（当日盈亏）放金额 */
interface SummaryRowProps {
  label: string;
  /** 金额（分）；null → 显示「—」 */
  value: number | null;
  /** 加粗 + 浅底（用于「合计当日盈亏」行） */
  strong?: boolean;
  /** hover 提示（如各股卖出明细） */
  hint?: string;
}

function SummaryRow({ label, value, strong = false, hint }: SummaryRowProps) {
  return (
    <TableRow sx={{ bgcolor: strong ? MUJI.paper2 : MUJI.card }}>
      <TableCell
        colSpan={5}
        align="right"
        title={hint}
        sx={{ pl: 3.25, pr: 1.75, fontSize: 12, letterSpacing: '0.05em', color: strong ? MUJI.ink : MUJI.ink2, fontWeight: strong ? 500 : 400, cursor: hint ? 'help' : 'default' }}
      >
        {label}
      </TableCell>
      <TableCell align="right" className="num" title={hint} sx={{ pr: 1.75, fontSize: 12.5, cursor: hint ? 'help' : 'default' }}>
        {value === null ? (
          <Typography component="span" className="num" sx={{ fontSize: 12, color: MUJI.ink3 }}>
            —
          </Typography>
        ) : (
          <span className="num" style={{ color: pnlColor(value), fontWeight: strong ? 600 : 500 }}>
            {formatSignedYuan(value)}
          </span>
        )}
      </TableCell>
      <TableCell colSpan={4} title={hint} sx={{ fontSize: 11, color: MUJI.ink3 }}>
        {strong ? '＊ 与上方「当日盈亏」同口径（资金口径）' : ''}
      </TableCell>
    </TableRow>
  );
}

/**
 * 合计条：把「持仓明细」与「今日卖出已实现」两段拼成「合计当日盈亏」，
 * 使明细加总与顶部汇总 KPI（资金口径，含已实现部分）对齐。
 * - 有今日卖出：三行（持仓合计 / 今日卖出已实现 / 合计当日盈亏）
 * - 无今日卖出：一行（当日盈亏合计），避免两行数字相同的噪音
 */
function DayPnlSummaryRows({ summary }: { summary: DayPnlSummary }) {
  const realizedHint = summary.hasRealized
    ? `今日卖出 ${summary.realizedItems.length} 只（净额已扣佣金/印花税/过户费）\n${formatRealizedDetail(summary.realizedItems)}`
    : undefined;
  const totalHint = summary.complete
    ? '＝ 持仓当日盈亏合计 + 今日卖出已实现；应等于顶部汇总「当日盈亏」（残差仅来自逐笔四舍五入）'
    : '部分标的暂无行情，暂无法给出完整合计（顶部汇总仍为资金口径的当日盈亏）';

  if (!summary.hasRealized) {
    return (
      <SummaryRow
        label="当日盈亏合计"
        value={summary.complete ? summary.total : null}
        strong
        hint={totalHint}
      />
    );
  }
  return (
    <>
      <SummaryRow
        label="持仓当日盈亏合计"
        value={summary.holdingsComplete ? summary.holdings : null}
        hint={summary.holdingsComplete ? 'Σ 上方各行「当日盈亏」' : '部分持仓暂无行情，无法完整合计'}
      />
      <SummaryRow
        label={`今日卖出已实现（${summary.realizedItems.length} 只）`}
        value={summary.realized}
        hint={realizedHint}
      />
      <SummaryRow label="合计当日盈亏" value={summary.total} strong hint={totalHint} />
    </>
  );
}

/** 无持仓但有今日卖出（清仓）时的紧凑合计卡：仍要让用户看到已实现那部分 */
function EmptyPositionsWithRealized({ summary }: { summary: DayPnlSummary }) {
  return (
    <Box sx={{ border: `1px solid ${MUJI.line}`, borderTop: 'none', bgcolor: MUJI.card, borderRadius: '0 0 2px 2px', px: 3.25, py: 2.5 }}>
      <Typography sx={{ fontSize: 12, color: MUJI.ink3, letterSpacing: '0.1em', mb: 1.5 }}>
        当前无持仓（今日已卖出 {summary.realizedItems.length} 只）
      </Typography>
      <Box
        className="num"
        title={formatRealizedDetail(summary.realizedItems)}
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, color: MUJI.ink2, mb: 0.75 }}
      >
        <span style={{ letterSpacing: '0.05em' }}>今日卖出已实现</span>
        <span style={{ color: summary.realized === null ? MUJI.ink3 : pnlColor(summary.realized), fontWeight: 500 }}>
          {summary.realized === null ? '—' : formatSignedYuan(summary.realized)}
        </span>
      </Box>
      <Box
        className="num"
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', pt: 1, borderTop: `1px solid ${MUJI.lineSoft}`, fontSize: 12.5 }}
      >
        <span style={{ color: MUJI.ink, fontWeight: 500, letterSpacing: '0.05em' }}>合计当日盈亏</span>
        <span style={{ color: summary.total === null ? MUJI.ink3 : pnlColor(summary.total), fontWeight: 600 }}>
          {summary.total === null ? '—' : formatSignedYuan(summary.total)}
        </span>
      </Box>
    </Box>
  );
}

/** PositionsTable — 持仓明细（行内买/卖快捷按钮，T+1 可卖提示，底部当日盈亏合计条） */
export default function PositionsTable({ positions, todayRealized, onQuickOrder }: PositionsTableProps) {
  const summary = summarizeDayPnl(positions, todayRealized);

  if (positions.length === 0) {
    // 已清仓但今日有卖出：仍展示已实现部分，避免「明细无数据、汇总有当日盈亏」的困惑
    if (!summary.hasRealized) {
      return (
        <Typography sx={{ p: 4, textAlign: 'center', fontSize: 13, color: MUJI.ink3, letterSpacing: '0.1em' }}>
          暂无持仓 · 去行情页买入第一笔吧
        </Typography>
      );
    }
    return <EmptyPositionsWithRealized summary={summary} />;
  }
  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${MUJI.line}`, borderRadius: '0 0 2px 2px', borderTop: 'none' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {HEADERS.map((h, i) => (
              <TableCell key={h} align={i === 0 ? 'left' : 'right'} sx={{ pl: i === 0 ? 3.25 : 1.75, pr: 1.75, whiteSpace: 'nowrap' }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {positions.map((p) => (
            <TableRow key={p.symbol} hover>
              <TableCell sx={{ pl: 3.25 }}>
                <span style={{ letterSpacing: '0.1em' }}>{p.symbolName}</span>
                <span className="num" style={{ fontSize: 10.5, color: MUJI.ink3, marginLeft: 8 }}>
                  {p.symbol.replace(/^(sh|sz)/, '')}
                </span>
              </TableCell>
              <TableCell align="right" className="num">{p.qty}</TableCell>
              <TableCell align="right" className="num">
                {p.availableQty > 0 ? (
                  p.availableQty
                ) : (
                  <Typography component="span" sx={{ color: MUJI.ink3 }}>0（T+1）</Typography>
                )}
              </TableCell>
              <TableCell align="right" className="num">{formatYuan(p.avgCost)}</TableCell>
              <TableCell align="right" className="num">
                <PnlText value={p.lastPrice - p.avgCost} text={formatYuan(p.lastPrice)} />
              </TableCell>
              <TableCell align="right" className="num">
                {p.dayPnl !== undefined ? (
                  <PnlText value={p.dayPnl} text={formatSignedYuan(p.dayPnl)} />
                ) : (
                  <Typography component="span" sx={{ color: MUJI.ink3 }}>—</Typography>
                )}
              </TableCell>
              <TableCell align="right" className="num">
                {p.dayPnlPct !== undefined ? (
                  <PnlText value={p.dayPnlPct} text={formatPct(p.dayPnlPct)} />
                ) : (
                  <Typography component="span" sx={{ color: MUJI.ink3 }}>—</Typography>
                )}
              </TableCell>
              <TableCell align="right" className="num">
                <PnlText value={p.pnl} text={formatSignedYuan(p.pnl)} />
              </TableCell>
              <TableCell align="right" className="num">
                <PnlText value={p.pnl} text={formatPct(p.pnlPct)} />
              </TableCell>
              <TableCell align="right">
                <span style={{ display: 'inline-flex', gap: 8 }}>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ bgcolor: MUJI.up, fontSize: 12, height: 26, px: 1, letterSpacing: '0.1em' }}
                    onClick={() => onQuickOrder({ symbol: p.symbol, side: 'buy' }, p)}
                  >
                    买入
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={p.availableQty <= 0}
                    sx={{ fontSize: 12, height: 26, px: 1, letterSpacing: '0.1em', color: MUJI.down, borderColor: 'rgba(79,125,92,.45)' }}
                    onClick={() => onQuickOrder({ symbol: p.symbol, side: 'sell' }, p)}
                  >
                    卖出
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          ))}
          {/* 底部合计条：持仓合计 + 今日卖出已实现 = 合计当日盈亏（对齐顶部汇总口径） */}
          <DayPnlSummaryRows summary={summary} />
        </TableBody>
      </Table>
    </TableContainer>
  );
}

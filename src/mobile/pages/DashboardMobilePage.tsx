/**
 * DashboardMobilePage — M2 BI 报表（移动版卡片流）：
 * 账户维度 + 时间范围 Segmented → KPI（复用 KpiCards，自动换行成 2 列）→
 * 净值曲线(220px) → 每日盈亏 → 持仓成本 vs 现价卡片 → 资产构成/集中度 →
 * 个股盈亏 TOP / 盈利占比。URL query 联动（?range=&acct=）与 PC 一致。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Snackbar, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import type { BiRange, BiReport } from '../../../shared/types';
import { formatPct, formatSignedYuan, formatYuan, formatYuanSymbol } from '../../../shared/money';
import { MUJI } from '../../theme/muji-theme';
import { biApi } from '../../services/bi-api';
import KpiCards from '../../components/dashboard/KpiCards';
import NavCurveChart from '../../components/dashboard/NavCurveChart';
import DailyPnlChart from '../../components/dashboard/DailyPnlChart';
import AllocationDonut from '../../components/dashboard/AllocationDonut';
import ConcentrationCard from '../../components/dashboard/ConcentrationCard';
import TopContributionChart from '../../components/dashboard/TopContributionChart';
import PnlRatioDonut from '../../components/dashboard/PnlRatioDonut';
import { pnlColor } from '../../components/PnlText';
import SegmentedControl from '../components/SegmentedControl';

const RANGES: Array<{ value: BiRange; label: string }> = [
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
  { value: '90d', label: '90天' },
  { value: 'ytd', label: '今年' },
  { value: 'all', label: '全部' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', p: 2 }}>
      <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: MUJI.ink, letterSpacing: '0.05em', mb: 1.25 }}>{title}</Typography>
      {children}
    </Box>
  );
}

/** 持仓成本 vs 现价 → 移动卡片（表格转上下两行布局） */
function PositionRowCards({ positions }: { positions: BiReport['positions'] }) {
  if (positions.length === 0) {
    return (
      <Typography sx={{ py: 2, textAlign: 'center', fontSize: 12.5, color: MUJI.ink3 }}>区间内无持仓记录</Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {positions.map((p) => (
        <Box key={p.symbol} sx={{ border: `1px solid ${MUJI.lineSoft}`, borderRadius: '4px', px: 1.75, py: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: MUJI.ink }}>{p.name}</Typography>
            <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3 }}>
              {p.symbol.replace(/^(sh|sz)/, '')}
            </Typography>
            <Typography className="num" sx={{ fontSize: 11, color: MUJI.ink3, ml: 'auto' }}>
              占比 {p.weightPct.toFixed(1)}%
            </Typography>
          </Box>
          <Box className="num" sx={{ display: 'flex', gap: 2.5, mt: 0.75, fontSize: 11.5, color: MUJI.ink3 }}>
            <span>成本 {formatYuan(p.avgCost)}</span>
            <span>现价 {formatYuan(p.price)}</span>
            <span>{p.qty} 股</span>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
            <Typography className="num" sx={{ fontSize: 12, color: pnlColor(p.pnl) }}>
              {formatSignedYuan(p.pnl)}
            </Typography>
            <Typography className="num" sx={{ fontSize: 11.5, color: pnlColor(p.pnl) }}>
              {formatPct(p.pnlPct)}
            </Typography>
            <Typography className="num" sx={{ fontSize: 11, color: MUJI.ink3, ml: 'auto' }}>
              市值 {formatYuanSymbol(p.marketValue)}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function DashboardMobilePage() {
  const [params, setParams] = useSearchParams();
  const range = (params.get('range') ?? '7d') as BiRange;
  const acct = params.get('acct') ?? 'all';

  const [report, setReport] = useState<BiReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const r = await biApi.getReport(range, acct);
      if (!ctrl.signal.aborted) {
        setReport(r);
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setSnack(err instanceof Error ? err.message : '报表加载失败');
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
      }
    }
  }, [range, acct]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  // 历史回放未完成：5s 自动重试（与 PC 一致）
  useEffect(() => {
    if (report && !report.replay.complete) {
      const t = window.setTimeout(() => void load(), 5000);
      return () => window.clearTimeout(t);
    }
  }, [report, load]);

  const setQuery = (next: { range?: BiRange; acct?: string }): void => {
    const p = new URLSearchParams(params);
    if (next.range) p.set('range', next.range);
    if (next.acct) p.set('acct', next.acct);
    setParams(p, { replace: true });
  };

  const accountOptions = [
    { value: 'all', label: '全部账户' },
    ...(report?.accounts ?? []).map((a) => ({ value: String(a.id), label: a.name })),
  ];
  const replaying = report !== null && !report.replay.complete;

  return (
    <Box sx={{ flex: 1, px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 账户维度 + 时间范围（URL query 唯一数据源） */}
      <SegmentedControl value={acct} options={accountOptions} onChange={(v) => setQuery({ acct: v })} scrollable />
      <SegmentedControl value={range} options={RANGES} onChange={(v) => setQuery({ range: v })} />

      {/* 回放生成中提示条 */}
      {replaying && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, bgcolor: '#fff8ef', border: `1px solid ${MUJI.red}`, borderRadius: '6px', fontSize: 12, color: MUJI.ink2 }}>
          <CircularProgress size={14} sx={{ color: MUJI.red }} />
          正在生成历史资产数据（已补 {report?.replay.filledDays ?? 0} 个交易日），完成后曲线自动完整…
        </Box>
      )}

      {loading && !report ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 10, gap: 1.5 }}>
          <CircularProgress size={22} sx={{ color: MUJI.red }} />
          <Typography sx={{ fontSize: 13, color: MUJI.ink3 }}>报表加载中…</Typography>
        </Box>
      ) : report ? (
        <>
          <KpiCards kpi={report.kpi} />

          <Section title="资产走势">
            <Box sx={{ height: 220 }}>
              <NavCurveChart series={report.navSeries} />
            </Box>
          </Section>

          <Section title="每日盈亏">
            <Box sx={{ height: 220 }}>
              <DailyPnlChart series={report.dailyPnlSeries} />
            </Box>
          </Section>

          <Section title="持仓成本 vs 现价">
            <PositionRowCards positions={report.positions} />
          </Section>

          <Section title="资产构成">
            <Box sx={{ height: 220 }}>
              <AllocationDonut slices={report.allocation} />
            </Box>
          </Section>

          <Section title="持仓集中度">
            <ConcentrationCard top1Pct={report.concentration.top1Pct} top5Pct={report.concentration.top5Pct} />
          </Section>

          <Section title="个股盈亏贡献（盈利 TOP5 + 亏损 TOP5）">
            <Box sx={{ height: 260 }}>
              <TopContributionChart items={report.topContribution} />
            </Box>
          </Section>

          <Section title="盈利个股占比">
            <Box sx={{ height: 220 }}>
              <PnlRatioDonut items={report.pnlRatio} />
            </Box>
          </Section>

          <Button variant="outlined" onClick={() => void load()} sx={{ minHeight: 44, color: MUJI.ink2, borderColor: MUJI.line }}>
            刷新报表
          </Button>

          <Typography sx={{ fontSize: 10.5, color: '#595959', textAlign: 'center', pb: 1 }}>
            模拟盘所有数据均为虚构 · 投资有风险，入市需谨慎
          </Typography>
        </>
      ) : null}

      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} message={snack ?? ''} />
    </Box>
  );
}

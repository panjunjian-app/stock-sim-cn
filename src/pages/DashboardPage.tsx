/**
 * DashboardPage — 分析报告首页（登录后默认页）
 * 布局：工具栏（账户维度 + 时间范围 + 进入账户）→ KPI 卡片 → 净值曲线/每日盈亏
 *       → 持仓分析 ｜ 资产构成/集中度 → 个股归因。
 * 状态：URL query 唯一数据源（?range=7d&acct=all），刷新/分享可还原。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { biApi } from '../services/bi-api';
import type { BiReport } from '../../shared/types';
import { MUJI } from '../theme/muji-theme';
import RangeSelector from '../components/dashboard/RangeSelector';
import AccountSelector from '../components/dashboard/AccountSelector';
import KpiCards from '../components/dashboard/KpiCards';
import NavCurveChart from '../components/dashboard/NavCurveChart';
import DailyPnlChart from '../components/dashboard/DailyPnlChart';
import PositionsCompareTable from '../components/dashboard/PositionsCompareTable';
import AllocationDonut from '../components/dashboard/AllocationDonut';
import ConcentrationCard from '../components/dashboard/ConcentrationCard';
import TopContributionChart from '../components/dashboard/TopContributionChart';
import PnlRatioDonut from '../components/dashboard/PnlRatioDonut';

function SectionCard(props: { title: string; children: React.ReactNode; flex?: string; minWidth?: number | string }) {
  return (
    <Paper
      variant="outlined"
      sx={{ flex: props.flex ?? '1 1 0', minWidth: props.minWidth ?? 320, bgcolor: MUJI.card, borderColor: MUJI.line, borderRadius: '4px', p: 2.25 }}
    >
      <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: MUJI.ink, letterSpacing: '0.05em', mb: 1.25 }}>{props.title}</Typography>
      {props.children}
    </Paper>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const range = params.get('range') ?? '7d';
  const acct = params.get('acct') ?? 'all';

  const [report, setReport] = useState<BiReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const r = await biApi.getReport(range, acct);
      if (!ctrl.signal.aborted) {
        setReport(r);
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setError(err instanceof Error ? err.message : '报表加载失败');
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

  // 历史回放未完成：5s 自动重试
  useEffect(() => {
    if (report && !report.replay.complete) {
      const t = window.setTimeout(() => void load(), 5000);
      return () => window.clearTimeout(t);
    }
  }, [report, load]);

  const replaying = report !== null && !report.replay.complete;

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, px: 4, py: 2.5 }}>
      {/* 工具栏 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 17, fontWeight: 500, color: MUJI.ink, letterSpacing: '0.08em', mr: 'auto' }}>分析报告</Typography>
        <AccountSelector accounts={report?.accounts ?? []} />
        <RangeSelector />
        <Button
          variant="contained"
          disableElevation
          onClick={() => navigate('/accounts')}
          sx={{ fontSize: 13, px: 2.25, py: 0.6, bgcolor: MUJI.red, '&:hover': { bgcolor: MUJI.red }, borderRadius: '3px', letterSpacing: '0.05em' }}
        >
          进入账户
        </Button>
      </Box>

      {/* 回放生成中提示条 */}
      {replaying && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2,
            px: 2,
            py: 1,
            bgcolor: '#fff8ef',
            border: `1px solid ${MUJI.red}`,
            borderRadius: '4px',
            fontSize: 12.5,
            color: MUJI.ink2,
          }}
        >
          <CircularProgress size={14} sx={{ color: MUJI.red }} />
          正在生成历史资产数据（已补 {report?.replay.filledDays ?? 0} 个交易日），完成后曲线自动完整，请稍候…
        </Box>
      )}

      {loading && !report ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 12, gap: 1.5 }}>
          <CircularProgress size={22} sx={{ color: MUJI.red }} />
          <Typography sx={{ fontSize: 13, color: MUJI.ink3 }}>报表加载中…</Typography>
        </Box>
      ) : error && !report ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13.5, color: MUJI.ink3, mb: 1.5 }}>{error}</Typography>
          <Button size="small" variant="outlined" onClick={() => void load()} sx={{ borderColor: MUJI.line, color: MUJI.ink2 }}>
            重新加载
          </Button>
        </Box>
      ) : report ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <KpiCards kpi={report.kpi} />

          <SectionCard title="资产走势">
            <NavCurveChart series={report.navSeries} />
          </SectionCard>

          <SectionCard title="每日盈亏">
            <DailyPnlChart series={report.dailyPnlSeries} />
          </SectionCard>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <SectionCard title="持仓成本 vs 现价" minWidth={480} flex="2 1 480px">
              <PositionsCompareTable positions={report.positions} />
            </SectionCard>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 340px', minWidth: 320 }}>
              <SectionCard title="资产构成">
                <AllocationDonut slices={report.allocation} />
              </SectionCard>
              <SectionCard title="持仓集中度">
                <ConcentrationCard top1Pct={report.concentration.top1Pct} top5Pct={report.concentration.top5Pct} />
              </SectionCard>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <SectionCard title="个股盈亏贡献（盈利 TOP5 + 亏损 TOP5）" minWidth={420} flex="1 1 420px">
              <TopContributionChart items={report.topContribution} />
            </SectionCard>
            <SectionCard title="盈利个股占比" minWidth={380} flex="1 1 380px">
              <PnlRatioDonut items={report.pnlRatio} />
            </SectionCard>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

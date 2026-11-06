/**
 * chart-theme.ts — BI 图表统一主题（Recharts）
 * 规则：所有 BI 图表只从此文件取色/取轴样式，禁止组件内硬编码。
 * A 股约定：涨 = 红，跌 = 绿。
 */
import { MUJI } from '../../theme/muji-theme';

export const BI_COLORS = {
  up: MUJI.up, // #d93025 涨/正
  down: MUJI.down, // #00a854 跌/负
  primary: MUJI.red, // 品牌橙（面积图主色）
  primarySoft: 'rgba(240, 131, 0, 0.10)',
  ink: MUJI.ink,
  ink2: MUJI.ink2,
  ink3: MUJI.ink3,
  line: MUJI.line,
  card: MUJI.card,
  // 环形图分类色板
  palette: ['#f08300', '#4a7dc9', '#00a854', '#d93025', '#9256c8', '#c9a227', '#5aa9a2', '#8c8c8c'],
} as const;

/** 通用直角坐标轴 props */
export const biAxisProps = {
  stroke: BI_COLORS.ink3,
  tick: { fontSize: 11, fill: BI_COLORS.ink2 },
  tickLine: false,
  axisLine: { stroke: BI_COLORS.line },
} as const;

export const biGridProps = {
  stroke: BI_COLORS.line,
  strokeDasharray: '3 3',
  vertical: false,
} as const;

/**
 * 分 → 万元/亿元 展示。
 * @param decimals 万/亿分支的小数位（默认 2）；元分支（<1万）固定 2 位（已精确到分）
 */
export function fmtCents(cents: number, decimals = 2): string {
  const yuan = cents / 100;
  const abs = Math.abs(yuan);
  const sign = yuan < 0 ? '-' : '';
  if (abs >= 1e8) {
    return `${sign}${(abs / 1e8).toFixed(decimals)}亿`;
  }
  if (abs >= 1e4) {
    return `${sign}${(abs / 1e4).toFixed(decimals)}万`;
  }
  return `${sign}${abs.toFixed(2)}`;
}

/** 分 → 带正负号的盈亏展示 */
export function fmtPnl(cents: number): string {
  return cents > 0 ? `+${fmtCents(cents)}` : fmtCents(cents);
}

/** 百分数展示（自带符号） */
export function fmtPct(pct: number): string {
  return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

/** 盈亏着色 */
export function pnlColor(v: number): string {
  return v > 0 ? BI_COLORS.up : v < 0 ? BI_COLORS.down : BI_COLORS.ink3;
}

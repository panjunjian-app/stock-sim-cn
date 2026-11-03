import { useMemo } from 'react';
import type { MinutePoint } from '../../shared/types';
import { MUJI } from '../theme/muji-theme';

export interface MinuteChartProps {
  points: MinutePoint[];
  prevClose: number;
}

const W = 740;
const H = 420;
const PL = 12;
const PR = 660;
const MAIN_T = 16;
const MAIN_B = 290;
const VOL_T = 310;
const VOL_B = 395;

/** MinuteChart — 自绘 SVG 分时图（价格线 + 均价线 + 成交量副图，低饱和配色） */
export default function MinuteChart({ points, prevClose }: MinuteChartProps) {
  const svg = useMemo(() => {
    if (points.length === 0) {
      return null;
    }
    let lo = Math.min(prevClose, ...points.map((p) => p.price));
    let hi = Math.max(prevClose, ...points.map((p) => p.price));
    if (hi === lo) {
      hi += 0.01;
      lo -= 0.01;
    }
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
    const n = points.length;
    const X = (i: number) => PL + (PR - PL) * (i / Math.max(n - 1, 1));
    const Y = (v: number) => MAIN_T + (MAIN_B - MAIN_T) * (1 - (v - lo) / (hi - lo));

    let s = '';
    // 网格与右轴价格
    for (let g = 0; g <= 4; g++) {
      const v = lo + ((hi - lo) * g) / 4;
      const y = Y(v);
      const c = v > prevClose ? MUJI.up : v < prevClose ? MUJI.down : MUJI.ink3;
      s += `<line x1="${PL}" y1="${y}" x2="${PR}" y2="${y}" stroke="${MUJI.lineSoft}" stroke-width="1"/>`;
      s += `<text x="${PR + 8}" y="${y + 4}" font-size="10" fill="${c}">${v.toFixed(2)}</text>`;
    }
    // 昨收虚线
    s += `<line x1="${PL}" y1="${Y(prevClose)}" x2="${PR}" y2="${Y(prevClose)}" stroke="#c6bfb1" stroke-width="1" stroke-dasharray="4 3"/>`;
    // 价格线下沿渐变填充
    let path = '';
    let avgPath = '';
    const maxVol = Math.max(...points.map((p) => p.volume), 1);
    for (let i = 0; i < n; i++) {
      path += `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(points[i].price).toFixed(1)} `;
      avgPath += `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(points[i].avgPrice).toFixed(1)} `;
      const c = points[i].price >= prevClose ? MUJI.up : MUJI.down;
      const h = ((VOL_B - VOL_T) * points[i].volume) / maxVol;
      s += `<rect x="${(X(i) - 1.4).toFixed(1)}" y="${(VOL_B - h).toFixed(1)}" width="2.8" height="${h.toFixed(1)}" fill="${c}" opacity=".55"/>`;
    }
    s += `<path d="${path}L${X(n - 1).toFixed(1)} ${MAIN_B} L${PL} ${MAIN_B} Z" fill="url(#mgrad)"/>`;
    s += `<path d="${path}" fill="none" stroke="#5a7d9a" stroke-width="1.4" stroke-linejoin="round"/>`;
    s += `<path d="${avgPath}" fill="none" stroke="#c2a26b" stroke-width="1.1" stroke-linejoin="round"/>`;
    s += `<defs><linearGradient id="mgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a7d9a" stop-opacity=".14"/><stop offset="1" stop-color="#5a7d9a" stop-opacity="0"/></linearGradient></defs>`;
    // 时间轴
    const marks = ['09:30', '10:30', '11:30/13:00', '14:00', '15:00'];
    marks.forEach((t, i) => {
      const x = PL + (PR - PL) * (i / (marks.length - 1));
      const anchor = i === 0 ? 'start' : i === marks.length - 1 ? 'end' : 'middle';
      s += `<text x="${x}" y="${H - 8}" font-size="10" fill="${MUJI.ink3}" text-anchor="${anchor}">${t}</text>`;
    });
    return s;
  }, [points, prevClose]);

  if (!svg) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: MUJI.ink3, fontSize: 12, letterSpacing: '0.1em' }}>
        分时数据暂时不可用
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      {svg}
    </svg>
  );
}

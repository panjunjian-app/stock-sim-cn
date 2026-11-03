import { useEffect, useRef } from 'react';
import { init, dispose } from 'klinecharts';
import type { KLineBar } from '../../shared/types';
import { MUJI } from '../theme/muji-theme';

export interface KLineChartProps {
  /** 已加载的 K 线（元为单位） */
  bars: KLineBar[];
}

/**
 * KLineChart — klinecharts v9 封装（日/周/月K + MA5/MA10 + VOL 副图）
 * 配色遵循 MUJI 低饱和语义：涨红 #a03e35 / 跌绿 #4f7d5c。
 */
export default function KLineChart({ bars }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const chart = init(containerRef.current, {
      styles: {
        grid: {
          horizontal: { color: MUJI.lineSoft },
          vertical: { show: false },
        },
        candle: {
          bar: {
            upColor: MUJI.up,
            downColor: MUJI.down,
            upBorderColor: MUJI.up,
            downBorderColor: MUJI.down,
            upWickColor: MUJI.up,
            downWickColor: MUJI.down,
          },
          priceMark: {
            high: { color: MUJI.ink3 },
            low: { color: MUJI.ink3 },
          },
        },
        indicator: {
          bars: [{ upColor: MUJI.up, downColor: MUJI.down, noChangeColor: MUJI.ink3 }],
          lines: [
            { color: '#b98d4f' },
            { color: '#8a7ba8' },
            { color: MUJI.ink3 },
            { color: '#5a7d9a' },
            { color: '#c4766d' },
          ],
        },
        crosshair: {
          horizontal: { line: { color: MUJI.line } },
          vertical: { line: { color: MUJI.line } },
        },
        xAxis: {
          axisLine: { color: MUJI.line },
          tickText: { color: MUJI.ink3, size: 10 },
        },
        yAxis: {
          axisLine: { color: MUJI.line },
          tickText: { color: MUJI.ink3, size: 10 },
        },
        separator: { color: MUJI.lineSoft },
      },
    });
    if (!chart) {
      return;
    }
    chart.createIndicator({ name: 'MA', calcParams: [5, 10] }, false, { id: 'main_pane' });
    chart.createIndicator('VOL', false, { id: 'vol_pane' });
    const data = bars.map((b) => ({
      timestamp: new Date(`${b.date}T00:00:00+08:00`).getTime(),
      open: b.open,
      close: b.close,
      high: b.high,
      low: b.low,
      volume: b.volume,
    }));
    chart.applyNewData(data);
    return () => {
      dispose(containerRef.current as HTMLElement);
    };
  }, [bars]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}

import { useEffect, useState } from 'react';
import { isInTradingHours, nextOpenTime } from '../../shared/trading-calendar';

export interface TradingTimeState {
  /** 是否处于连续竞价时段 */
  isOpen: boolean;
  /** 下一开市时间（UTC Date）；开市中为 null */
  nextOpen: Date | null;
}

/**
 * use-trading-time — 是否开市 / 下一开市时间（30s 自刷新）
 */
export function useTradingTime(): TradingTimeState {
  const [state, setState] = useState<TradingTimeState>(() => {
    const open = isInTradingHours();
    return { isOpen: open, nextOpen: open ? null : nextOpenTime() };
  });

  useEffect(() => {
    const update = () => {
      const open = isInTradingHours();
      setState({ isOpen: open, nextOpen: open ? null : nextOpenTime() });
    };
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return state;
}

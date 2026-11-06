/**
 * use-is-mobile — 设备判定 hook（<768px 视为移动端）
 * matchMedia + change 监听：窄屏拉宽窗口即时切回 PC 版；SSR 安全（无 window 返回 false）。
 */
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

function detect(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(detect);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent): void => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

/**
 * use-snapshot-heartbeat — 登录后全局 60s 快照心跳
 * fire-and-forget：失败静默（1501 上游降级/未登录等一律不弹窗）；
 * 页面隐藏（document.hidden）时跳过，回前台立即补一次。
 */
import { useEffect } from 'react';
import { biApi } from '../services/bi-api';

const INTERVAL_MS = 60_000;

export function useSnapshotHeartbeat(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let stopped = false;

    const beat = () => {
      if (document.hidden || stopped) {
        return;
      }
      void biApi.postSnapshot().catch(() => undefined);
    };

    beat(); // 进入即拍一次
    const timer = window.setInterval(beat, INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) {
        beat();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}

/**
 * bi-api.ts — BI 报表 API 客户端
 */
import { apiGet, apiPost } from './http';
import type { BiReport, BiSnapshotResult } from '../../shared/types';

export const biApi = {
  /** 聚合报表（range 非法服务端回退 7d） */
  getReport(range: string, acct: string): Promise<BiReport> {
    return apiGet<BiReport>(`/api/bi/report?range=${encodeURIComponent(range)}&acct=${encodeURIComponent(acct)}`);
  },
  /** 当日快照心跳（失败静默） */
  postSnapshot(): Promise<BiSnapshotResult> {
    return apiPost<BiSnapshotResult>('/api/bi/snapshot');
  },
};

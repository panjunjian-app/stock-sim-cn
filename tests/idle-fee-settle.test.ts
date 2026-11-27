/**
 * idle-fee-settle.test.ts — settleIdleFees 的进程内结算水位
 *
 * 背景：2026-11-27 D1 rows_read 告警（76% / 500万），定位到 GET /api/contests
 * 被前端 30s 轮询时，每次都对该比赛所有参赛账户全量重放成交、扫描罚息流水
 * （24h 内 19,568 次、约 90 万行）。修复为「同一 isolate 内同一结算日只完整结算一次」。
 *
 * 本用例只验证水位行为：首次调用会打 DB，第二次（同一 lastDay）必须一条 SQL 都不发。
 * 扣费正确性由 computeIdleChargeDays 的纯函数用例覆盖。
 */
import { describe, expect, it } from 'vitest';
import { __resetIdleFeeSettlementMemo, lastSettledTradingDay, settleIdleFees } from '../functions/lib/idle-fee';

/** 极简 D1 stub：只统计 SQL 条数，返回空结果集 */
function makeCountingDb() {
  const state = { queries: 0 };
  const rows = (sql: string) => {
    if (sql.includes('FROM contest_participants')) {
      return [{ account_id: 1 }];
    }
    return [];
  };
  const db = {
    prepare(sql: string) {
      state.queries += 1;
      const stmt = {
        bind: (..._args: unknown[]) => stmt,
        all: async () => ({ results: rows(sql) }),
        first: async () => rows(sql)[0] ?? null,
        run: async () => ({ meta: { changes: 0 } }),
      };
      return stmt;
    },
  };
  return { db: db as never, state };
}

describe('settleIdleFees 结算水位', () => {
  it('同一结算日内重复调用不再打 DB', async () => {
    __resetIdleFeeSettlementMemo();
    const lastDay = lastSettledTradingDay();
    if (lastDay === null) {
      return; // 极端日历下无已收市交易日，跳过（不影响主断言）
    }
    const { db, state } = makeCountingDb();
    // 比赛当天开赛 → tradingDaysBetween 只有 1 天 → 不可能进入扣费分支，只走读路径
    const contest = { id: 9001, init_cash: 1_000_000, start_date: lastDay };

    await settleIdleFees(db, contest);
    const firstRun = state.queries;
    expect(firstRun).toBeGreaterThan(0);

    await settleIdleFees(db, contest);
    expect(state.queries).toBe(firstRun); // 第二次零查询
  });

  it('清空水位后重新结算（模拟 isolate 冷启动）', async () => {
    __resetIdleFeeSettlementMemo();
    const lastDay = lastSettledTradingDay();
    if (lastDay === null) {
      return;
    }
    const { db, state } = makeCountingDb();
    const contest = { id: 9002, init_cash: 1_000_000, start_date: lastDay };

    await settleIdleFees(db, contest);
    const firstRun = state.queries;
    __resetIdleFeeSettlementMemo(); // 冷启动 → 水位丢失
    await settleIdleFees(db, contest);
    expect(state.queries).toBe(firstRun * 2); // 重新算一遍，幂等写入兜底
  });
});

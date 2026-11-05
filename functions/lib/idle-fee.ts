/**
 * idle-fee.ts — 游手好闲费（大比拼防坐赢规则）
 * 规则：进行中比赛，参赛者比赛账户自开赛以来「从未有过任何买卖成交」，
 *       则自开赛第二个已收市交易日起，每个已收市交易日扣除初始资金 × 1%
 *       （开赛首个交易日豁免，给玩家建仓时间；现金不足则按可用现金实扣，扣完为止）；
 *       一旦发生过买卖成交，该账户永久免收。费用记录写入该账户资金流水（type='penalty'）。
 * 实现：无 Cron，懒结算——访问大比拼列表时触发；remark 含扣费日期作幂等键，重复触发不重扣。
 */
import { beijingDateKey, beijingToTs, isTradingDay, tradingDaysBetween } from '../../shared/trading-calendar';
import type { PagesContext } from './env';

export const IDLE_FEE_RATE = 0.01;

interface ContestLike {
  id: number;
  init_cash: number;
  start_date: string | null;
}

/** 最近一个「已收市」的交易日（北京时间）：今天已过 closeHHmm → 今天；否则从昨天往前找（最多回溯 30 自然日）
 *  默认 15:00（扣费口径）；当日冠军展示用 '15:05'（与收盘覆盖快照时点对齐，避免取到盘中值） */
export function lastSettledTradingDay(now: number = Date.now(), closeHHmm: string = '15:00'): string | null {
  const todayKey = beijingDateKey(now);
  // 今天已过收市时刻 → 从今天找起；未收市 → 从昨天找起（昨天必然已收市）
  const anchor = now >= beijingToTs(todayKey, closeHHmm) ? now : now - 24 * 60 * 60 * 1000;
  for (let i = 0; i < 30; i++) {
    const ts = anchor - i * 24 * 60 * 60 * 1000;
    const key = beijingDateKey(ts);
    if (isTradingDay(key)) {
      return key;
    }
  }
  return null;
}

/** remark 幂等键：每账户每交易日至多一条 */
const feeRemark = (day: string) => `游手好闲费 ${day}（开赛以来无买卖，扣初始资金1%）`;

/**
 * 对单场 active 比赛结算游手好闲费（幂等：已有扣费记录的交易日自动跳过）。
 * 调用时机：GET /api/contests（finishDueContests 之后、仅 active 比赛）。
 */
export async function settleIdleFees(db: PagesContext['env']['DB'], contest: ContestLike, now: number = Date.now()): Promise<void> {
  const lastDay = lastSettledTradingDay(now);
  if (!lastDay || !contest.start_date || contest.start_date > lastDay) {
    return; // 尚无已收市交易日，或比赛尚未开赛
  }
  const allDays = tradingDaysBetween(contest.start_date, lastDay);
  const days = allDays.slice(1); // 开赛首个交易日豁免（给玩家建仓时间），第二个已收市交易日起生效
  if (days.length === 0) {
    return;
  }
  const fee = Math.round(contest.init_cash * IDLE_FEE_RATE); // 初始资金 × 1%（整数分）

  // 参赛者（已接受邀请且有比赛账户）
  const parts = await db
    .prepare("SELECT account_id FROM contest_participants WHERE contest_id = ?1 AND invite_status = 'accepted' AND account_id IS NOT NULL")
    .bind(contest.id)
    .all<{ account_id: number }>();
  const accounts = (parts.results ?? []).map((r) => r.account_id);
  if (accounts.length === 0) {
    return;
  }

  for (const accountId of accounts) {
    // 「终身制」判定：该账户自开赛以来只要有过任何一笔买卖成交，即永久免收
    const td = await db
      .prepare('SELECT COUNT(*) AS n FROM trades WHERE account_id = ?1')
      .bind(accountId)
      .first<{ n: number }>();
    if ((td?.n ?? 0) > 0) {
      continue;
    }

    // 已扣过费的日期集合（remark 幂等）
    const cf = await db
      .prepare("SELECT remark FROM cash_flows WHERE account_id = ?1 AND type = 'penalty'")
      .bind(accountId)
      .all<{ remark: string }>();
    const chargedDays = new Set((cf.results ?? []).map((r) => r.remark.split(' ')[1]));

    for (const day of days) {
      if (chargedDays.has(day)) {
        continue;
      }
      const remark = feeRemark(day);
      const acc = await db
        .prepare('SELECT cash_available FROM trade_accounts WHERE id = ?1')
        .bind(accountId)
        .first<{ cash_available: number }>();
      if (!acc) {
        break; // 账户不存在，跳过该参与者
      }
      const actual = Math.min(fee, Math.max(acc.cash_available, 0)); // 现金不足按可用实扣，扣完为止
      if (actual <= 0) {
        continue; // 无现金可扣：不记流水、不留标记（当日不产生费用）
      }
      // 原子幂等写入：NOT EXISTS 防并发重扣
      const ins = await db
        .prepare(
          `INSERT INTO cash_flows (account_id, type, amount, balance_after, ref_id, remark, created_at)
           SELECT ?1, 'penalty', ?2, ?3, NULL, ?4, ?5
           WHERE NOT EXISTS (SELECT 1 FROM cash_flows WHERE account_id = ?1 AND type = 'penalty' AND remark = ?4)`,
        )
        .bind(accountId, -actual, acc.cash_available - actual, remark, new Date(now).toISOString())
        .run();
      if ((ins.meta?.changes ?? 0) === 1) {
        await db
          .prepare('UPDATE trade_accounts SET cash_available = cash_available - ?2 WHERE id = ?1')
          .bind(accountId, actual)
          .run();
      }
    }
  }
}

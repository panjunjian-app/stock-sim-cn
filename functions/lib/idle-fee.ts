/**
 * idle-fee.ts — 游手好闲费（大比拼防躺赢规则）
 * 规则：进行中比赛，参赛比赛账户「连续三个交易日收市时空仓」（未持有任何股票），
 *       自第三个交易日起每个已收市交易日扣除初始资金 × 1%；空仓期间持续扣除，
 *       某日收市时有持仓即停止；此后再次连续三个交易日空仓则重新启动。
 *       费用记入账户资金流水（type='penalty'），现金不足按可用实扣、扣完为止。
 * 实现：无 Cron，懒结算——访问大比拼列表时触发；remark 含扣费日期作幂等键，重复触发不重扣。
 * 空仓判定：按成交记录重放推算各交易日收市持仓（Σ买入 − Σ卖出，按成交时间归日），
 *           全部股票净持仓为 0 即空仓。
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

/** remark 幂等键：每账户每交易日至多一条（旧版文案「开赛以来无买卖」的日期解析方式相同） */
const feeRemark = (day: string) => `游手好闲费 ${day}（连续三交易日空仓，扣初始资金1%）`;

/** 成交行（重放用） */
export interface IdleTradeRow {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  traded_at: string; // ISO UTC
}

/**
 * 纯函数：逐交易日重放成交，推算「连续三交易日空仓」应扣费的交易日集合。
 * - 每日收市（15:00）时全部股票净持仓为 0 → 该日空仓，连续计数 +1；有持仓 → 计数清零
 * - 连续计数 ≥3 的交易日计入扣费集合（第 3、4、5…天，直到重新建仓）
 * - traded_at ≤ 该日 15:00（北京时间）的成交计入当日收市持仓
 */
export function computeIdleChargeDays(days: string[], trades: IdleTradeRow[]): Set<string> {
  const sorted = [...trades].sort((a, b) => new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime());
  const chargeDays = new Set<string>();
  const pos = new Map<string, number>();
  let ptr = 0;
  let streak = 0;
  for (const day of days) {
    const closeTs = beijingToTs(day, '15:00');
    while (ptr < sorted.length && new Date(sorted[ptr].traded_at).getTime() <= closeTs) {
      const r = sorted[ptr];
      const q = (pos.get(r.symbol) ?? 0) + (r.side === 'buy' ? r.quantity : -r.quantity);
      pos.set(r.symbol, q);
      ptr++;
    }
    let qty = 0;
    for (const v of pos.values()) {
      qty += v;
    }
    if (qty > 0) {
      streak = 0; // 收市有持仓 → 连计数清零、不扣
      continue;
    }
    streak++;
    if (streak >= 3) {
      chargeDays.add(day);
    }
  }
  return chargeDays;
}

/**
 * 进程内结算水位：contestId → 已完整结算过的 lastDay。
 *
 * 为什么需要：GET /api/contests 被前端 30s 轮询，原先每次都对该比赛所有参赛账户
 * 全量重放成交记录 + 扫描全部罚息流水，实测 24h 内跑了 19,568 次、读掉约 90 万行
 * （占当日 rows_read 的四分之一）。而结算对象是「已收市交易日的空仓罚息」，
 * 同一 lastDay 内结果恒定，重复执行没有任何业务收益。
 *
 * 安全性：扣费写入本身用 NOT EXISTS 幂等，memo 只跳过重复计算，不承担正确性；
 *        isolate 冷启动后最坏多算一次，不会漏扣、不会重扣。
 * 副作用边界：同一 isolate 内若某账户因现金不足未扣费，当天充值后不会即时补扣，
 *        需等 isolate 回收或跨交易日（跨日后 lastDay 变化、memo 失效，自动重算补扣）。
 */
const settledMemo = new Map<number, string>();

/** 仅供测试：清空进程内结算水位 */
export function __resetIdleFeeSettlementMemo(): void {
  settledMemo.clear();
}

/**
 * 对单场 active 比赛结算游手好闲费（幂等：已有扣费记录的交易日自动跳过；
 * 空仓连续计数始终全量重放，与是否已扣无关，保证「建仓清零/重启」语义正确）。
 * 调用时机：GET /api/contests（finishDueContests 之后、仅 active 比赛）。
 */
export async function settleIdleFees(db: PagesContext['env']['DB'], contest: ContestLike, now: number = Date.now()): Promise<void> {
  const lastDay = lastSettledTradingDay(now);
  if (!lastDay || !contest.start_date || contest.start_date > lastDay) {
    return; // 尚无已收市交易日，或比赛尚未开赛
  }
  if (settledMemo.get(contest.id) === lastDay) {
    return; // 同一结算日已在本 isolate 内完整结算过
  }
  const days = tradingDaysBetween(contest.start_date, lastDay);
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
    // 该账户全部成交（空仓重放数据源）
    const tr = await db
      .prepare('SELECT symbol, side, quantity, traded_at FROM trades WHERE account_id = ?1 ORDER BY traded_at')
      .bind(accountId)
      .all<IdleTradeRow>();

    // 应扣费日 = 连续三交易日空仓的交易日
    const shouldCharge = computeIdleChargeDays(days, tr.results ?? []);

    // 已扣过费的日期集合（remark 幂等，兼容新旧文案：日期均为 remark 第二段）
    const cf = await db
      .prepare("SELECT remark FROM cash_flows WHERE account_id = ?1 AND type = 'penalty'")
      .bind(accountId)
      .all<{ remark: string }>();
    const chargedDays = new Set((cf.results ?? []).map((r) => r.remark.split(' ')[1]));

    for (const day of shouldCharge) {
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

  // 完整跑完（无异常）才登记水位：中途抛错不写，下次请求会重试
  if (settledMemo.size > 200) {
    settledMemo.clear(); // 防御性上限，比赛数量增长时避免长期 isolate 内存膨胀
  }
  settledMemo.set(contest.id, lastDay);
}

/**
 * available-label.ts — 「可卖数量」列的展示口径（桌面持仓表与移动端持仓卡共用）
 *
 * 背景（线上事故根因）：可卖数量为 0 有两类完全不同的原因——
 *   ① T+1 锁定：今日买入的份额当日不可卖（settled_date = ''），次一交易日解锁；
 *   ② 挂单冻结：存在未成交卖单冻结了股份，需到「委托」页撤单才解冻。
 * 旧实现只要 availableQty = 0 就无条件标注「（T+1）」，把「挂单冻结」误报成 T+1，
 * 用户据此以为系统出错。此处按「持仓 − 可卖 − 冻结」拆出真实原因。
 */
import type { Position } from '../../shared/types';

export interface AvailableLabel {
  /** 真实可卖股数（= availableQty，与下单校验 sellable 同源） */
  available: number;
  /** available = 0 时的原因文案；available > 0 时为 null（正常显示数字） */
  zeroReason: string | null;
  /** hover 提示：解释原因为 0 的原因与处置办法 */
  hint: string | null;
  /** T+1 锁定股数 = 持仓 − 可卖 − 冻结（≥0）：未解锁的今日买入份额 */
  t1LockedQty: number;
  /** 挂单冻结股数（>0 表示有未成交卖单占着股票） */
  frozenQty: number;
}

/**
 * 按真实原因生成可卖数量展示文案。
 * 两者并存（挂单冻结 + T+1 锁定）时优先提示挂单冻结并附股数（用户可直接处置的那一项）。
 */
export function describeAvailable(position: Position): AvailableLabel {
  const available = position.availableQty ?? 0;
  const frozenQty = position.frozenQty ?? 0;
  const t1LockedQty = Math.max((position.qty ?? 0) - available - frozenQty, 0);

  if (available > 0) {
    return {
      available,
      zeroReason: null,
      hint: frozenQty > 0 ? `其中 ${frozenQty} 股被未成交卖单冻结，撤单后可卖回` : null,
      t1LockedQty,
      frozenQty,
    };
  }
  if (frozenQty > 0) {
    return {
      available,
      zeroReason: t1LockedQty > 0 ? `0（挂单冻结 ${frozenQty}｜T+1 ${t1LockedQty}）` : `0（挂单冻结 ${frozenQty}）`,
      hint: `有 ${frozenQty} 股被未成交卖单冻结（可卖数量 = 持仓 − 冻结），到「委托」页撤单即可解冻卖出`,
      t1LockedQty,
      frozenQty,
    };
  }
  return {
    available,
    zeroReason: '0（T+1）',
    hint: '今日买入，受 A股 T+1 规则限制，次一交易日方可卖出',
    t1LockedQty,
    frozenQty,
  };
}

/**
 * shared/money.ts — 分↔元换算与展示格式化
 * 规则：存储/传输一律整数分；只有本模块与展示组件允许出现「元」。
 */

/**
 * 元（字符串优先，避免浮点误差）→ 分。
 * '1688.00' → 168800；'0.1' → 10；10 → 1000；非法输入返回 NaN。
 */
export function toCents(yuan: string | number): number {
  if (typeof yuan === 'number') {
    if (!Number.isFinite(yuan)) {
      return NaN;
    }
    return Math.round(yuan * 100);
  }
  const s = yuan.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) {
    return NaN;
  }
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const [intPart, decPart = ''] = body.split('.');
  const dec2 = (decPart + '00').slice(0, 2);
  const cents = parseInt(intPart, 10) * 100 + parseInt(dec2, 10);
  return neg ? -cents : cents;
}

/** 分 → 元（number，仅展示用） */
export function toYuan(cents: number): number {
  return cents / 100;
}

/** 分 → '1,234.56'（千分位，两位小数） */
export function formatYuan(cents: number): string {
  const yuan = cents / 100;
  const sign = yuan < 0 ? '-' : '';
  const abs = Math.abs(yuan);
  const [intPart, decPart] = abs.toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}.${decPart}`;
}

/** 分 → '¥1,234.56' */
export function formatYuanSymbol(cents: number): string {
  return `¥${formatYuan(cents)}`;
}

/** 带符号金额：+12,345.67 / -3,240.50 / 0.00 */
export function formatSignedYuan(cents: number): string {
  if (cents > 0) {
    return `+${formatYuan(cents)}`;
  }
  return formatYuan(cents); // 负数自带 -，0 为 0.00
}

/** 百分数（如 2.35）→ '+2.35%' / '-1.25%' / '0.00%' */
export function formatPct(pct: number): string {
  const fixed = pct.toFixed(2);
  return pct > 0 ? `+${fixed}%` : `${fixed}%`;
}

/** 成交量（股）→ '2.54万手' 风格文本（输入为股数） */
export function formatVolumeLots(shares: number): string {
  const lots = shares / 100;
  if (lots >= 10000) {
    return `${(lots / 10000).toFixed(2)}万手`;
  }
  return `${Math.round(lots).toLocaleString('en-US')}手`;
}

/** 成交额（分）→ '42.80亿' / '3,500万' 风格文本 */
export function formatAmountShort(cents: number): string {
  const yuan = cents / 100;
  if (yuan >= 100_000_000) {
    return `${(yuan / 100_000_000).toFixed(2)}亿`;
  }
  if (yuan >= 10_000) {
    return `${Math.round(yuan / 10_000).toLocaleString('en-US')}万`;
  }
  return Math.round(yuan).toLocaleString('en-US');
}

/**
 * market-data.ts — 免费行情代理：腾讯主源 / 新浪备源，超时 3s，失败降级。
 * 代码格式统一小写 'sh600519' / 'sz000001'。价格统一换算为整数分。
 */
import type { KLineBar, KLinePeriod, MinutePoint, Quote, Symbol as StockSymbol, Cents } from '../../shared/types';

const TIMEOUT_MS = 3_000;
const YUAN_MAX = 10_000_000; // 单价合理性上限（1 万元/股），防御脏数据

export interface KlineQuery {
  symbol: StockSymbol;
  period: KLinePeriod;
  count: number;
}

export interface MarketDataSource {
  /** 批量实时行情；全部失败抛错，部分成功返回已解析项 */
  fetchQuotes(symbols: StockSymbol[]): Promise<Quote[]>;
  /** 日/周/月 K 线（元为单位，仅展示用） */
  fetchKline(q: KlineQuery): Promise<KLineBar[]>;
  /** 当日分时（元为单位） */
  fetchMinute(symbol: StockSymbol): Promise<{ points: MinutePoint[]; prevClose: number }>;
}

function yuanToCents(y: number): Cents {
  return Math.round(y * 100);
}

function toNum(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

async function fetchWithTimeout(url: string, headers?: Record<string, string>): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------- 腾讯主源 ----------------

/** qt.gtimg.cn 实时行情（GBK 编码文本） */
async function fetchQuotesTencent(symbols: StockSymbol[]): Promise<Quote[]> {
  const resp = await fetchWithTimeout(`https://qt.gtimg.cn/q=${symbols.join(',')}`);
  if (!resp.ok) {
    throw new Error(`tencent http ${resp.status}`);
  }
  const buf = await resp.arrayBuffer();
  const text = new TextDecoder('gbk').decode(buf);
  const nowIso = new Date().toISOString();
  const out: Quote[] = [];
  const re = /v_(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const sym = m[1];
    const f = m[2].split('~');
    // 字段：1 名称 2 代码 3 最新价 4 昨收 5 今开 6 成交量(手) 33 最高 34 最低 37 成交额(万元)
    const price = toNum(f[3]);
    const prevClose = toNum(f[4]);
    if (!sym || !Number.isFinite(price) || price <= 0 || price > YUAN_MAX || !Number.isFinite(prevClose) || prevClose <= 0) {
      continue;
    }
    const volumeLots = toNum(f[6]);
    const amountWan = toNum(f[37]);
    out.push({
      symbol: sym,
      name: f[1] ?? sym,
      price: yuanToCents(price),
      prevClose: yuanToCents(prevClose),
      open: yuanToCents(toNum(f[5]) || price),
      high: yuanToCents(toNum(f[33]) || price),
      low: yuanToCents(toNum(f[34]) || price),
      volume: Number.isFinite(volumeLots) ? volumeLots : 0,
      amount: Number.isFinite(amountWan) ? yuanToCents(amountWan * 10_000) : 0,
      changePct: Number((((price - prevClose) / prevClose) * 100).toFixed(2)),
      fetchedAt: nowIso,
    });
  }
  if (out.length === 0) {
    throw new Error('tencent empty quote payload');
  }
  return out;
}

/** 新浪备源（需补 Referer） */
async function fetchQuotesSina(symbols: StockSymbol[]): Promise<Quote[]> {
  const resp = await fetchWithTimeout(`https://hq.sinajs.cn/list=${symbols.join(',')}`, {
    Referer: 'https://finance.sina.com.cn',
  });
  if (!resp.ok) {
    throw new Error(`sina http ${resp.status}`);
  }
  const text = await resp.text();
  const nowIso = new Date().toISOString();
  const out: Quote[] = [];
  const re = /hq_str_(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const sym = m[1];
    const f = m[2].split(',');
    if (f.length < 32) {
      continue;
    }
    // 字段：0 名称 1 今开 2 昨收 3 最新 4 最高 5 最低 8 成交量(股) 9 成交额(元)
    const price = toNum(f[3]);
    const prevClose = toNum(f[2]);
    if (!Number.isFinite(price) || price <= 0 || price > YUAN_MAX || !Number.isFinite(prevClose) || prevClose <= 0) {
      continue;
    }
    const volumeShares = toNum(f[8]);
    const amountYuan = toNum(f[9]);
    out.push({
      symbol: sym,
      name: f[0] || sym,
      price: yuanToCents(price),
      prevClose: yuanToCents(prevClose),
      open: yuanToCents(toNum(f[1]) || price),
      high: yuanToCents(toNum(f[4]) || price),
      low: yuanToCents(toNum(f[5]) || price),
      volume: Number.isFinite(volumeShares) ? Math.round(volumeShares / 100) : 0,
      amount: Number.isFinite(amountYuan) ? yuanToCents(amountYuan) : 0,
      changePct: Number((((price - prevClose) / prevClose) * 100).toFixed(2)),
      fetchedAt: nowIso,
    });
  }
  if (out.length === 0) {
    throw new Error('sina empty quote payload');
  }
  return out;
}

// ---------------- 腾讯 K 线 / 分时 ----------------

function periodKey(period: KLinePeriod): string {
  return period; // day / week / month
}

async function fetchKlineTencent(q: KlineQuery): Promise<KLineBar[]> {
  const count = Math.min(Math.max(q.count, 10), 800);
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${q.symbol},${periodKey(q.period)},,,${count},qfq`;
  const resp = await fetchWithTimeout(url);
  if (!resp.ok) {
    throw new Error(`tencent kline http ${resp.status}`);
  }
  const json = (await resp.json()) as {
    data?: Record<string, Record<string, unknown>>;
  };
  const node = json.data?.[q.symbol];
  if (!node) {
    throw new Error('tencent kline empty');
  }
  const rows = (node[`qfq${q.period}`] ?? node[q.period]) as unknown[] | undefined;
  if (!Array.isArray(rows)) {
    throw new Error('tencent kline rows missing');
  }
  const bars: KLineBar[] = [];
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 6) {
      continue;
    }
    const open = Number(r[1]);
    const close = Number(r[2]);
    const high = Number(r[3]);
    const low = Number(r[4]);
    const volume = Number(r[5]);
    if (![open, close, high, low, volume].every(Number.isFinite)) {
      continue;
    }
    bars.push({ date: String(r[0]), open, close, high, low, volume });
  }
  return bars;
}

async function fetchMinuteTencent(symbol: StockSymbol): Promise<{ points: MinutePoint[]; prevClose: number }> {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${symbol}`;
  const resp = await fetchWithTimeout(url);
  if (!resp.ok) {
    throw new Error(`tencent minute http ${resp.status}`);
  }
  const json = (await resp.json()) as {
    data?: Record<string, { data?: { data?: string[] }; qt?: Record<string, unknown[]> }>;
  };
  const node = json.data?.[symbol];
  const rows = node?.data?.data;
  if (!Array.isArray(rows)) {
    throw new Error('tencent minute empty');
  }
  // 昨收取 qt 数组第 4 项；缺失时用第一点价格兜底
  let prevClose = NaN;
  const qt = node?.qt?.[symbol];
  if (Array.isArray(qt) && qt.length > 4) {
    prevClose = toNum(String(qt[4]));
  }
  const points: MinutePoint[] = [];
  let cumVol = 0;
  let cumAmount = 0;
  for (const raw of rows) {
    if (typeof raw !== 'string') {
      continue;
    }
    const p = raw.trim().split(/\s+/);
    // 每点：'HHmm 价格 累计量(手) 均价'，部分行情缺均价则自行累计
    if (p.length < 2) {
      continue;
    }
    const time = `${p[0].slice(0, 2)}:${p[0].slice(2, 4)}`;
    const price = Number(p[1]);
    if (!Number.isFinite(price)) {
      continue;
    }
    const vol = Number(p[2]) || 0;
    const dVol = Math.max(vol - cumVol, 0);
    const dAmount = dVol * price * 100;
    cumVol = vol;
    cumAmount += dAmount;
    let avg = Number(p[3]);
    if (!Number.isFinite(avg)) {
      avg = cumVol > 0 ? cumAmount / (cumVol * 100) : price;
    }
    points.push({ time, price, avgPrice: avg, volume: dVol });
  }
  if (!Number.isFinite(prevClose) && points.length > 0) {
    prevClose = points[0].price;
  }
  if (points.length === 0 || !Number.isFinite(prevClose)) {
    throw new Error('tencent minute parse failed');
  }
  return { points, prevClose };
}

/** 默认数据源：主源失败自动切备源 */
export const marketData: MarketDataSource = {
  async fetchQuotes(symbols) {
    try {
      return await fetchQuotesTencent(symbols);
    } catch (e) {
      console.warn('[market] tencent quotes failed, fallback sina:', (e as Error).message);
      return await fetchQuotesSina(symbols);
    }
  },
  fetchKline: fetchKlineTencent,
  fetchMinute: fetchMinuteTencent,
};

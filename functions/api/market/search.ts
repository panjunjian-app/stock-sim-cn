import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import type { PagesContext } from '../../lib/env';

/** 浏览器 UA：免费公开接口对无 UA 的服务端请求常做风控 */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT_MS = 5_000;

export interface StockSearchItem {
  symbol: string; // sh600519 / sz300308
  name: string;
  market: string; // 沪A / 深A
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Referer: 'https://www.eastmoney.com/' }, signal: ctrl.signal });
    if (!resp.ok) throw new Error(`http ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 东财 suggest QuoteID → 本站 symbol：仅保留沪深 A 股（0.=深 1.=沪） */
function toSymbol(quoteId: string): string | null {
  const m = /^(0|1)\.(\d{6})$/.exec(quoteId);
  if (!m) return null;
  return (m[1] === '1' ? 'sh' : 'sz') + m[2];
}

/** GET /api/market/search?keyword= — 全市场股票搜索（代码/名称/拼音，东财免费 suggest 接口代理） */
export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    await requireAuth(ctx);
    const url = new URL(ctx.request.url);
    const keyword = (url.searchParams.get('keyword') ?? '').trim();
    if (!keyword || keyword.length > 20) {
      throw new ApiError(CODE.BAD_PARAM, '请输入搜索关键词');
    }

    const api = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10`;
    const json = (await fetchJson(api)) as {
      QuotationCodeTable?: { Data?: Array<{ QuoteID?: string; Name?: string; SecurityTypeName?: string; Classify?: string }> | null };
    };
    const rows = json.QuotationCodeTable?.Data ?? [];
    const items: StockSearchItem[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.QuoteID || !r.Name) continue;
      const symbol = toSymbol(r.QuoteID);
      if (!symbol || seen.has(symbol)) continue;
      seen.add(symbol);
      items.push({ symbol, name: r.Name, market: symbol.startsWith('sh') ? '沪A' : '深A' });
      if (items.length >= 10) break;
    }
    return ok({ items });
  } catch (err) {
    return handleError(err);
  }
};

import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import { checkSymbol } from '../../../shared/validate';
import type { PagesContext } from '../../lib/env';

/** 浏览器 UA：免费公开接口对无 UA 的服务端请求常做风控 */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT_MS = 5_000;

export interface StockNewsItem {
  title: string;
  url: string;
  time: string;
  source: string;
  type: 'ann' | 'news';
}

async function fetchJson(url: string, referer?: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, ...(referer ? { Referer: referer } : {}) },
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      throw new Error(`http ${resp.status}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/** symbol → 东财市场前缀：sh→1.、sz→0.；纯代码 */
function emCode(symbol: string): { mTypeAndCode: string; code: string } {
  const code = symbol.slice(2);
  const prefix = symbol.startsWith('sh') ? '1.' : '0.';
  return { mTypeAndCode: prefix + code, code };
}

/** 公司公告（经营动态：业绩/回购/增持/重大合同等） */
async function fetchAnnouncements(code: string): Promise<StockNewsItem[]> {
  // 注意：必须带 sr/ann_type/client_source，否则 stock_list 过滤失效、返回全站通用公告
  const url = `https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_index=1&page_size=8&ann_type=A&client_source=web&stock_list=${code}&f_node=0&s_node=0`;
  const json = (await fetchJson(url)) as {
    data?: { list?: Array<{ title?: string; art_code?: string; display_time?: string; notice_date?: string }> };
  };
  const list = json.data?.list ?? [];
  const out: StockNewsItem[] = [];
  for (const it of list) {
    if (!it.title || !it.art_code) continue;
    out.push({
      title: it.title,
      url: `https://data.eastmoney.com/notices/detail/${code}/${it.art_code}.html`,
      time: (it.display_time ?? it.notice_date ?? '').slice(0, 16),
      source: '公司公告',
      type: 'ann',
    });
  }
  return out;
}

/** 个股相关资讯 */
async function fetchStockNews(mTypeAndCode: string): Promise<StockNewsItem[]> {
  const url = `https://np-listapi.eastmoney.com/comm/web/getListInfo?cfh=1&client=web&mTypeAndCode=${mTypeAndCode}&type=1&pageSize=12`;
  const json = (await fetchJson(url, 'https://finance.eastmoney.com/')) as {
    data?: { list?: Array<{ Art_Title?: string; Art_ShowTime?: string; Art_Url?: string }> };
  };
  const list = json.data?.list ?? [];
  const out: StockNewsItem[] = [];
  for (const it of list) {
    if (!it.Art_Title || !it.Art_Url) continue;
    out.push({
      title: it.Art_Title,
      url: it.Art_Url,
      time: (it.Art_ShowTime ?? '').slice(0, 16),
      source: '东方财富',
      type: 'news',
    });
  }
  return out;
}

/** GET /api/market/news?symbol= — 个股新闻+公告（双源并行，单源失败不影响另一源） */
export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    await requireAuth(ctx);
    const url = new URL(ctx.request.url);
    const symbol = (url.searchParams.get('symbol') ?? '').toLowerCase();
    if (!checkSymbol(symbol).ok) {
      throw new ApiError(CODE.BAD_PARAM, 'symbol 格式不正确');
    }
    const { mTypeAndCode, code } = emCode(symbol);

    const [annR, newsR] = await Promise.allSettled([fetchAnnouncements(code), fetchStockNews(mTypeAndCode)]);
    const news: StockNewsItem[] = [];
    if (annR.status === 'fulfilled') news.push(...annR.value);
    if (newsR.status === 'fulfilled') news.push(...newsR.value);

    if (news.length === 0) {
      console.error('[market/news] both sources down:', annR.status === 'rejected' ? String(annR.reason) : '', newsR.status === 'rejected' ? String(newsR.reason) : '');
      return ok({ news: [], degraded: true }, '新闻暂时不可用');
    }
    return ok({ news, degraded: false });
  } catch (err) {
    return handleError(err);
  }
};

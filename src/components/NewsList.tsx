import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { MUJI } from '../theme/muji-theme';
import { marketApi, StockNewsItem } from '../services/market-api';
import type { Symbol as StockSymbol } from '../../shared/types';

/** 经营相关关键词：命中视为与基本面/股价关联度更高，置顶展示 */
const BIZ_KEYWORDS =
  /(业绩|预增|预减|扭亏|净利|营收|中标|合同|订单|回购|增持|减持|分红|派息|扩产|投产|产能|涨价|提价|降价|签约|获批|重组|并购|合作|投资|建设|量产|出口|新品)/;

/** NewsList — 看盘页下方：个股新闻 + 公司公告（东方财富免费公开接口） */
export default function NewsList({ symbol }: { symbol: StockSymbol }) {
  const [news, setNews] = useState<StockNewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDegraded(false);
    marketApi
      .getNews(symbol)
      .then((r) => {
        if (!alive) return;
        setNews(r.news ?? []);
        setDegraded(Boolean(r.degraded));
      })
      .catch(() => alive && setDegraded(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [symbol]);

  // 经营相关命中置顶（稳定排序：命中组在前，组内保持原时间序）
  const hits = news.filter((n) => BIZ_KEYWORDS.test(n.title));
  const rest = news.filter((n) => !BIZ_KEYWORDS.test(n.title));
  const ordered = [...hits, ...rest].slice(0, 15);

  return (
    <Box
      sx={{
        bgcolor: MUJI.card,
        border: `1px solid ${MUJI.line}`,
        borderRadius: '2px',
        mt: 2,
        p: '18px 24px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1.5 }}>
        <Typography sx={{ fontSize: 14.5, fontWeight: 500, letterSpacing: '0.05em' }}>相关新闻</Typography>
        <Typography sx={{ fontSize: 11, color: MUJI.ink3, ml: 1.5 }}>
          经营动态与市场资讯 · 可能影响股价表现
        </Typography>
        <Typography sx={{ fontSize: 10.5, color: MUJI.ink3, ml: 'auto' }}>数据来源：东方财富（仅供学习参考）</Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 4, justifyContent: 'center' }}>
          <CircularProgress size={16} sx={{ color: MUJI.red }} />
          <Typography sx={{ fontSize: 12.5, color: MUJI.ink2 }}>新闻加载中…</Typography>
        </Box>
      ) : degraded || ordered.length === 0 ? (
        <Typography sx={{ py: 4, textAlign: 'center', fontSize: 12.5, color: MUJI.ink3 }}>
          新闻暂时不可用，稍后自动恢复
        </Typography>
      ) : (
        <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
          {ordered.map((n, i) => {
            const isBiz = BIZ_KEYWORDS.test(n.title);
            return (
              <Box
                key={`${n.url}-${i}`}
                component="a"
                href={n.url}
                target="_blank"
                rel="noreferrer"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1.1,
                  borderBottom: `1px solid ${MUJI.lineSoft}`,
                  textDecoration: 'none',
                  '&:hover .news-title': { color: MUJI.red },
                }}
              >
                {isBiz && (
                  <Box
                    sx={{
                      flex: '0 0 auto',
                      fontSize: 10,
                      color: MUJI.red,
                      border: `1px solid ${MUJI.red}`,
                      borderRadius: '2px',
                      px: 0.6,
                      py: '1px',
                      lineHeight: 1.5,
                    }}
                  >
                    经营
                  </Box>
                )}
                <Typography
                  className="news-title"
                  sx={{ fontSize: 13, color: MUJI.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {n.title}
                </Typography>
                <Typography sx={{ flex: '0 0 auto', fontSize: 11, color: MUJI.ink3 }}>{n.source}</Typography>
                <Typography sx={{ flex: '0 0 auto', fontSize: 11, color: MUJI.ink3 }}>{n.time}</Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

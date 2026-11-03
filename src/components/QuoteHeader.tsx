import { Box, Typography } from '@mui/material';
import type { Quote } from '../../shared/types';
import { formatAmountShort, formatSignedYuan, formatYuanSymbol, formatYuan, formatPct } from '../../shared/money';
import { pnlColor } from './PnlText';
import { MUJI } from '../theme/muji-theme';

export interface QuoteHeaderProps {
  quote: Quote | undefined;
}

/** QuoteHeader — 实时报价大字区（价格/涨跌/开高低收/量额） */
export default function QuoteHeader({ quote }: QuoteHeaderProps) {
  if (!quote) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography sx={{ fontSize: 19, fontWeight: 300, letterSpacing: '0.15em' }}>—</Typography>
        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mt: 1, letterSpacing: '0.1em' }}>
          等待行情数据…（上游不可用时将保留最后快照）
        </Typography>
      </Box>
    );
  }
  const chg = quote.price - quote.prevClose;
  const color = pnlColor(chg, true);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap', position: 'relative' }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
          <Typography sx={{ fontSize: 19, fontWeight: 300, letterSpacing: '0.15em' }}>{quote.name}</Typography>
          <Typography sx={{ fontSize: 11, color: MUJI.ink3, letterSpacing: '0.1em' }} className="num">
            {quote.symbol.replace(/^(sh|sz)/, '')}
          </Typography>
          <Box
            sx={{
              fontSize: 10,
              color: MUJI.up,
              border: '1px solid rgba(160,62,53,.35)',
              borderRadius: '2px',
              px: 0.75,
              py: '1px',
            }}
          >
            {quote.symbol.startsWith('sh') ? '沪A' : '深A'}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mt: 1.5 }}>
          <Typography className="num" sx={{ fontSize: 36, fontWeight: 200, color }}>
            {formatYuanSymbol(quote.price)}
          </Typography>
          <Typography className="num" sx={{ fontSize: 14, fontWeight: 300, color }}>
            {formatSignedYuan(chg)}
          </Typography>
          <Typography className="num" sx={{ fontSize: 14, fontWeight: 300, color }}>
            {formatPct(quote.changePct)}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '6px 18px', ml: 'auto' }}>
        {(
          [
            ['今开', quote.open, quote.open >= quote.prevClose ? 1 : -1],
            ['昨收', quote.prevClose, 0],
            ['最高', quote.high, quote.high >= quote.prevClose ? 1 : -1],
            ['最低', quote.low, quote.low >= quote.prevClose ? 1 : -1],
          ] as Array<[string, number, number]>
        ).map(([label, val, dir]) => (
          <Box key={label}>
            <Typography sx={{ fontSize: 10.5, color: MUJI.ink3, letterSpacing: '0.1em' }}>{label}</Typography>
            <Typography className="num" sx={{ fontSize: 12.5, fontWeight: 300, color: dir === 0 ? MUJI.ink2 : pnlColor(dir) }}>
              {formatYuan(val)}
            </Typography>
          </Box>
        ))}
        <Box>
          <Typography sx={{ fontSize: 10.5, color: MUJI.ink3, letterSpacing: '0.1em' }}>成交量</Typography>
          <Typography className="num" sx={{ fontSize: 12.5, fontWeight: 300 }}>
            {Math.round(quote.volume).toLocaleString('en-US')}手
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 10.5, color: MUJI.ink3, letterSpacing: '0.1em' }}>成交额</Typography>
          <Typography className="num" sx={{ fontSize: 12.5, fontWeight: 300 }}>
            {formatAmountShort(quote.amount)}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: 10, color: MUJI.ink3, position: 'absolute', right: 24, bottom: 8 }} className="num">
        数据时间 {quote.fetchedAt.slice(11, 19)}（UTC）
      </Typography>
    </Box>
  );
}

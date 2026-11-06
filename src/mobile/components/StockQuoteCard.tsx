/**
 * StockQuoteCard — 行情卡片：名称/代码/现价/涨跌额/涨跌%。
 * 整卡可点（≥48px 行高），自选删除按钮常显（零 hover 依赖）。
 */
import { Box, Typography } from '@mui/material';
import type { Quote, Symbol as StockSymbol } from '../../../shared/types';
import { formatPct, formatSignedYuan, formatYuan } from '../../../shared/money';
import { MUJI } from '../../theme/muji-theme';

export interface StockQuoteCardProps {
  symbol: StockSymbol;
  name: string;
  quote: Quote | undefined;
  /** 自选删除回调（传入即显示常显删除按钮） */
  onDelete?: () => void;
  onClick?: () => void;
}

export default function StockQuoteCard({ symbol, name, quote, onDelete, onClick }: StockQuoteCardProps) {
  const chg = quote ? quote.price - quote.prevClose : 0;
  const dir = chg > 0 ? 1 : chg < 0 ? -1 : 0;
  const color = quote ? (dir > 0 ? MUJI.up : dir < 0 ? MUJI.down : MUJI.ink2) : MUJI.ink3;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 56,
        px: 2,
        py: 1.25,
        bgcolor: MUJI.card,
        border: `1px solid ${MUJI.line}`,
        borderRadius: '6px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, color: MUJI.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {quote?.name ?? name}
        </Typography>
        <Typography className="num" sx={{ fontSize: 10.5, color: MUJI.ink3 }}>
          {symbol.replace(/^(sh|sz)/, '')} · {symbol.startsWith('sh') ? '沪A' : '深A'}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', minWidth: 76 }}>
        <Typography className="num" sx={{ fontSize: 14.5, fontWeight: 500, color }}>
          {quote ? formatYuan(quote.price) : '—'}
        </Typography>
        <Typography className="num" sx={{ fontSize: 11, color }}>
          {quote ? formatSignedYuan(chg) : ''}
        </Typography>
      </Box>
      <Box
        className="num"
        sx={{
          minWidth: 64,
          textAlign: 'center',
          fontSize: 12.5,
          py: 0.6,
          borderRadius: '4px',
          bgcolor: quote && dir > 0 ? MUJI.upBg : quote && dir < 0 ? MUJI.downBg : 'transparent',
          color,
        }}
      >
        {quote ? formatPct(quote.changePct) : '—'}
      </Box>
      {onDelete && (
        <Box
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="移出自选"
          sx={{
            flex: '0 0 auto',
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: MUJI.ink3,
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ✕
        </Box>
      )}
    </Box>
  );
}

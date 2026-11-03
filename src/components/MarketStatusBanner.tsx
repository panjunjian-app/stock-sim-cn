import { Box, Typography } from '@mui/material';
import { useTradingTime } from '../hooks/use-trading-time';
import { MUJI } from '../theme/muji-theme';

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  // 转北京时间展示
  const bj = new Date(d.getTime() + 8 * 3600 * 1000);
  return `${bj.getUTCFullYear()}-${p(bj.getUTCMonth() + 1)}-${p(bj.getUTCDate())} ${p(bj.getUTCHours())}:${p(bj.getUTCMinutes())}`;
}

/** MarketStatusBanner — 休市中 / 交易中状态与下一开市时间 */
export default function MarketStatusBanner() {
  const { isOpen, nextOpen } = useTradingTime();
  if (isOpen) {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          fontSize: 11.5,
          color: MUJI.down,
          letterSpacing: '0.15em',
        }}
      >
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: MUJI.down }} />
        交易中（9:30-11:30 / 13:00-15:00）
      </Box>
    );
  }
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        fontSize: 11.5,
        color: MUJI.ink3,
        letterSpacing: '0.15em',
      }}
    >
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#c9c2b6' }} />
      休市中
      {nextOpen && (
        <Typography component="span" className="num" sx={{ fontSize: 11.5, color: MUJI.red }}>
          下一开市：{fmt(nextOpen)}
        </Typography>
      )}
    </Box>
  );
}

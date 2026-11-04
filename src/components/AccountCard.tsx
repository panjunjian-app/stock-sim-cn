import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import type { AccountInfo, Quote, Symbol as StockSymbol } from '../../shared/types';
import { formatPct, formatSignedYuan, formatYuanSymbol } from '../../shared/money';
import PnlText, { pnlColor } from './PnlText';
import { MUJI } from '../theme/muji-theme';

export interface AccountCardProps {
  account: AccountInfo;
  /** 该账户持仓相关标的的行情快照（市值/盈亏即时计算） */
  quotes: Record<StockSymbol, Quote>;
  onDelete: (account: AccountInfo) => void;
}

/** AccountCard — 账户卡片：总资产 / 当日盈亏 / 累计收益率 / 持仓数 */
export default function AccountCard({ account, quotes, onDelete }: AccountCardProps) {
  const navigate = useNavigate();

  let marketValue = 0;
  let prevValue = 0;
  for (const p of account.positionSymbols) {
    const q = quotes[p.symbol];
    marketValue += p.qty * (q ? q.price : p.avgCost);
    prevValue += p.qty * (q ? q.prevClose : p.avgCost);
  }
  const totalAsset = account.cashAvailable + account.frozenCash + marketValue;
  const dayPnl = marketValue - prevValue;
  const dayPnlPct = prevValue > 0 ? (dayPnl / prevValue) * 100 : 0;
  const totalPnl = totalAsset - account.totalDeposit;
  const totalPnlPct = account.totalDeposit > 0 ? (totalPnl / account.totalDeposit) * 100 : 0;

  return (
    <Box
      onClick={() => navigate(`/accounts/${account.id}`)}
      sx={{
        bgcolor: MUJI.card,
        border: `1px solid ${MUJI.line}`,
        borderRadius: '2px',
        p: '22px 24px 18px',
        cursor: 'pointer',
        transition: 'border-color .15s',
        '&:hover': { borderColor: '#b9b2a5' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 400, letterSpacing: '0.05em' }}>{account.name}</Typography>
        <Box
          sx={{
            fontSize: 10,
            color: MUJI.red,
            border: '1px solid rgba(127,0,25,.35)',
            borderRadius: '2px',
            px: 0.75,
            py: '1px',
            letterSpacing: '0.1em',
          }}
        >
          No.{account.id}
        </Box>
      </Box>
      <Typography className="num" sx={{ fontSize: 23, fontWeight: 500, mt: 2, mb: 0.75 }}>
        {formatYuanSymbol(totalAsset)}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MUJI.ink3, mt: 1.25, letterSpacing: '0.1em' }}>
        <span>当日盈亏</span>
        <PnlText value={dayPnl} text={`${formatSignedYuan(dayPnl)}（${formatPct(dayPnlPct)}）`} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MUJI.ink3, mt: 1, letterSpacing: '0.1em' }}>
        <span>累计收益</span>
        <PnlText value={totalPnl} text={`${formatSignedYuan(totalPnl)}（${formatPct(totalPnlPct)}）`} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: MUJI.ink3, mt: 1, letterSpacing: '0.1em' }}>
        <span>持仓</span>
        <span className="num" style={{ color: pnlColor(0, true) }}>{account.positionsCount} 只</span>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          size="small"
          variant="text"
          onClick={(e) => {
            e.stopPropagation();
            void onDelete(account);
          }}
          sx={{ fontSize: 11, color: MUJI.ink3, ml: 'auto' }}
        >
          删除
        </Button>
      </Box>
    </Box>
  );
}

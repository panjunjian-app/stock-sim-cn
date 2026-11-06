/**
 * TradeButtonBar — 个股详情底部固定「买入/卖出」双按钮条。
 * sticky 定位于 MobileLayout 滚动区底部，含 safe-area 底部间距。
 */
import { Box, Button } from '@mui/material';
import { MUJI } from '../../theme/muji-theme';
import { BTN_H, SAFE_BOTTOM } from '../theme';

export interface TradeButtonBarProps {
  onBuy: () => void;
  onSell: () => void;
}

export default function TradeButtonBar({ onBuy, onSell }: TradeButtonBarProps) {
  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 5,
        display: 'flex',
        gap: 1.5,
        px: 2,
        pt: 1.25,
        pb: `calc(12px + ${SAFE_BOTTOM})`,
        bgcolor: MUJI.card,
        borderTop: `1px solid ${MUJI.line}`,
        marginTop: 'auto',
      }}
    >
      <Button
        fullWidth
        variant="contained"
        onClick={onBuy}
        sx={{ height: BTN_H, fontSize: 15.5, bgcolor: MUJI.up, '&:hover': { bgcolor: MUJI.up } }}
      >
        买入
      </Button>
      <Button
        fullWidth
        variant="contained"
        onClick={onSell}
        sx={{ height: BTN_H, fontSize: 15.5, bgcolor: MUJI.down, '&:hover': { bgcolor: MUJI.down } }}
      >
        卖出
      </Button>
    </Box>
  );
}

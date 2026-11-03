import { Box } from '@mui/material';
import { MUJI } from '../theme/muji-theme';

/** DisclaimerBanner — 全站底部常驻免责声明（合规要求） */
export default function DisclaimerBanner() {
  return (
    <Box
      component="footer"
      sx={{
        flex: '0 0 auto',
        py: 1.5,
        textAlign: 'center',
        fontSize: 10.5,
        color: '#b5ac9e',
        letterSpacing: '0.2em',
        bgcolor: MUJI.paper,
        borderTop: `1px solid ${MUJI.lineSoft}`,
      }}
    >
      模拟盘所有资金与行情数据均为虚构，不构成任何投资建议 · 投资有风险，入市需谨慎
    </Box>
  );
}

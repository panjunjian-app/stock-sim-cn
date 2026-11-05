import { useState } from 'react';
import { PropsWithChildren } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Box, Button, Menu, MenuItem, Typography } from '@mui/material';
import { MUJI } from '../theme/muji-theme';
import DisclaimerBanner from '../components/DisclaimerBanner';
import AccountSettingsDialog from '../components/AccountSettingsDialog';
import { useAuthStore } from '../store/auth-store';
import { authApi } from '../services/auth-api';
import { useSnapshotHeartbeat } from '../hooks/use-snapshot-heartbeat';

const SIM_BANNER = '⚠️ 模拟盘 · 虚拟资金 · 与真实财产无关 · 仅供学习娱乐';

/**
 * AppLayout — 登录后页面外壳：
 * 顶部常驻「模拟盘」横幅 + 导航；底部免责声明。
 */
export default function AppLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      clear();
      navigate('/login', { replace: true });
    }
  };

  const activeTabStyle = (active: boolean) =>
    ({
      color: active ? MUJI.red : MUJI.ink2,
      borderBottom: active ? `1.5px solid ${MUJI.red}` : '1.5px solid transparent',
    }) as const;

  const path = window.location.pathname;
  const isDashboard = path.startsWith('/dashboard');
  const isContests = path.startsWith('/contests');
  const isAccounts = path.startsWith('/accounts');
  const isMarket = path.startsWith('/market') || path.startsWith('/trade');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // 登录态全局快照心跳（60s，静默失败）
  useSnapshotHeartbeat(Boolean(user));

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: MUJI.paper, overflow: 'hidden' }}>
      {/* 常驻模拟盘横幅 */}
      <Box
        sx={{
          flex: '0 0 30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: MUJI.red,
          color: '#ffffff',
          fontSize: 11.5,
          fontWeight: 500,
          letterSpacing: '0.05em',
        }}
      >
        {SIM_BANNER}
      </Box>

      {/* 导航 */}
      <Box
        sx={{
          flex: '0 0 58px',
          bgcolor: MUJI.card,
          borderBottom: `1px solid ${MUJI.line}`,
          display: 'flex',
          alignItems: 'center',
          px: 4,
          gap: 5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }} onClick={() => navigate('/dashboard')}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '2px',
              bgcolor: MUJI.red,
              color: MUJI.card,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            炒
          </Box>
          <Typography sx={{ fontSize: 15, fontWeight: 400, letterSpacing: '0.05em', color: MUJI.ink, cursor: 'pointer' }}>
            炒炒乐
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
          <Button disableRipple onClick={() => navigate('/dashboard')} sx={{ ...activeTabStyle(isDashboard), px: 1.75, py: 1, fontSize: 13.5, fontWeight: 400, letterSpacing: '0.1em' }}>
            分析报告
          </Button>
          <Button disableRipple onClick={() => navigate('/contests')} sx={{ ...activeTabStyle(isContests), px: 1.75, py: 1, fontSize: 13.5, fontWeight: 400, letterSpacing: '0.1em' }}>
            大比拼
          </Button>
          <Button disableRipple onClick={() => navigate('/accounts')} sx={{ ...activeTabStyle(isAccounts), px: 1.75, py: 1, fontSize: 13.5, fontWeight: 400, letterSpacing: '0.1em' }}>
            我的账户
          </Button>
          <Button disableRipple onClick={() => navigate('/market')} sx={{ ...activeTabStyle(isMarket), px: 1.75, py: 1, fontSize: 13.5, fontWeight: 400, letterSpacing: '0.1em' }}>
            行情
          </Button>
        </Box>
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', borderRadius: '4px', px: 0.75, py: 0.5, '&:hover': { bgcolor: MUJI.paper } }}
            >
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  bgcolor: MUJI.paper2,
                  border: `1px solid ${MUJI.line}`,
                  color: MUJI.ink2,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {(user.nickname || user.email).slice(0, 1).toUpperCase()}
              </Box>
              <Typography sx={{ fontSize: 12.5, color: MUJI.ink, letterSpacing: '0.1em' }}>{user.nickname || user.email}</Typography>
            </Box>
            <Menu anchorEl={anchorEl} open={anchorEl !== null} onClose={() => setAnchorEl(null)} sx={{ '& .MuiMenuItem-root': { fontSize: 13.5 } }}>
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  setSettingsOpen(true);
                }}
              >
                ⚙️ 账号设置
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  void handleLogout();
                }}
              >
                退出登录
              </MenuItem>
            </Menu>
            <Button size="small" variant="text" onClick={() => void handleLogout()} sx={{ color: MUJI.ink3, fontSize: 12, letterSpacing: '0.1em' }}>
              退出
            </Button>
          </Box>
        )}
      </Box>

      {/* 页面内容（固定视口内，由各页面自行管理滚动） */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>{children ?? <Outlet />}</Box>

      {/* 底部免责声明 */}
      <DisclaimerBanner />

      {/* 账号设置弹窗 */}
      <AccountSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </Box>
  );
}

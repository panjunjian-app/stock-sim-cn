/**
 * MobileLayout — 移动端登录后页面外壳：
 * 顶部 24px「模拟盘」横幅 + 内容独立滚动区（flex:1 + overflow:auto）+
 * 底部 5 Tab（52px + safe-area-inset-bottom 适配 iPhone 底部安全区）。
 * /order 路由隐藏底部 Tab（全屏下单沉浸）。
 * 内部挂载 use-snapshot-heartbeat：与 PC AppLayout 互斥渲染，同一时刻只有一份心跳。
 */
import type { PropsWithChildren } from 'react';
import { BottomNavigation, BottomNavigationAction, Box } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import InsightsIcon from '@mui/icons-material/Insights';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PersonIcon from '@mui/icons-material/Person';
import { MUJI } from '../../theme/muji-theme';
import { useAuthStore } from '../../store/auth-store';
import { useSnapshotHeartbeat } from '../../hooks/use-snapshot-heartbeat';
import { SAFE_BOTTOM, TAB_H } from '../theme';

const SIM_BANNER = '⚠️ 模拟盘 · 虚拟资金 · 与真实财产无关 · 仅供学习娱乐';

interface TabDef {
  value: string;
  label: string;
  Icon: typeof InsightsIcon;
}

const TABS: TabDef[] = [
  { value: '/dashboard', label: '报告', Icon: InsightsIcon },
  { value: '/market', label: '行情', Icon: ShowChartIcon },
  { value: '/accounts', label: '账户', Icon: AccountBalanceWalletIcon },
  { value: '/contests', label: '大比拼', Icon: EmojiEventsIcon },
  { value: '/me', label: '我的', Icon: PersonIcon },
];

/** 按路径解析当前高亮 Tab（/accounts/:id→账户；/trade/:symbol→行情；/order 隐藏 Tab） */
function currentTab(pathname: string): string | null {
  if (pathname.startsWith('/order')) {
    return null;
  }
  if (pathname.startsWith('/trade')) {
    return '/market';
  }
  const match = TABS.find((t) => pathname === t.value || pathname.startsWith(`${t.value}/`));
  return match ? match.value : null;
}

export default function MobileLayout({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const pathname = location.pathname;

  // 登录后全局快照心跳（60s，静默失败）
  useSnapshotHeartbeat(Boolean(user));

  const tabHidden = pathname.startsWith('/order');
  const value = currentTab(pathname);

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: MUJI.paper, overflow: 'hidden' }}>
      {/* 顶部模拟盘横幅（压缩至 24px） */}
      <Box
        sx={{
          flex: '0 0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: MUJI.red,
          color: '#ffffff',
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {SIM_BANNER}
      </Box>

      {/* 内容独立滚动区（页面自身不设 100vh） */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>{children}</Box>

      {/* 底部 5 Tab（/order 全屏沉浸时隐藏） */}
      {!tabHidden && (
        <BottomNavigation
          showLabels
          value={value}
          onChange={(_, newValue: string) => navigate(newValue)}
          sx={{
            flex: '0 0 auto',
            height: `calc(${TAB_H}px + ${SAFE_BOTTOM})`,
            paddingBottom: SAFE_BOTTOM,
            borderTop: `1px solid ${MUJI.line}`,
            bgcolor: MUJI.card,
            '& .MuiBottomNavigationAction-root': { minWidth: 56, fontSize: 11 },
            '& .Mui-selected': { color: MUJI.red },
          }}
        >
          {TABS.map(({ value: v, label, Icon }) => (
            <BottomNavigationAction key={v} value={v} label={label} icon={<Icon sx={{ fontSize: 22 }} />} disableRipple />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
}

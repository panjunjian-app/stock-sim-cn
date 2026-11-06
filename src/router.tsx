import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AccountListPage from './pages/AccountListPage';
import AccountDetailPage from './pages/AccountDetailPage';
import MarketPage from './pages/MarketPage';
import DashboardPage from './pages/DashboardPage';
import ContestsPage from './pages/ContestsPage';
import MobileLayout from './mobile/layouts/MobileLayout';
import { useIsMobile } from './hooks/use-is-mobile';
import {
  LoginMobilePage,
  RegisterMobilePage,
  ForgotPasswordMobilePage,
  DashboardMobilePage,
  MarketListMobilePage,
  StockDetailMobilePage,
  OrderMobilePage,
  AccountListMobilePage,
  AccountDetailMobilePage,
  ContestsMobilePage,
  MessagesMobilePage,
  MeMobilePage,
} from './mobile';
import { useAuthStore } from './store/auth-store';
import { MUJI } from './theme/muji-theme';

/** 登录守卫：未登录跳转 /login，登录态加载中显示占位；登录后按屏宽分发 PC / 移动布局 */
function RequireAuth() {
  const user = useAuthStore((s) => s.user);
  const loaded = useAuthStore((s) => s.loaded);
  const location = useLocation();
  const isMobile = useIsMobile();

  if (!loaded) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress size={24} sx={{ color: MUJI.red }} disableShrink />
      </Box>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return isMobile ? (
    <MobileLayout>
      <Outlet />
    </MobileLayout>
  ) : (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

/** 已登录访问登录/注册页时跳转分析报告首页 */
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loaded = useAuthStore((s) => s.loaded);
  if (loaded && user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/** 按屏宽二选一渲染 PC / 移动版页面（同一路径，窄屏拉宽窗口即时切回 PC 版） */
function ResponsiveRoute({ pc, mobile }: { pc: React.ReactNode; mobile: React.ReactNode }): JSX.Element {
  const isMobile = useIsMobile();
  return <>{isMobile ? mobile : pc}</>;
}

/** PC 侧 /order/:symbol 兜底：窄屏下单页在宽屏重定向到看盘页 */
function PcOrderFallback(): JSX.Element {
  const { symbol } = useParams<{ symbol: string }>();
  return <Navigate to={`/trade/${symbol ?? ''}`} replace />;
}

/** PC 侧 /me、/messages 兜底：PC 无独立页（对应能力在 AccountSettingsDialog/MessageBell） */
function PcDashboardFallback(): JSX.Element {
  return <Navigate to="/dashboard" replace />;
}

/** 移动页 lazy 加载占位 */
function PageFallback(): JSX.Element {
  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 10 }}>
      <CircularProgress size={22} sx={{ color: MUJI.red }} disableShrink />
    </Box>
  );
}

export default function AppRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <ResponsiveRoute pc={<LoginPage />} mobile={<LoginMobilePage />} />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuthed>
              <ResponsiveRoute pc={<RegisterPage />} mobile={<RegisterMobilePage />} />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RedirectIfAuthed>
              <ResponsiveRoute pc={<ForgotPasswordPage />} mobile={<ForgotPasswordMobilePage />} />
            </RedirectIfAuthed>
          }
        />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<ResponsiveRoute pc={<DashboardPage />} mobile={<DashboardMobilePage />} />} />
          <Route path="/contests" element={<ResponsiveRoute pc={<ContestsPage />} mobile={<ContestsMobilePage />} />} />
          <Route path="/accounts" element={<ResponsiveRoute pc={<AccountListPage />} mobile={<AccountListMobilePage />} />} />
          <Route path="/accounts/:id" element={<ResponsiveRoute pc={<AccountDetailPage />} mobile={<AccountDetailMobilePage />} />} />
          <Route path="/market" element={<ResponsiveRoute pc={<MarketPage />} mobile={<MarketListMobilePage />} />} />
          <Route path="/trade/:symbol" element={<ResponsiveRoute pc={<MarketPage />} mobile={<StockDetailMobilePage />} />} />
          {/* 移动主导航达路径（PC 侧重定向兜底） */}
          <Route path="/order/:symbol" element={<ResponsiveRoute pc={<PcOrderFallback />} mobile={<OrderMobilePage />} />} />
          <Route path="/me" element={<ResponsiveRoute pc={<PcDashboardFallback />} mobile={<MeMobilePage />} />} />
          <Route path="/messages" element={<ResponsiveRoute pc={<PcDashboardFallback />} mobile={<MessagesMobilePage />} />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

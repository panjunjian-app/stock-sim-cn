import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AccountListPage from './pages/AccountListPage';
import AccountDetailPage from './pages/AccountDetailPage';
import MarketPage from './pages/MarketPage';
import { useAuthStore } from './store/auth-store';
import { MUJI } from './theme/muji-theme';

/** 登录守卫：未登录跳转 /login，登录态加载中显示占位 */
function RequireAuth() {
  const user = useAuthStore((s) => s.user);
  const loaded = useAuthStore((s) => s.loaded);
  const location = useLocation();

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
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

/** 已登录访问登录/注册页时跳转账户列表 */
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loaded = useAuthStore((s) => s.loaded);
  if (loaded && user) {
    return <Navigate to="/accounts" replace />;
  }
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <RegisterPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <RedirectIfAuthed>
            <ForgotPasswordPage />
          </RedirectIfAuthed>
        }
      />
      <Route element={<RequireAuth />}>
        <Route path="/accounts" element={<AccountListPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/trade/:symbol" element={<MarketPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/accounts" replace />} />
      <Route path="*" element={<Navigate to="/accounts" replace />} />
    </Routes>
  );
}

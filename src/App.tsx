import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { mujiTheme } from './theme/muji-theme';
import AppRouter from './router';
import { useAuthStore } from './store/auth-store';

/**
 * App 根组件：主题 + 路由 + 启动时恢复登录态
 */
export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  return (
    <ThemeProvider theme={mujiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </ThemeProvider>
  );
}

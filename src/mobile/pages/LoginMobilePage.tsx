/**
 * LoginMobilePage — M1 登录（移动版）：
 * 单列竖排、输入/按钮 ≥48px、密码显隐切换、错误统一 Snackbar（顶部）。
 */
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, InputAdornment, Snackbar, TextField, Typography } from '@mui/material';
import { MUJI } from '../../theme/muji-theme';
import { authApi } from '../../services/auth-api';
import { ApiError } from '../../services/http';
import { useAuthStore } from '../../store/auth-store';
import { BTN_H } from '../theme';

const SIM_BANNER = '⚠️ 模拟盘 · 虚拟资金 · 与真实财产无关 · 仅供学习娱乐';

const fieldSx = { '& .MuiInputBase-root': { height: BTN_H, bgcolor: MUJI.card } } as const;

export default function LoginMobilePage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      const { user } = await authApi.login(email.trim().toLowerCase(), password);
      setUser(user);
      // 兜底：登录响应缺昵称/头像字段时异步补拉全量资料（不影响跳转）
      if (user.nickname === undefined || user.avatar === undefined) {
        void fetchMe();
      }
      navigate('/accounts', { replace: true });
    } catch (e) {
      setSnack(e instanceof ApiError ? e.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%', bgcolor: MUJI.paper }}>
      {/* 顶部模拟盘横幅（登录页在布局外壳之外，自带 24px 横幅） */}
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

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', px: 3, py: 5 }}>
        {/* Logo */}
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '4px',
            bgcolor: MUJI.red,
            mx: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: MUJI.card,
            fontSize: 26,
            fontWeight: 500,
          }}
        >
          炒
        </Box>
        <Typography sx={{ fontSize: 21, fontWeight: 500, textAlign: 'center', mt: 2, letterSpacing: '0.1em', textIndent: '0.1em' }}>
          炒炒乐
        </Typography>
        <Typography sx={{ fontSize: 12, color: MUJI.ink3, textAlign: 'center', mt: 1, letterSpacing: '0.05em' }}>
          A股模拟盘 · 零成本学炒股
        </Typography>

        <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mt: 4, mb: 1 }}>邮箱</Typography>
        <TextField
          fullWidth
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          sx={fieldSx}
        />
        <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2, mb: 1 }}>密码</Typography>
        <TextField
          fullWidth
          type={showPw ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          sx={fieldSx}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Box
                  component="button"
                  aria-label={showPw ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPw((v) => !v)}
                  sx={{ border: 'none', background: 'none', minWidth: 44, height: 44, fontSize: 12, color: MUJI.ink3, cursor: 'pointer', padding: 0 }}
                >
                  {showPw ? '隐藏' : '显示'}
                </Box>
              </InputAdornment>
            ),
          }}
        />

        <Button
          fullWidth
          variant="contained"
          sx={{ height: BTN_H, mt: 3.5, fontSize: 15 }}
          disabled={submitting || !email || !password}
          onClick={() => void submit()}
        >
          {submitting ? '登录中…' : '登 录'}
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 5, mt: 2.5, fontSize: 13 }}>
          <RouterLink to="/register" style={{ color: MUJI.ink2, textDecoration: 'none', letterSpacing: '0.1em' }}>
            注册账号
          </RouterLink>
          <RouterLink to="/forgot-password" style={{ color: MUJI.ink3, textDecoration: 'none', letterSpacing: '0.1em' }}>
            忘记密码？
          </RouterLink>
        </Box>

        <Typography sx={{ fontSize: 10.5, color: '#595959', textAlign: 'center', mt: 5, letterSpacing: '0.05em' }}>
          模拟盘所有数据均为虚构 · 投资有风险，入市需谨慎
        </Typography>
      </Box>

      {/* 错误统一 Snackbar（顶部） */}
      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} message={snack ?? ''} />
    </Box>
  );
}

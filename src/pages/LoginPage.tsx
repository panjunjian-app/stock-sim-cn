import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { MUJI } from '../theme/muji-theme';
import { authApi } from '../services/auth-api';
import { ApiError } from '../services/http';
import { useAuthStore } from '../store/auth-store';
import DisclaimerBanner from '../components/DisclaimerBanner';

const BANNER = '⚠️ 模拟盘 · 虚拟资金 · 与真实财产无关 · 仅供学习娱乐';

/** LoginPage — ① 登录：纸感底细线框卡片 + 深红 Logo */
export default function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await authApi.login(email.trim().toLowerCase(), password);
      setUser(user);
      // 兜底：若登录响应缺昵称/头像字段，异步补拉全量资料（不影响跳转）
      if (user.nickname === undefined || user.avatar === undefined) {
        void fetchMe();
      }
      navigate('/accounts', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: MUJI.paper }}>
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
        {BANNER}
      </Box>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Box sx={{ width: 430, bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '2px', p: '48px 48px 36px' }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '2px',
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
          <Typography sx={{ fontSize: 22, fontWeight: 500, textAlign: 'center', mt: 3, letterSpacing: '0.1em', textIndent: '0.1em' }}>
            炒炒乐
          </Typography>
          <Typography sx={{ fontSize: 12, color: MUJI.ink3, textAlign: 'center', mt: 1.25, letterSpacing: '0.05em' }}>
            A股模拟盘 · 零成本学炒股
          </Typography>

          <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mt: 3.5, mb: 1 }}>邮箱</Typography>
          <TextField
            fullWidth
            size="small"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
          <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2, mb: 1 }}>密码</Typography>
          <TextField
            fullWidth
            size="small"
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2, fontSize: 12.5 }}>
              {error}
            </Alert>
          )}
          <Button
            fullWidth
            variant="contained"
            sx={{ height: 46, mt: 3.5, fontSize: 14 }}
            disabled={submitting || !email || !password}
            onClick={() => void submit()}
          >
            {submitting ? '登录中…' : '登 录'}
          </Button>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4.5, mt: 2.5, fontSize: 12.5 }}>
            <RouterLink to="/register" style={{ color: MUJI.ink2, textDecoration: 'none', letterSpacing: '0.1em' }}>
              注册账号
            </RouterLink>
            <RouterLink to="/forgot-password" style={{ color: MUJI.ink3, textDecoration: 'none', letterSpacing: '0.1em' }}>
              忘记密码？
            </RouterLink>
          </Box>
        </Box>
        <Typography
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 10.5,
            color: '#595959',
            letterSpacing: '0.05em',
          }}
        >
          模拟盘所有数据均为虚构 · 投资有风险，入市需谨慎
        </Typography>
      </Box>
      <DisclaimerBanner />
    </Box>
  );
}

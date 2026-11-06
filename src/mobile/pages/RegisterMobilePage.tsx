/**
 * RegisterMobilePage — M1 注册（移动版）：
 * 单页竖排（邮箱 → 密码/确认 + 实时规则校验与强度），错误统一 Snackbar。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, InputAdornment, Snackbar, TextField, Typography } from '@mui/material';
import { MUJI } from '../../theme/muji-theme';
import { authApi } from '../../services/auth-api';
import { ApiError } from '../../services/http';
import { useAuthStore } from '../../store/auth-store';
import { checkEmail, checkPassword, passwordStrength } from '../../../shared/validate';
import { BTN_H } from '../theme';

const SIM_BANNER = '⚠️ 模拟盘 · 虚拟资金 · 与真实财产无关 · 仅供学习娱乐';

const fieldSx = { '& .MuiInputBase-root': { height: BTN_H, bgcolor: MUJI.card } } as const;

function RuleRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          bgcolor: ok ? '#6a9e76' : '#c9c2b6',
          color: '#fff',
          fontSize: 10,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {ok ? '✓' : '✕'}
      </Box>
      <Typography sx={{ fontSize: 12.5, color: MUJI.ink2 }}>{text}</Typography>
    </Box>
  );
}

export default function RegisterMobilePage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const rules = {
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    punct: /[^A-Za-z0-9]/.test(password),
  };
  const canSubmit = checkEmail(email).ok && checkPassword(password).ok && confirm === password && !submitting;

  const register = async (): Promise<void> => {
    setSubmitting(true);
    try {
      const { user } = await authApi.register(email.trim().toLowerCase(), password);
      setUser(user);
      if (user.nickname === undefined || user.avatar === undefined) {
        void fetchMe();
      }
      navigate('/accounts', { replace: true });
    } catch (e) {
      setSnack(e instanceof ApiError ? e.message : '注册失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const lvl = passwordStrength(password);
  const strengthText = lvl > 0 ? ['弱', '中', '强'][lvl - 1] : '—';

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%', bgcolor: MUJI.paper }}>
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

      <Box sx={{ flex: 1, px: 3, py: 4 }}>
        <Typography sx={{ fontSize: 19, fontWeight: 500, letterSpacing: '0.1em' }}>创建账号</Typography>
        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mt: 1, letterSpacing: '0.05em' }}>
          注册后即送模拟资金，一分钟开启练习之旅
        </Typography>

        <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mt: 3.5, mb: 1 }}>
          邮箱（唯一标识，用于登录）
        </Typography>
        <TextField fullWidth type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} sx={fieldSx} />

        <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2.5, mb: 1 }}>设置密码</Typography>
        <TextField
          fullWidth
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        <Box sx={{ display: 'flex', gap: 0.6, mt: 1.25, alignItems: 'center' }}>
          {['#c4766d', '#c2a26b', '#6a9e76'].map((c, i) => (
            <Box key={c} sx={{ flex: 1, height: 4, bgcolor: lvl >= i + 1 ? c : MUJI.lineSoft }} />
          ))}
          <Typography sx={{ fontSize: 11, color: MUJI.ink3, ml: 1.25, minWidth: 88, textAlign: 'right' }}>
            密码强度：{strengthText}
          </Typography>
        </Box>

        <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2.5, mb: 1 }}>确认密码</Typography>
        <TextField fullWidth type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} sx={fieldSx} />
        {confirm.length > 0 && (
          <Typography sx={{ fontSize: 11.5, color: confirm === password ? '#6a9e76' : MUJI.up, mt: 0.75 }}>
            {confirm === password ? '✓ 两次输入一致' : '✕ 两次输入不一致'}
          </Typography>
        )}

        <Box sx={{ bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '6px', p: 2, mt: 2.5 }}>
          <Typography sx={{ fontSize: 11, color: MUJI.ink3, mb: 1, letterSpacing: '0.05em' }}>密码规则（实时校验）</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <RuleRow ok={rules.upper} text="需包含大写字母（A-Z）" />
            <RuleRow ok={rules.lower} text="需包含小写字母（a-z）" />
            <RuleRow ok={rules.digit} text="需包含数字（0-9）" />
            <RuleRow ok={rules.punct} text="需包含标点符号（如 !@#$%）" />
          </Box>
        </Box>

        <Button fullWidth variant="contained" sx={{ height: BTN_H, mt: 3, fontSize: 15 }} disabled={!canSubmit} onClick={() => void register()}>
          {submitting ? '注册中…' : '完成注册'}
        </Button>
      </Box>

      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} message={snack ?? ''} />
    </Box>
  );
}

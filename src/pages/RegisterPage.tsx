import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { MUJI } from '../theme/muji-theme';
import { authApi } from '../services/auth-api';
import { ApiError } from '../services/http';
import { useAuthStore } from '../store/auth-store';
import { checkEmail, checkPassword, passwordStrength } from '../../shared/validate';
import DisclaimerBanner from '../components/DisclaimerBanner';

const STEPS = ['输入邮箱', '设置密码'] as const;

function RuleDot({ ok }: { ok: boolean }) {
  return (
    <Box
      sx={{
        width: 15,
        height: 15,
        borderRadius: '50%',
        bgcolor: ok ? '#6a9e76' : '#c9c2b6',
        color: '#fff',
        fontSize: 9,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {ok ? '✓' : '✕'}
    </Box>
  );
}

function StrengthBar({ pw }: { pw: string }) {
  const lvl = passwordStrength(pw);
  const colors = ['#c4766d', '#c2a26b', '#6a9e76'];
  const names = ['弱', '中', '强'];
  return (
    <Box sx={{ display: 'flex', gap: 0.6, mt: 1, alignItems: 'center' }}>
      {colors.map((c, i) => (
        <Box key={c} sx={{ flex: 1, height: 4, bgcolor: lvl >= i + 1 ? c : MUJI.lineSoft }} />
      ))}
      <Typography sx={{ fontSize: 11, color: MUJI.ink3, ml: 1.25, minWidth: 72, textAlign: 'right' }}>
        密码强度：{lvl > 0 ? names[lvl - 1] : '—'}
      </Typography>
    </Box>
  );
}

/** RegisterPage — 两步注册：邮箱（唯一标识）→ 设置密码（实时强度校验），无需验证码 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailOk = checkEmail(email).ok;
  const rules = {
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    punct: /[^A-Za-z0-9]/.test(password),
  };

  const register = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await authApi.register(email.trim().toLowerCase(), password);
      setUser(user);
      navigate('/accounts', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '注册失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const stepState = (i: number) => (i < step ? 'done' : i === step ? 'cur' : 'todo');

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
        ⚠️ 模拟盘 · 虚拟资金 · 与真实财产无关 · 仅供学习娱乐
      </Box>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ width: 490, bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '2px', p: '42px 48px 34px' }}>
          <Typography sx={{ fontSize: 19, fontWeight: 500, letterSpacing: '0.1em' }}>创建账号</Typography>
          <Typography sx={{ fontSize: 12, color: MUJI.ink3, mt: 1, letterSpacing: '0.05em' }}>
            注册后即送模拟资金，一分钟开启练习之旅
          </Typography>

          {/* 步骤条 */}
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 3.5, mb: 4 }}>
            {STEPS.map((label, i) => (
              <Box key={label} sx={{ display: 'contents' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: 96, flexShrink: 0 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 400,
                      bgcolor: stepState(i) === 'done' ? MUJI.ink : MUJI.card,
                      border: `1px solid ${stepState(i) === 'cur' ? MUJI.red : stepState(i) === 'done' ? MUJI.ink : MUJI.line}`,
                      color: stepState(i) === 'done' ? MUJI.card : stepState(i) === 'cur' ? MUJI.red : MUJI.ink3,
                    }}
                  >
                    {stepState(i) === 'done' ? '✓' : i + 1}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: 11.5,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.05em',
                      color: stepState(i) === 'cur' ? MUJI.red : stepState(i) === 'done' ? MUJI.ink2 : MUJI.ink3,
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
                {i < STEPS.length - 1 && (
                  <Box sx={{ flex: 1, height: 1, bgcolor: i < step ? '#9b948a' : MUJI.line, mt: -3.5 }} />
                )}
              </Box>
            ))}
          </Box>

          {step === 0 && (
            <>
              <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mb: 1 }}>
                邮箱（唯一标识，用于登录）
              </Typography>
              <TextField fullWidth size="small" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button
                fullWidth
                variant="contained"
                sx={{ height: 44, mt: 3 }}
                disabled={!emailOk}
                onClick={() => setStep(1)}
              >
                下一步
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mb: 1 }}>设置密码</Typography>
              <TextField fullWidth size="small" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <StrengthBar pw={password} />
              <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2.5, mb: 1 }}>确认密码</Typography>
              <TextField fullWidth size="small" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {confirm.length > 0 && (
                <Typography sx={{ fontSize: 11.5, color: confirm === password ? MUJI.down : MUJI.up, mt: 0.75 }}>
                  {confirm === password ? '✓ 两次输入一致' : '✕ 两次输入不一致'}
                </Typography>
              )}
              <Box sx={{ bgcolor: MUJI.paper2, borderRadius: '2px', p: 2, mt: 2 }}>
                <Typography sx={{ fontSize: 11, color: MUJI.ink3, mb: 1, letterSpacing: '0.05em' }}>密码规则（实时校验）</Typography>
                <Box sx={{ fontSize: 12.5, color: MUJI.ink2, lineHeight: 2.1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RuleDot ok={rules.upper} /> 需包含大写字母（A-Z）
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RuleDot ok={rules.lower} /> 需包含小写字母（a-z）
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RuleDot ok={rules.digit} /> 需包含数字（0-9）
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RuleDot ok={rules.punct} /> 需包含标点符号（如 !@#$%）
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
                <Button variant="outlined" sx={{ flex: '0 0 110px', height: 44, color: MUJI.ink2 }} onClick={() => setStep(0)}>
                  上一步
                </Button>
                <Button
                  variant="contained"
                  sx={{ flex: 1, height: 44 }}
                  disabled={!checkPassword(password).ok || confirm !== password || submitting}
                  onClick={() => void register()}
                >
                  {submitting ? '注册中…' : '完成注册'}
                </Button>
              </Box>
            </>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2, fontSize: 12.5 }}>
              {error}
            </Alert>
          )}
        </Box>
      </Box>
      {/* 底部免责声明（合规要求） */}
      <DisclaimerBanner />
    </Box>
  );
}

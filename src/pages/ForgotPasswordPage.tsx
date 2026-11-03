import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { MUJI } from '../theme/muji-theme';
import { authApi } from '../services/auth-api';
import { ApiError } from '../services/http';
import { checkEmail, checkPassword, checkVerifyCode, passwordStrength } from '../../shared/validate';
import CountdownButton from '../components/CountdownButton';
import DisclaimerBanner from '../components/DisclaimerBanner';

/** ForgotPasswordPage — 忘记密码：邮箱验证码校验后重置密码 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const sendCode = async () => {
    setError(null);
    setNotice(null);
    try {
      const r = await authApi.sendCode(email.trim().toLowerCase(), 'reset');
      if (r.devCode) {
        setCode(r.devCode);
        setNotice('开发模式（未配置邮件服务）：验证码已自动填入');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '验证码发送失败');
      throw e;
    }
  };

  const verify = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.verifyCode(email.trim().toLowerCase(), 'reset', code.trim());
      setStep(1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '验证码校验失败');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '重置失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: MUJI.paper }}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 430, bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '2px', p: '48px', textAlign: 'center' }}>
            <Typography sx={{ fontSize: 19, fontWeight: 200, letterSpacing: '0.4em' }}>重置成功</Typography>
            <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, mt: 2 }}>
              密码已更新，原登录状态已全部失效，请使用新密码重新登录。
            </Typography>
            <Button variant="contained" fullWidth sx={{ height: 44, mt: 3 }} onClick={() => navigate('/login', { replace: true })}>
              去登录
            </Button>
          </Box>
        </Box>
        <DisclaimerBanner />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: MUJI.paper }}>
      <Box
        sx={{
          flex: '0 0 30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${MUJI.line}`,
          color: MUJI.ink3,
          fontSize: 11,
          letterSpacing: '0.25em',
        }}
      >
        ⚠️ 模拟盘 · 虚拟资金 · 与真实财产无关 · 仅供学习娱乐
      </Box>
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ width: 430, bgcolor: MUJI.card, border: `1px solid ${MUJI.line}`, borderRadius: '2px', p: '44px 48px 36px' }}>
          <Typography sx={{ fontSize: 19, fontWeight: 200, letterSpacing: '0.4em', textAlign: 'center' }}>忘记密码</Typography>
          <Typography sx={{ fontSize: 12, color: MUJI.ink3, textAlign: 'center', mt: 1.25, letterSpacing: '0.1em' }}>
            通过邮箱验证码重置密码
          </Typography>

          {step === 0 && (
            <>
              <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.15em', mt: 3.5, mb: 1 }}>邮箱</Typography>
              <TextField fullWidth size="small" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.15em', mt: 2, mb: 1 }}>验证码</Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="6 位数字"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputProps={{ inputMode: 'numeric' }}
                />
                <CountdownButton onSend={sendCode} disabled={!checkEmail(email).ok} />
              </Box>
              {notice && (
                <Typography sx={{ fontSize: 11.5, color: MUJI.ink3, mt: 0.75 }}>{notice}</Typography>
              )}
              <Button
                fullWidth
                variant="contained"
                sx={{ height: 44, mt: 3 }}
                disabled={!checkVerifyCode(code).ok || submitting}
                onClick={() => void verify()}
              >
                {submitting ? '校验中…' : '下一步'}
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.15em', mt: 3.5, mb: 1 }}>新密码</Typography>
              <TextField fullWidth size="small" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <Typography sx={{ fontSize: 11, color: MUJI.ink3, mt: 0.75 }}>
                8~64 位，含大写 + 小写 + 数字 + 标点（强度：{['弱', '中', '强'][Math.max(passwordStrength(newPassword) - 1, 0)] ?? '—'}）
              </Typography>
              <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.15em', mt: 2, mb: 1 }}>确认新密码</Typography>
              <TextField fullWidth size="small" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <Button
                fullWidth
                variant="contained"
                sx={{ height: 44, mt: 3 }}
                disabled={!checkPassword(newPassword).ok || newPassword !== confirm || submitting}
                onClick={() => void reset()}
              >
                {submitting ? '提交中…' : '重置密码'}
              </Button>
            </>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2, fontSize: 12.5 }}>
              {error}
            </Alert>
          )}
          <Box sx={{ textAlign: 'center', mt: 2.5, fontSize: 12.5 }}>
            <RouterLink to="/login" style={{ color: MUJI.ink2, textDecoration: 'none', letterSpacing: '0.1em' }}>
              返回登录
            </RouterLink>
          </Box>
        </Box>
      </Box>
      {/* 底部免责声明（合规要求） */}
      <DisclaimerBanner />
    </Box>
  );
}

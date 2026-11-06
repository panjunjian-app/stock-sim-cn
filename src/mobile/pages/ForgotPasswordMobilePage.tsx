/**
 * ForgotPasswordMobilePage — M1 忘记密码（移动版）：
 * 邮箱验证码校验 → 设置新密码；复用 CountdownButton；错误统一 Snackbar。
 */
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, Snackbar, TextField, Typography } from '@mui/material';
import { MUJI } from '../../theme/muji-theme';
import { authApi } from '../../services/auth-api';
import { ApiError } from '../../services/http';
import { checkEmail, checkPassword, checkVerifyCode, passwordStrength } from '../../../shared/validate';
import CountdownButton from '../../components/CountdownButton';
import { BTN_H } from '../theme';

const SIM_BANNER = '⚠️ 模拟盘 · 虚拟资金 · 与真实财产无关 · 仅供学习娱乐';

const fieldSx = { '& .MuiInputBase-root': { height: BTN_H, bgcolor: MUJI.card } } as const;

export default function ForgotPasswordMobilePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const sendCode = async (): Promise<void> => {
    setNotice(null);
    try {
      const r = await authApi.sendCode(email.trim().toLowerCase(), 'reset');
      if (r.devCode) {
        setCode(r.devCode);
        setNotice('开发模式（未配置邮件服务）：验证码已自动填入');
      }
    } catch (e) {
      setSnack(e instanceof ApiError ? e.message : '验证码发送失败');
      throw e;
    }
  };

  const verify = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await authApi.verifyCode(email.trim().toLowerCase(), 'reset', code.trim());
      setStep(1);
    } catch (e) {
      setSnack(e instanceof ApiError ? e.message : '验证码校验失败');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await authApi.resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
      setDone(true);
    } catch (e) {
      setSnack(e instanceof ApiError ? e.message : '重置失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
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
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', px: 3 }}>
          <Typography sx={{ fontSize: 19, fontWeight: 500, letterSpacing: '0.1em', textAlign: 'center' }}>重置成功</Typography>
          <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, mt: 2, lineHeight: 1.9, textAlign: 'center' }}>
            密码已更新，原登录状态已全部失效，请使用新密码重新登录。
          </Typography>
          <Button variant="contained" fullWidth sx={{ height: BTN_H, mt: 3 }} onClick={() => navigate('/login', { replace: true })}>
            去登录
          </Button>
        </Box>
      </Box>
    );
  }

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
        <Typography sx={{ fontSize: 19, fontWeight: 500, letterSpacing: '0.1em' }}>忘记密码</Typography>
        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mt: 1, letterSpacing: '0.05em' }}>通过邮箱验证码重置密码</Typography>

        {step === 0 && (
          <>
            <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mt: 3.5, mb: 1 }}>邮箱</Typography>
            <TextField fullWidth type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={fieldSx} />
            <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2, mb: 1 }}>验证码</Typography>
            <TextField
              fullWidth
              placeholder="6 位数字"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ inputMode: 'numeric' }}
              sx={fieldSx}
            />
            <Box sx={{ mt: 1.5 }}>
              <CountdownButton onSend={sendCode} disabled={!checkEmail(email).ok} fullWidth />
            </Box>
            {notice && (
              <Typography sx={{ fontSize: 11.5, color: MUJI.ink3, mt: 1 }}>{notice}</Typography>
            )}
            <Button
              fullWidth
              variant="contained"
              sx={{ height: BTN_H, mt: 3, fontSize: 15 }}
              disabled={!checkVerifyCode(code).ok || submitting}
              onClick={() => void verify()}
            >
              {submitting ? '校验中…' : '下一步'}
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mt: 3.5, mb: 1 }}>新密码</Typography>
            <TextField fullWidth type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} sx={fieldSx} />
            <Typography sx={{ fontSize: 11, color: MUJI.ink3, mt: 0.75 }}>
              8~64 位，含大写 + 小写 + 数字 + 标点（强度：{['弱', '中', '强'][Math.max(passwordStrength(newPassword) - 1, 0)] ?? '—'}）
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, letterSpacing: '0.05em', mt: 2, mb: 1 }}>确认新密码</Typography>
            <TextField fullWidth type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} sx={fieldSx} />
            <Button
              fullWidth
              variant="contained"
              sx={{ height: BTN_H, mt: 3, fontSize: 15 }}
              disabled={!checkPassword(newPassword).ok || newPassword !== confirm || submitting}
              onClick={() => void reset()}
            >
              {submitting ? '提交中…' : '重置密码'}
            </Button>
          </>
        )}

        <Box sx={{ textAlign: 'center', mt: 3, fontSize: 13 }}>
          <RouterLink to="/login" style={{ color: MUJI.ink2, textDecoration: 'none', letterSpacing: '0.1em' }}>
            返回登录
          </RouterLink>
        </Box>
      </Box>

      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} message={snack ?? ''} />
    </Box>
  );
}

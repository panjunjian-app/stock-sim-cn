import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { toCents, formatYuanSymbol } from '../../shared/money';
import { checkInitCash } from '../../shared/validate';
import { accountApi } from '../services/account-api';
import { ApiError } from '../services/http';
import { MUJI } from '../theme/muji-theme';

export interface OpenAccountDialogProps {
  open: boolean;
  currentCount: number;
  maxCount: number;
  onClose: () => void;
  onCreated: () => void;
}

/** OpenAccountDialog — 开户弹窗（名称 + 初始资金即时校验，10 元 ~ 1000 万元） */
export default function OpenAccountDialog({ open, currentCount, maxCount, onClose, onCreated }: OpenAccountDialogProps) {
  const [name, setName] = useState('');
  const [cashYuan, setCashYuan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setCashYuan('');
    setError(null);
  };

  const cashCheck: { ok: boolean; reason?: string; cents?: number } = (() => {
    if (cashYuan.trim() === '') {
      return { ok: true };
    }
    const cents = toCents(cashYuan);
    if (Number.isNaN(cents)) {
      return { ok: false, reason: '金额格式不正确（最多两位小数）' };
    }
    const r = checkInitCash(cents);
    return r.ok ? { ok: true, cents } : { ok: false, reason: r.reason ?? '金额超出范围' };
  })();

  const submit = async () => {
    if (!cashCheck.ok || typeof cashCheck.cents !== 'number') {
      setError('初始资金不能低于 10 元（范围：10 元 ~ 1000 万元）');
      return;
    }
    if (name.trim().length === 0 || name.trim().length > 20) {
      setError('账户名称需为 1~20 个字符');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await accountApi.openAccount(name.trim(), cashCheck.cents);
      reset();
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '开户失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 460, bgcolor: MUJI.card } }}>
      <DialogTitle sx={{ fontWeight: 300, letterSpacing: '0.25em', fontSize: 16, pb: 1 }}>
        开立新交易账户
        <Typography component="span" sx={{ fontSize: 11, color: MUJI.ink3, ml: 1.5, letterSpacing: '0.1em' }}>
          {currentCount}/{maxCount} 个
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 12, color: MUJI.ink2, mt: 1, mb: 2, letterSpacing: '0.05em' }}>
          纯模拟账户，注入虚拟人民币资金，与真实财产无关
        </Typography>
        <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.15em', mb: 1 }}>账户名称</Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="如：稳健长线"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Typography sx={{ fontSize: 11, color: MUJI.ink3, mt: 0.75 }}>
          用于区分不同的练习策略，可随时修改
        </Typography>
        <Typography sx={{ fontSize: 12, color: MUJI.ink2, letterSpacing: '0.15em', mt: 2.5, mb: 1 }}>
          初始资金（元）
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="10000 ~ 10000000"
          value={cashYuan}
          error={cashCheck !== null && !cashCheck.ok}
          onChange={(e) => setCashYuan(e.target.value)}
          inputProps={{ inputMode: 'decimal' }}
        />
        {cashCheck !== null && cashCheck.ok && typeof cashCheck.cents === 'number' && (
          <Typography className="num" sx={{ fontSize: 11.5, color: MUJI.down, mt: 0.75 }}>
            将注入 {formatYuanSymbol(cashCheck.cents)} 虚拟资金
          </Typography>
        )}
        {cashCheck !== null && !cashCheck.ok && (
          <Typography sx={{ fontSize: 11.5, color: MUJI.up, mt: 0.75 }}>{cashCheck.reason}</Typography>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2, fontSize: 12.5 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          variant="outlined"
          onClick={() => {
            reset();
            onClose();
          }}
          sx={{ flex: 1, height: 42, color: MUJI.ink2 }}
        >
          取消
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={submitting} sx={{ flex: 1, height: 42 }}>
          {submitting ? '开户中…' : '确认开户'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

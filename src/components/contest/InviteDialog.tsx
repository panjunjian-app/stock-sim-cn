/**
 * InviteDialog — 发起挑战弹窗
 * 比赛名（1~30字）+ 每人初始资金（1万~1000万）+ 周期（1/3/6/12月）+ 邀请邮箱（1~2 个已注册用户）。
 */
import { useState } from 'react';
import { Box, Button, Dialog, TextField, Typography } from '@mui/material';
import { contestApi } from '../../services/contest-api';
import { ApiError } from '../../services/http';
import { MUJI } from '../../theme/muji-theme';
import { toYuan } from '../../../shared/money';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const DURATIONS = [
  { value: 1, label: '1 个月' },
  { value: 3, label: '3 个月' },
  { value: 6, label: '半年' },
  { value: 12, label: '1 年' },
];

export default function InviteDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [cash, setCash] = useState('100000');
  const [duration, setDuration] = useState<number>(1);
  const [email1, setEmail1] = useState('');
  const [email2, setEmail2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setCash('100000');
    setDuration(1);
    setEmail1('');
    setEmail2('');
    setError(null);
    setOkMsg(null);
  };

  const submit = async () => {
    setError(null);
    setOkMsg(null);
    const cashNum = Number(cash);
    if (!Number.isFinite(cashNum) || cashNum < 10000 || cashNum > 10000000) {
      setError('每人初始资金需在 1 万 ~ 1000 万元之间');
      return;
    }
    const emails = [email1.trim(), email2.trim()].filter(Boolean);
    if (emails.length === 0) {
      setError('请至少邀请 1 位用户（含发起人共 3 人上限）');
      return;
    }
    setSaving(true);
    try {
      await contestApi.create({ name: name.trim(), initCash: Math.round(cashNum * 100), durationMonths: duration, inviteEmails: emails });
      setOkMsg('✓ 挑战邀请已发送，等待对方确认');
      setTimeout(() => {
        reset();
        onClose();
        onCreated();
      }, 1200);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '发送失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '6px' } }}>
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500, color: MUJI.ink, mb: 0.5 }}>发起炒股挑战</Typography>
        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 2.5 }}>含发起人共 3 人上限；全员确认后当日开赛，进行中比赛每人最多 3 场</Typography>

        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 0.5 }}>比赛名称</Typography>
        <TextField size="small" fullWidth placeholder="例如：谁是股神·第一弹" value={name} onChange={(e) => setName(e.target.value)} inputProps={{ maxLength: 30 }} sx={{ mb: 2, '& .MuiInputBase-input': { fontSize: 13.5 } }} />

        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 0.5 }}>每人初始资金（元，1万~1000万，赛期锁定不可修改）</Typography>
        <TextField size="small" fullWidth type="number" value={cash} onChange={(e) => setCash(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { fontSize: 13.5 } }} />

        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 0.75 }}>比赛周期（一经开赛不可中止）</Typography>
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2 }}>
          {DURATIONS.map((d) => (
            <Button
              key={d.value}
              size="small"
              disableRipple
              onClick={() => setDuration(d.value)}
              sx={{
                flex: 1,
                fontSize: 12.5,
                color: duration === d.value ? '#ffffff' : MUJI.ink2,
                bgcolor: duration === d.value ? MUJI.red : MUJI.card,
                border: `1px solid ${duration === d.value ? MUJI.red : MUJI.line}`,
                borderRadius: '3px',
              }}
            >
              {d.label}
            </Button>
          ))}
        </Box>

        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 0.5 }}>被邀请人邮箱（1~2 位已注册用户）</Typography>
        <TextField size="small" fullWidth placeholder="被邀请人邮箱 ①" value={email1} onChange={(e) => setEmail1(e.target.value)} sx={{ mb: 1.25, '& .MuiInputBase-input': { fontSize: 13.5 } }} />
        <TextField size="small" fullWidth placeholder="被邀请人邮箱 ②（可选）" value={email2} onChange={(e) => setEmail2(e.target.value)} sx={{ mb: 2, '& .MuiInputBase-input': { fontSize: 13.5 } }} />

        {error && <Typography sx={{ fontSize: 12.5, color: MUJI.up, mb: 1.5 }}>{error}</Typography>}
        {okMsg && <Typography sx={{ fontSize: 12.5, color: MUJI.down, mb: 1.5 }}>{okMsg}</Typography>}

        <Button
          fullWidth
          variant="contained"
          disabled={saving || !name.trim()}
          onClick={() => void submit()}
          sx={{ bgcolor: MUJI.red, '&:hover': { bgcolor: MUJI.red }, fontSize: 14, py: 1 }}
        >
          发送挑战邀请（初始资金 {Number(cash || 0).toLocaleString('zh-CN')} 元/人{toYuan(Math.round(Number(cash || 0) * 100)) > 0 ? '' : ''}）
        </Button>
      </Box>
    </Dialog>
  );
}

/**
 * AccountSettingsDialog — 账号设置（右上角头像入口）
 * 邮箱只读（唯一标识）；昵称可改；修改密码（旧密码验证 + 策略校验，改后全端重新登录）。
 */
import { useState } from 'react';
import { Box, Button, Dialog, TextField, Typography } from '@mui/material';
import { useAuthStore } from '../store/auth-store';
import { profileApi } from '../services/contest-api';
import { ApiError } from '../services/http';
import { MUJI } from '../theme/muji-theme';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AccountSettingsDialog({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [nickMsg, setNickMsg] = useState<string | null>(null);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveNickname = async () => {
    setSaving(true);
    setNickMsg(null);
    try {
      await profileApi.updateNickname(nickname.trim());
      setNickMsg('✓ 昵称已保存');
    } catch (e) {
      setNickMsg(e instanceof ApiError ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async () => {
    setPwError(null);
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwError('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    try {
      await profileApi.changePassword(oldPw, newPw);
      setPwMsg('✓ 密码修改成功，其他设备需重新登录');
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e) {
      setPwError(e instanceof ApiError ? e.message : '修改失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '6px' } }}>
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500, color: MUJI.ink, mb: 2.5 }}>账号设置</Typography>

        {/* 邮箱（只读唯一标识） */}
        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 0.5 }}>登录邮箱（唯一标识，不可修改）</Typography>
        <TextField size="small" fullWidth value={user?.email ?? ''} disabled sx={{ mb: 2.5, '& .MuiInputBase-input': { fontSize: 13.5, color: MUJI.ink2 } }} />

        {/* 昵称 */}
        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 0.5 }}>昵称（比赛排行榜中展示）</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 0.75 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="给自己起个响亮的绰号"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            inputProps={{ maxLength: 20 }}
            sx={{ '& .MuiInputBase-input': { fontSize: 13.5 } }}
          />
          <Button variant="outlined" disabled={saving} onClick={() => void saveNickname()} sx={{ whiteSpace: 'nowrap', fontSize: 13, borderColor: MUJI.line, color: MUJI.ink2 }}>
            保存
          </Button>
        </Box>
        {nickMsg && (
          <Typography sx={{ fontSize: 12, color: nickMsg.startsWith('✓') ? MUJI.down : MUJI.up, mb: 1.5 }}>{nickMsg}</Typography>
        )}

        <Box sx={{ height: 1, bgcolor: MUJI.line, my: 2.5 }} />

        {/* 修改密码 */}
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: MUJI.ink, mb: 1.25 }}>修改密码</Typography>
        {[
          ['旧密码', oldPw, setOldPw],
          ['新密码（≥8位，含大小写+数字+标点）', newPw, setNewPw],
          ['确认新密码', confirmPw, setConfirmPw],
        ].map(([label, value, setter]) => (
          <TextField
            key={label as string}
            size="small"
            fullWidth
            type="password"
            label={label as string}
            value={value as string}
            onChange={(e) => (setter as (v: string) => void)(e.target.value)}
            sx={{ mb: 1.5, '& .MuiInputBase-input': { fontSize: 13.5 } }}
          />
        ))}
        {pwError && <Typography sx={{ fontSize: 12, color: MUJI.up, mb: 1 }}>{pwError}</Typography>}
        {pwMsg && <Typography sx={{ fontSize: 12, color: MUJI.down, mb: 1 }}>{pwMsg}</Typography>}
        <Button
          fullWidth
          variant="contained"
          disabled={saving || !oldPw || !newPw || !confirmPw}
          onClick={() => void submitPassword()}
          sx={{ bgcolor: MUJI.red, '&:hover': { bgcolor: MUJI.red }, fontSize: 13.5 }}
        >
          确认修改密码
        </Button>
      </Box>
    </Dialog>
  );
}

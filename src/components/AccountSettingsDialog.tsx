/**
 * AccountSettingsDialog — 账号设置（右上角头像入口）
 * 邮箱只读（唯一标识）；头像上传（客户端压缩 128px JPEG，≤80KB）；昵称可改；
 * 修改密码（旧密码验证 + 策略校验，改后全端重新登录）。
 */
import { useRef, useState } from 'react';
import { Box, Button, Dialog, IconButton, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuthStore } from '../store/auth-store';
import { profileApi } from '../services/contest-api';
import { ApiError } from '../services/http';
import { MUJI } from '../theme/muji-theme';

/** 头像目标尺寸与原始字节上限（与后端 AVATAR_MAX_BYTES 一致） */
const AVATAR_SIZE = 128;
const AVATAR_MAX_BYTES = 80 * 1024;

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 选择图片 → 居中裁剪压缩为 128px JPEG base64（纯客户端，零成本） */
const compressAvatar = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('画布不可用'));
          return;
        }
        // cover 裁剪：取中间正方形
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

export default function AccountSettingsDialog({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const fileRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? '');
  const [nickMsg, setNickMsg] = useState<string | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setAvatarMsg(null);
    if (!file.type.startsWith('image/')) {
      setAvatarMsg('请选择图片文件');
      return;
    }
    try {
      const dataUrl = await compressAvatar(file);
      if (dataUrl.length > Math.ceil((AVATAR_MAX_BYTES * 4) / 3) + 64) {
        setAvatarMsg('图片压缩后仍超过 80KB，请换一张更简单的图');
        return;
      }
      setSaving(true);
      await profileApi.updateProfile({ avatar: dataUrl });
      setAvatar(dataUrl);
      if (user) setUser({ ...user, avatar: dataUrl });
      setAvatarMsg('✓ 头像已更新');
    } catch (e) {
      setAvatarMsg(e instanceof ApiError ? e.message : '头像上传失败');
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveNickname = async () => {
    setSaving(true);
    setNickMsg(null);
    try {
      await profileApi.updateNickname(nickname.trim());
      if (user) setUser({ ...user, nickname: nickname.trim() });
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '6px', position: 'relative' } }}>
      {/* X 关闭按钮 */}
      <IconButton
        aria-label="关闭"
        onClick={onClose}
        size="small"
        sx={{ position: 'absolute', right: 10, top: 10, color: MUJI.ink3, '&:hover': { color: MUJI.ink } }}
      >
        <CloseIcon sx={{ fontSize: 20 }} />
      </IconButton>

      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500, color: MUJI.ink, mb: 2.5 }}>账号设置</Typography>

        {/* 头像 + 邮箱（只读唯一标识） */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
          <Box
            onClick={() => fileRef.current?.click()}
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              bgcolor: MUJI.paper2,
              border: `1px solid ${MUJI.line}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              '&:hover::after': {
                content: '"更换"',
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(0,0,0,0.45)',
                color: '#fff',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              },
            }}
          >
            {avatar ? (
              <Box component="img" src={avatar} alt="头像" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Typography sx={{ fontSize: 22, color: MUJI.ink3 }}>{(user?.email ?? '?').slice(0, 1).toUpperCase()}</Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 0.5 }}>登录邮箱（唯一标识，不可修改）</Typography>
            <TextField
              size="small"
              fullWidth
              value={user?.email ?? ''}
              disabled
              sx={{ mb: 0.5, '& .MuiInputBase-input': { fontSize: 13.5, color: MUJI.ink2 } }}
            />
            <Typography sx={{ fontSize: 11, color: MUJI.ink3 }}>点击头像可上传照片</Typography>
          </Box>
        </Box>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void pickAvatar(e.target.files?.[0])}
        />
        {avatarMsg && (
          <Typography sx={{ fontSize: 12, color: avatarMsg.startsWith('✓') ? MUJI.down : MUJI.up, mt: -1.5, mb: 1.5 }}>{avatarMsg}</Typography>
        )}

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

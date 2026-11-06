/**
 * InviteDialog — 发起挑战弹窗
 * 比赛名（1~30字）+ 每人初始资金（1万~1000万）+ 周期（1/3/6/12月）+ 邀请邮箱（1~4 个已注册用户，含发起人共 5 人）。
 * 被邀请人输入支持好友下拉/关键词搜索：与我同场竞技过的用户自动进入好友列表。
 */
import { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, Dialog, TextField, Typography } from '@mui/material';
import { contestApi, type Friend } from '../../services/contest-api';
import { ApiError } from '../../services/http';
import { MUJI } from '../../theme/muji-theme';
import { toYuan } from '../../../shared/money';

/** 邀请邮箱输入框数量 = 每场人数上限 - 发起人（与服务端 functions/lib/contest.ts CONTEST_MAX_PARTICIPANTS 保持一致） */
const MAX_INVITE_FIELDS = 4;
const SEQ = ['①', '②', '③', '④'];

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

/** 好友搜索框：下拉选项显示「昵称（邮箱）」，按昵称或邮箱关键词过滤，也允许自由输入新邮箱 */
function FriendEmailField({
  label,
  value,
  onChange,
  friends,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  friends: Friend[];
}) {
  return (
    <Autocomplete
      freeSolo
      disablePortal
      openOnFocus
      options={friends}
      getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.email)}
      filterOptions={(options, state) => {
        const kw = state.inputValue.trim().toLowerCase();
        if (!kw) return options;
        return options.filter((f) => f.email.toLowerCase().includes(kw) || f.nickname.toLowerCase().includes(kw));
      }}
      inputValue={value}
      onInputChange={(_, v) => onChange(v)}
      onBlur={() => {
        // 失焦时若选中的是完整好友项，回填其邮箱
        const hit = friends.find((f) => f.nickname === value);
        if (hit) onChange(hit.email);
      }}
      renderOption={(props, opt) => {
        const f = opt as Friend;
        return (
          <Box component="li" {...props} key={f.id} sx={{ fontSize: 13 }}>
            <Box sx={{ mr: 1.25, width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', bgcolor: MUJI.paper2, border: `1px solid ${MUJI.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {f.avatar ? (
                <Box component="img" src={f.avatar} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Typography sx={{ fontSize: 11, color: MUJI.ink3 }}>{f.nickname.slice(0, 1).toUpperCase()}</Typography>
              )}
            </Box>
            <Box>
              {f.nickname}
              {f.nickname !== f.email && (
                <Typography component="span" sx={{ fontSize: 11.5, color: MUJI.ink3, ml: 1 }}>{f.email}</Typography>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          fullWidth
          placeholder={label}
          sx={{ mb: 1.25, '& .MuiInputBase-input': { fontSize: 13.5 } }}
        />
      )}
    />
  );
}

export default function InviteDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [cash, setCash] = useState('100000');
  const [duration, setDuration] = useState<number>(1);
  const [emails, setEmails] = useState<string[]>(Array.from({ length: MAX_INVITE_FIELDS }, () => ''));
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 打开弹窗时拉取好友列表（同场竞技过的用户，静默失败不阻塞）
  useEffect(() => {
    if (!open) return;
    let alive = true;
    contestApi
      .friends()
      .then((r) => alive && setFriends(r.friends))
      .catch(() => alive && setFriends([]));
    return () => {
      alive = false;
    };
  }, [open]);

  const reset = () => {
    setName('');
    setCash('100000');
    setDuration(1);
    setEmails(Array.from({ length: MAX_INVITE_FIELDS }, () => ''));
    setError(null);
    setOkMsg(null);
  };

  /** 读取全部邀请邮箱（去首尾空格） */
  const emailsRaw = () => emails.map((e) => e.trim());

  const submit = async () => {
    setError(null);
    setOkMsg(null);
    const cashNum = Number(cash);    if (!Number.isFinite(cashNum) || cashNum < 10000 || cashNum > 10000000) {
      setError('每人初始资金需在 1 万 ~ 1000 万元之间');
      return;
    }
    const emails = emailsRaw().filter(Boolean);
    if (emails.length === 0) {
      setError(`请至少邀请 1 位用户（含发起人共 ${MAX_INVITE_FIELDS + 1} 人上限）`);
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
        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 2.5 }}>含发起人共 5 人上限；全员确认后当日开赛，进行中比赛每人最多 4 场、最多同时发起 4 场</Typography>

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

        <Typography sx={{ fontSize: 12, color: MUJI.ink3, mb: 0.5 }}>
          被邀请人邮箱（1~4 位已注册用户，可搜索好友）
        </Typography>
        {emails.map((val, i) => (
          <FriendEmailField
            key={i}
            label={`被邀请人邮箱 ${SEQ[i]}（${i === 0 ? '输入关键词搜好友' : '可选，可搜好友'}）`}
            value={val}
            onChange={(v) => setEmails(emails.map((e, j) => (j === i ? v : e)))}
            friends={friends}
          />
        ))}
        {friends.length === 0 && (
          <Typography sx={{ fontSize: 11, color: MUJI.ink3, mt: -0.75, mb: 1.5 }}>
            好友列表为空：与您同场竞技过的用户会自动出现在这里，也可以直接输入对方邮箱
          </Typography>
        )}

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

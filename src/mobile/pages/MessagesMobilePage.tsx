/**
 * MessagesMobilePage — M8 站内消息（移动版 P1）：
 * 消息卡片列表（标题/时间/已读态），点击标记已读，支持一键全部已读。
 */
import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Snackbar, Typography } from '@mui/material';
import { messageApi, type SystemMessage } from '../../services/contest-api';
import { MUJI } from '../../theme/muji-theme';

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return sameDay ? hm : `${d.getMonth() + 1}-${d.getDate()} ${hm}`;
};

export default function MessagesMobilePage() {
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await messageApi.list();
      setUnread(r.unread);
      setMessages(r.messages);
    } catch {
      setSnack('消息加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (m: SystemMessage): Promise<void> => {
    if (m.isRead) return;
    try {
      const r = await messageApi.markRead([m.id]);
      setUnread(r.unread);
      setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, isRead: true } : x)));
    } catch {
      setSnack('标记已读失败，请稍后重试');
    }
  };

  const markAllRead = async (): Promise<void> => {
    try {
      const r = await messageApi.markRead();
      setUnread(r.unread);
      setMessages((ms) => ms.map((m) => ({ ...m, isRead: true })));
    } catch {
      setSnack('操作失败，请稍后重试');
    }
  };

  return (
    <Box sx={{ flex: 1, px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ fontSize: 16, fontWeight: 500, letterSpacing: '0.05em' }}>
          系统消息
          {unread > 0 && (
            <Typography component="span" sx={{ fontSize: 12, color: MUJI.red, fontWeight: 400, ml: 1 }}>
              {unread} 条未读
            </Typography>
          )}
        </Typography>
        {unread > 0 && (
          <Button size="small" onClick={() => void markAllRead()} sx={{ ml: 'auto', fontSize: 12.5, color: MUJI.red, minHeight: 44 }}>
            全部已读
          </Button>
        )}
      </Box>

      {loading ? (
        <Typography sx={{ py: 8, textAlign: 'center', fontSize: 13, color: MUJI.ink3 }}>加载中…</Typography>
      ) : messages.length === 0 ? (
        <Box sx={{ bgcolor: MUJI.card, border: `1px dashed ${MUJI.line}`, borderRadius: '6px', p: 5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13.5, color: MUJI.ink3 }}>🔔 暂无消息</Typography>
          <Typography sx={{ fontSize: 12, color: MUJI.ink3, mt: 1 }}>比赛邀请、取消通知等系统消息会出现在这里</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {messages.map((m) => (
            <Box
              key={m.id}
              onClick={() => void markRead(m)}
              sx={{
                px: 2,
                py: 1.5,
                minHeight: 52,
                bgcolor: MUJI.card,
                border: `1px solid ${m.isRead ? MUJI.line : MUJI.red}`,
                borderRadius: '6px',
                cursor: m.isRead ? 'default' : 'pointer',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: m.isRead ? 400 : 500, color: MUJI.ink }}>{m.title}</Typography>
                {!m.isRead && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: MUJI.red, flexShrink: 0 }} />}
                <Typography className="num" sx={{ fontSize: 11, color: MUJI.ink3, ml: 'auto', whiteSpace: 'nowrap' }}>
                  {fmtTime(m.createdAt)}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 12.5, color: MUJI.ink2, lineHeight: 1.8, mt: 0.5 }}>{m.body}</Typography>
            </Box>
          ))}
        </Box>
      )}

      <Snackbar open={snack !== null} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} message={snack ?? ''} />
    </Box>
  );
}

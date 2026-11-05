/**
 * MessageBell — 顶栏站内消息铃铛
 * 未读数红点（60s 轮询）；点击弹出最近消息列表（未读加粗），支持一键全部已读。
 */
import { useCallback, useEffect, useState } from 'react';
import { Badge, Box, Button, Menu, Typography } from '@mui/material';
import { messageApi, type SystemMessage } from '../services/contest-api';
import { MUJI } from '../theme/muji-theme';

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return sameDay ? hm : `${d.getMonth() + 1}-${d.getDate()} ${hm}`;
};

export default function MessageBell() {
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await messageApi.list();
      setUnread(r.unread);
      setMessages(r.messages);
    } catch {
      // 静默失败（轮询场景）
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const open = anchorEl !== null;
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    void load();
  };

  const markAllRead = async () => {
    try {
      const r = await messageApi.markRead();
      setUnread(r.unread);
      setMessages((ms) => ms.map((m) => ({ ...m, isRead: true })));
    } catch {
      // 静默
    }
  };

  return (
    <Box>
      <Box
        onClick={handleOpen}
        sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', px: 0.75, py: 0.75, borderRadius: '4px', '&:hover': { bgcolor: MUJI.paper } }}
      >
        <Badge badgeContent={unread} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16 } }}>
          <Typography sx={{ fontSize: 17, lineHeight: 1 }}>🔔</Typography>
        </Badge>
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 340, maxHeight: 420, mt: 1 } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.25, pb: 0.75 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: MUJI.ink, mr: 'auto' }}>系统消息</Typography>
          {unread > 0 && (
            <Button size="small" onClick={() => void markAllRead()} sx={{ fontSize: 12, color: MUJI.red, minWidth: 0, px: 1 }}>
              全部已读
            </Button>
          )}
        </Box>
        {messages.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: MUJI.ink3, px: 2, py: 3, textAlign: 'center' }}>暂无消息</Typography>
        ) : (
          messages.map((m) => (
            <Box
              key={m.id}
              onClick={() => {
                if (!m.isRead) {
                  void messageApi.markRead([m.id]).then((r) => {
                    setUnread(r.unread);
                    setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, isRead: true } : x)));
                  });
                }
              }}
              sx={{ px: 2, py: 1.25, borderTop: `1px solid ${MUJI.line}`, bgcolor: m.isRead ? 'transparent' : '#faf7f1', cursor: m.isRead ? 'default' : 'pointer', '&:hover': { bgcolor: m.isRead ? 'transparent' : MUJI.paper2 } }}
            >
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: m.isRead ? 400 : 500, color: MUJI.ink }}>{m.title}</Typography>
                <Typography sx={{ fontSize: 11, color: MUJI.ink3, ml: 'auto', whiteSpace: 'nowrap' }}>{fmtTime(m.createdAt)}</Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: MUJI.ink2, lineHeight: 1.7, mt: 0.25 }}>{m.body}</Typography>
            </Box>
          ))
        )}
      </Menu>
    </Box>
  );
}

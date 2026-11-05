-- 0007_system_messages.sql — 站内系统消息（比赛取消等事件通知）
CREATE TABLE IF NOT EXISTS system_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  ref_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sm_user ON system_messages (user_id, created_at DESC);

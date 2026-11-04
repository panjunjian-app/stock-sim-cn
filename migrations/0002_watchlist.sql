-- 0002_watchlist.sql — 用户自选股（我的自选 Tab）
CREATE TABLE IF NOT EXISTS watchlist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  symbol     TEXT    NOT NULL,              -- sh600519 / sz300308
  name       TEXT    NOT NULL DEFAULT '',   -- 添加时的股票名（快照，避免回查）
  created_at TEXT    NOT NULL,
  UNIQUE (user_id, symbol)
);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist (user_id, created_at);

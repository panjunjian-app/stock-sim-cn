-- 0004_contests.sql — 炒炒乐大比拼（多人比赛）
-- 金额一律整数「分」；日期为北京时间 'YYYY-MM-DD'。

-- 用户昵称（邮箱为唯一标识不可改）
ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL DEFAULT '';

-- 比赛账户标记（NULL=普通个人账户；比赛账户复用 trade_accounts，撮合/持仓/快照全继承）
ALTER TABLE trade_accounts ADD COLUMN contest_id INTEGER;

-- 比赛
CREATE TABLE contests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,                    -- 比赛名（1~30 字符）
  creator_id      INTEGER NOT NULL REFERENCES users(id),
  init_cash       INTEGER NOT NULL,                    -- 每人初始资金（分，1万~1000万）
  duration_months INTEGER NOT NULL CHECK (duration_months IN (1, 3, 6, 12)),
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'finished', 'cancelled')),
  start_date      TEXT,                                -- 开始交易日（全员同意当日，非交易日顺延）
  end_date        TEXT,                                -- 结束日 = 开始日 + N 个自然月
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);
CREATE INDEX idx_contests_due ON contests (status, end_date);

-- 比赛参与者 / 邀请
CREATE TABLE contest_participants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id    INTEGER NOT NULL REFERENCES contests(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  role          TEXT    NOT NULL CHECK (role IN ('creator', 'invitee')),
  invite_status TEXT    NOT NULL DEFAULT 'pending'
                CHECK (invite_status IN ('pending', 'accepted', 'declined')),
  account_id    INTEGER,                               -- 开赛后创建的比赛账户
  final_total   INTEGER,                               -- 结束时定格的总资产（分）
  is_winner     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL,
  UNIQUE (contest_id, user_id)
);
CREATE INDEX idx_cp_user ON contest_participants (user_id);

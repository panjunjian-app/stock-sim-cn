-- 0001_init.sql — D1 全量建表
-- 约定：金额一律为整数「分」；时间一律 ISO 8601 UTC 字符串；
--       日期（交易日）为 YYYY-MM-DD（北京时间）。

-- 用户
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,              -- 'pbkdf2$100000$<salt_b64>$<hash_b64>'
  token_version INTEGER NOT NULL DEFAULT 0,     -- 重置密码/封号时 +1，旧 JWT 全失效
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned')),
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

-- 邮箱验证码（每 email+purpose 一行，upsert）
CREATE TABLE email_verifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL,
  purpose      TEXT NOT NULL CHECK (purpose IN ('register','reset')),
  code_hash    TEXT NOT NULL,                   -- SHA-256(6位数字码)
  expires_at   TEXT NOT NULL,                   -- 10 分钟
  attempts     INTEGER NOT NULL DEFAULT 0,      -- 校验失败 >=5 次作废
  verified     INTEGER NOT NULL DEFAULT 0,      -- 1=已通过校验（注册/重置时复查）
  last_sent_at TEXT NOT NULL,                   -- 同邮箱 60s 限发
  day_key      TEXT NOT NULL,                   -- '2026-11-03'（北京时间）
  day_count    INTEGER NOT NULL DEFAULT 1,      -- 单日上限 5 封
  created_at   TEXT NOT NULL,
  UNIQUE (email, purpose)
);
CREATE INDEX idx_ev_day ON email_verifications (day_key);

-- 模拟交易账户
CREATE TABLE trade_accounts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  name           TEXT    NOT NULL,
  cash_available INTEGER NOT NULL DEFAULT 0,    -- 可用资金（分），= 总现金 - 买入冻结
  frozen_cash    INTEGER NOT NULL DEFAULT 0,    -- 在途买单冻结资金（分）
  init_cash      INTEGER NOT NULL,              -- 初始注入（分），账户重置用
  status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at     TEXT    NOT NULL,
  CHECK (init_cash >= 1000 AND init_cash <= 1000000000)  -- 10 元 ~ 1000 万元
);
CREATE INDEX idx_ta_user ON trade_accounts (user_id, status);

-- 委托
CREATE TABLE orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   INTEGER NOT NULL REFERENCES trade_accounts(id),
  user_id      INTEGER NOT NULL,
  symbol       TEXT    NOT NULL,                -- 'sh600519' / 'sz000001'
  symbol_name  TEXT    NOT NULL,
  side         TEXT    NOT NULL CHECK (side IN ('buy','sell')),
  order_type   TEXT    NOT NULL CHECK (order_type IN ('limit','market')),
  price        INTEGER,                         -- 限价（分）；市价为 NULL
  quantity     INTEGER NOT NULL CHECK (quantity > 0 AND quantity % 100 = 0),
  frozen_cash  INTEGER NOT NULL DEFAULT 0,      -- 买单冻结金额（含预估费用，分）
  filled_qty   INTEGER NOT NULL DEFAULT 0,
  avg_price    INTEGER,                         -- 成交均价（分）
  status       TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','partial','filled','cancelled','rejected')),
  reject_reason TEXT,
  last_check_at TEXT,                           -- 上次撮合尝试时间
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_orders_account ON orders (account_id, status, created_at DESC);
CREATE INDEX idx_orders_open   ON orders (account_id) WHERE status IN ('pending','partial');

-- 成交（交割）
CREATE TABLE trades (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id     INTEGER NOT NULL REFERENCES trade_accounts(id),
  order_id       INTEGER NOT NULL REFERENCES orders(id),
  user_id        INTEGER NOT NULL,
  symbol         TEXT    NOT NULL,
  symbol_name    TEXT    NOT NULL,
  side           TEXT    NOT NULL CHECK (side IN ('buy','sell')),
  price          INTEGER NOT NULL,              -- 成交价（分）
  quantity       INTEGER NOT NULL,
  amount         INTEGER NOT NULL,              -- 成交额（分）= price * quantity
  fee_commission INTEGER NOT NULL,              -- 佣金（分）
  fee_stamp      INTEGER NOT NULL,              -- 印花税（分，仅卖出）
  fee_transfer   INTEGER NOT NULL,              -- 过户费（分）
  net_amount     INTEGER NOT NULL,              -- 买: -(amount+三费)；卖: +(amount-三费)
  traded_at      TEXT    NOT NULL
);
CREATE INDEX idx_trades_account ON trades (account_id, traded_at DESC);

-- 持仓（T+1）
CREATE TABLE positions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL REFERENCES trade_accounts(id),
  symbol        TEXT    NOT NULL,
  symbol_name   TEXT    NOT NULL,
  qty           INTEGER NOT NULL DEFAULT 0,     -- 总持仓
  available_qty INTEGER NOT NULL DEFAULT 0,     -- 今日可卖（T+1：买入当日不计入）
  frozen_qty    INTEGER NOT NULL DEFAULT 0,     -- 在途卖单冻结
  avg_cost      INTEGER NOT NULL DEFAULT 0,     -- 摊薄成本（分）
  settled_date  TEXT    NOT NULL DEFAULT '',    -- 最近一次日切日 'YYYY-MM-DD'
  updated_at    TEXT    NOT NULL,
  UNIQUE (account_id, symbol)
);

-- 资金流水
CREATE TABLE cash_flows (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL REFERENCES trade_accounts(id),
  type          TEXT NOT NULL CHECK (type IN ('deposit','buy','sell')),
  amount        INTEGER NOT NULL,               -- 正=入账 负=出账（分，净额含费用）
  balance_after INTEGER NOT NULL,               -- 变动后可用资金（分）
  ref_id        INTEGER,                        -- 关联 trade.id
  remark        TEXT NOT NULL DEFAULT '',       -- 费用明细写入备注
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_cf_account ON cash_flows (account_id, created_at DESC);

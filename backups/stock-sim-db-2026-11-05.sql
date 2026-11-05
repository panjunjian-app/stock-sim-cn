PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,              -- 'pbkdf2$100000$<salt_b64>$<hash_b64>'
  token_version INTEGER NOT NULL DEFAULT 0,     -- 重置密码/封号时 +1，旧 JWT 全失效
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned')),
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
, nickname TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '');
INSERT INTO "users" ("id","email","password_hash","token_version","status","created_at","updated_at","nickname","avatar") VALUES(2,'gzpanjunjian@163.com','pbkdf2$100000$db2IRDCNMgopCS7a2EfYxw==$ooq3gGOHhqLAVNVO29Alj4/djsHvlSNmb4eZM5wxMNg=',0,'active','2026-11-04T01:42:38.605Z','2026-11-05T02:44:13.791Z','俊健','data:image/jpeg;base64,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');
INSERT INTO "users" ("id","email","password_hash","token_version","status","created_at","updated_at","nickname","avatar") VALUES(3,'ktest2-1104@example.com','pbkdf2$100000$XP5c0UWc4rL7/PSce/fQ0A==$X/EphGkE3BTfH4vUlW9PqV8Kqe1aUbk7IRvMa9IvH1g=',0,'active','2026-11-04T03:37:13.283Z','2026-11-04T03:37:13.283Z','','');
INSERT INTO "users" ("id","email","password_hash","token_version","status","created_at","updated_at","nickname","avatar") VALUES(4,'e2e-1104@example.com','pbkdf2$100000$ZQ15G71LhE3OL3gN4q2x5Q==$IJAU1Hb2UD22fzn1cbLX9rZEXvB1n+w9PsL2iUsTfcc=',0,'active','2026-11-04T03:50:28.756Z','2026-11-05T02:11:06.395Z','股神老潘','data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmAA//9k=');
INSERT INTO "users" ("id","email","password_hash","token_version","status","created_at","updated_at","nickname","avatar") VALUES(5,'158386692@qq.com','pbkdf2$100000$UMjwbz51bcd8xT2jV3G3Iw==$nP2sOFd6ES/DtP96ZyhHJH4N/05qgcsL+n5IIHFnGzY=',0,'active','2026-11-04T10:07:02.411Z','2026-11-04T10:07:02.411Z','','');
INSERT INTO "users" ("id","email","password_hash","token_version","status","created_at","updated_at","nickname","avatar") VALUES(6,'38341410@qq.com','pbkdf2$100000$l4akiYsRH2TpW+jqBiL2iQ==$Mgg/Bx9KNZM3Mqe4qVPVjh14N+vlasj83SPv/a1uYIE=',0,'active','2026-11-04T10:08:09.100Z','2026-11-04T10:08:09.100Z','','');
INSERT INTO "users" ("id","email","password_hash","token_version","status","created_at","updated_at","nickname","avatar") VALUES(7,'e2e-1105@example.com','pbkdf2$100000$nIJttgLZ/gvvJtlluC2dPQ==$N1zfo4f4qiYQmdHs5znO/bF4xhyVtR06Jy6/x5WZ3CQ=',0,'active','2026-11-05T01:58:27.788Z','2026-11-05T01:58:29.240Z','挑战者小陈','');
INSERT INTO "users" ("id","email","password_hash","token_version","status","created_at","updated_at","nickname","avatar") VALUES(8,'e2e-1106@example.com','pbkdf2$100000$AfR+aVz4pI2/3W/OS8uKXw==$TFkaZyJusNfQ+EDgX/0a9t8JmViH25bIaZjg+QbyqQw=',0,'active','2026-11-05T02:20:35.510Z','2026-11-05T02:20:35.510Z','','');
INSERT INTO "users" ("id","email","password_hash","token_version","status","created_at","updated_at","nickname","avatar") VALUES(9,'813441109@qq.com','pbkdf2$100000$56fu7rptyKQSJY+109ShbQ==$962G7kEjXQH79FYSX5uVf/VnOMzxds2Eso/twLtTGSo=',0,'active','2026-11-05T02:25:31.207Z','2026-11-05T02:25:31.207Z','','');
INSERT INTO "users" ("id","email","password_hash","token_version","status","created_at","updated_at","nickname","avatar") VALUES(10,'173434173@qq.com','pbkdf2$100000$/nYOAwlWPBJ3ltAkc3Wdvw==$6cfxBWBu/4VtFNZEMcvurFl2AxML6QowNreMOwyPBxI=',0,'active','2026-11-05T02:31:41.368Z','2026-11-05T02:38:52.499Z','樊四少','');
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
INSERT INTO "email_verifications" ("id","email","purpose","code_hash","expires_at","attempts","verified","last_sent_at","day_key","day_count","created_at") VALUES(3,'gzpanjunjian@163.com','register','consumed','2026-11-04T01:52:00.097Z',0,2,'2026-11-04T01:42:00.097Z','2026-11-04',1,'2026-11-04T01:42:00.097Z');
INSERT INTO "email_verifications" ("id","email","purpose","code_hash","expires_at","attempts","verified","last_sent_at","day_key","day_count","created_at") VALUES(4,'ktest-1104@example.com','register','c91cfa334ebc6e7433951914f8abbfa9bbfa17267440e7f83deaad60bf917238','2026-11-04T03:46:46.130Z',0,0,'2026-11-04T03:36:46.130Z','2026-11-04',1,'2026-11-04T03:36:46.130Z');
INSERT INTO "email_verifications" ("id","email","purpose","code_hash","expires_at","attempts","verified","last_sent_at","day_key","day_count","created_at") VALUES(5,'ktest2-1104@example.com','register','consumed','2026-11-04T03:46:59.693Z',0,2,'2026-11-04T03:36:59.693Z','2026-11-04',1,'2026-11-04T03:36:59.693Z');
INSERT INTO "email_verifications" ("id","email","purpose","code_hash","expires_at","attempts","verified","last_sent_at","day_key","day_count","created_at") VALUES(6,'e2e-1104@example.com','register','consumed','2026-11-04T04:00:19.834Z',0,2,'2026-11-04T03:50:19.834Z','2026-11-04',1,'2026-11-04T03:50:19.834Z');
INSERT INTO "email_verifications" ("id","email","purpose","code_hash","expires_at","attempts","verified","last_sent_at","day_key","day_count","created_at") VALUES(7,'38341410@qq.com','register','consumed','2026-11-04T10:16:07.518Z',0,2,'2026-11-04T10:06:07.518Z','2026-11-04',1,'2026-11-04T10:06:07.518Z');
INSERT INTO "email_verifications" ("id","email","purpose","code_hash","expires_at","attempts","verified","last_sent_at","day_key","day_count","created_at") VALUES(8,'158386692@qq.com','register','consumed','2026-11-04T10:16:43.817Z',0,2,'2026-11-04T10:06:43.817Z','2026-11-04',1,'2026-11-04T10:06:43.817Z');
INSERT INTO "email_verifications" ("id","email","purpose","code_hash","expires_at","attempts","verified","last_sent_at","day_key","day_count","created_at") VALUES(9,'e2e-1105@example.com','register','consumed','2026-11-05T02:08:22.871Z',0,2,'2026-11-05T01:58:22.871Z','2026-11-05',2,'2026-11-05T01:56:33.715Z');
INSERT INTO "email_verifications" ("id","email","purpose","code_hash","expires_at","attempts","verified","last_sent_at","day_key","day_count","created_at") VALUES(11,'6360030@qq.com','register','c34aa5bc9e513a6f51bdf958c6594ba520117bc52b4035fb8a3f5c1f67fb115b','2026-11-05T02:14:54.641Z',0,0,'2026-11-05T02:04:54.641Z','2026-11-05',1,'2026-11-05T02:04:54.641Z');
CREATE TABLE trade_accounts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  name           TEXT    NOT NULL,
  cash_available INTEGER NOT NULL DEFAULT 0,    -- 可用资金（分），= 总现金 - 买入冻结
  frozen_cash    INTEGER NOT NULL DEFAULT 0,    -- 在途买单冻结资金（分）
  init_cash      INTEGER NOT NULL,              -- 初始注入（分），账户重置用
  status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at     TEXT    NOT NULL, contest_id INTEGER,
  CHECK (init_cash >= 1000 AND init_cash <= 1000000000)  -- 10 元 ~ 1000 万元
);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(2,2,'长线投资账号',1000000,0,1000000,'active','2026-11-04T03:19:31.670Z',NULL);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(3,5,'Daemon',1000000,0,1000000,'active','2026-11-04T10:07:16.301Z',NULL);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(4,6,'雲落',999092990,0,1000000000,'deleted','2026-11-04T10:08:32.911Z',NULL);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(5,4,'BI测试主账户',1000000,0,1000000,'active','2026-11-05T01:16:04.899Z',NULL);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(6,4,'BI测试副账户',500000,0,500000,'active','2026-11-05T01:16:07.363Z',NULL);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(7,6,'雲落小号',100000,0,100000,'deleted','2026-11-05T01:26:47.987Z',NULL);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(8,4,'比拼·谁是股神·第一弹',99883198,0,100000000,'active','2026-11-05T01:58:41.792Z',1);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(9,7,'比拼·谁是股神·第一弹',100000000,0,100000000,'active','2026-11-05T01:58:41.792Z',1);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(10,6,'雲落',18789,0,1000000,'active','2026-11-05T02:08:58.176Z',NULL);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(11,9,'壮熊',1000000000,0,1000000000,'active','2026-11-05T02:26:02.718Z',NULL);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(12,2,'比拼·IT宅男谁是股王',7339508,0,10000000,'active','2026-11-05T02:37:59.576Z',3);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(13,9,'比拼·IT宅男谁是股王',10000000,0,10000000,'active','2026-11-05T02:37:59.576Z',3);
INSERT INTO "trade_accounts" ("id","user_id","name","cash_available","frozen_cash","init_cash","status","created_at","contest_id") VALUES(14,10,'比拼·IT宅男谁是股王',10000000,0,10000000,'active','2026-11-05T02:37:59.576Z',3);
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
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(1,8,4,'sz000001','平安银行','buy','market',NULL,100,116802,100,1163,'filled',NULL,'2026-11-05T01:59:14.207Z','2026-11-05T01:59:12.561Z','2026-11-05T01:59:14.261Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(2,4,6,'sh601899','紫金矿业','buy','market',NULL,100,298403,100,2979,'filled',NULL,'2026-11-05T02:04:21.630Z','2026-11-05T02:04:21.022Z','2026-11-05T02:04:21.687Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(3,4,6,'sz002185','华天科技','buy','market',NULL,100,154102,100,1536,'filled',NULL,'2026-11-05T02:04:44.312Z','2026-11-05T02:04:43.749Z','2026-11-05T02:04:44.368Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(4,4,6,'sh600900','长江电力','buy','market',NULL,100,289203,100,2887,'filled',NULL,'2026-11-05T02:05:15.052Z','2026-11-05T02:05:14.505Z','2026-11-05T02:05:15.113Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(5,4,6,'sh601398','工商银行','buy','market',NULL,200,165302,200,824,'filled',NULL,'2026-11-05T02:05:32.288Z','2026-11-05T02:05:31.500Z','2026-11-05T02:05:32.343Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(6,10,6,'sh601899','紫金矿业','buy','market',NULL,100,298603,100,2981,'filled',NULL,'2026-11-05T02:09:44.300Z','2026-11-05T02:09:43.790Z','2026-11-05T02:09:44.378Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(7,10,6,'sz002185','华天科技','buy','market',NULL,100,155302,100,1548,'filled',NULL,'2026-11-05T02:09:58.157Z','2026-11-05T02:09:57.640Z','2026-11-05T02:09:58.200Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(8,10,6,'sz002185','华天科技','buy','market',NULL,100,155202,100,1548,'filled',NULL,'2026-11-05T02:10:48.815Z','2026-11-05T02:10:48.305Z','2026-11-05T02:10:48.885Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(9,10,6,'sh600900','长江电力','buy','market',NULL,100,289303,100,2888,'filled',NULL,'2026-11-05T02:11:00.018Z','2026-11-05T02:10:59.494Z','2026-11-05T02:11:00.059Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(10,10,6,'sh601398','工商银行','buy','market',NULL,100,82701,100,822,'filled',NULL,'2026-11-05T02:11:12.972Z','2026-11-05T02:11:12.456Z','2026-11-05T02:11:13.034Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(11,12,2,'sh603986','兆易创新','buy','limit',26588,100,0,0,NULL,'cancelled',NULL,'2026-11-05T02:53:17.165Z','2026-11-05T02:52:31.460Z','2026-11-05T02:53:21.306Z');
INSERT INTO "orders" ("id","account_id","user_id","symbol","symbol_name","side","order_type","price","quantity","frozen_cash","filled_qty","avg_price","status","reject_reason","last_check_at","created_at","updated_at") VALUES(12,12,2,'sh603986','兆易创新','buy','limit',26608,100,2661493,100,26598,'filled',NULL,'2026-11-05T02:53:42.996Z','2026-11-05T02:53:42.452Z','2026-11-05T02:53:43.046Z');
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
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(1,8,1,4,'sz000001','平安银行','buy',1163,100,116300,500,0,2,-116802,'2026-11-05T01:59:14.261Z');
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(2,4,2,6,'sh601899','紫金矿业','buy',2979,100,297900,500,0,3,-298403,'2026-11-05T02:04:21.687Z');
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(3,4,3,6,'sz002185','华天科技','buy',1536,100,153600,500,0,2,-154102,'2026-11-05T02:04:44.368Z');
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(4,4,4,6,'sh600900','长江电力','buy',2887,100,288700,500,0,3,-289203,'2026-11-05T02:05:15.113Z');
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(5,4,5,6,'sh601398','工商银行','buy',824,200,164800,500,0,2,-165302,'2026-11-05T02:05:32.343Z');
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(6,10,6,6,'sh601899','紫金矿业','buy',2981,100,298100,500,0,3,-298603,'2026-11-05T02:09:44.378Z');
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(7,10,7,6,'sz002185','华天科技','buy',1548,100,154800,500,0,2,-155302,'2026-11-05T02:09:58.200Z');
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(8,10,8,6,'sz002185','华天科技','buy',1548,100,154800,500,0,2,-155302,'2026-11-05T02:10:48.885Z');
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(9,10,9,6,'sh600900','长江电力','buy',2888,100,288800,500,0,3,-289303,'2026-11-05T02:11:00.059Z');
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(10,10,10,6,'sh601398','工商银行','buy',822,100,82200,500,0,1,-82701,'2026-11-05T02:11:13.034Z');
INSERT INTO "trades" ("id","account_id","order_id","user_id","symbol","symbol_name","side","price","quantity","amount","fee_commission","fee_stamp","fee_transfer","net_amount","traded_at") VALUES(11,12,12,2,'sh603986','兆易创新','buy',26598,100,2659800,665,0,27,-2660492,'2026-11-05T02:53:43.046Z');
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
INSERT INTO "positions" ("id","account_id","symbol","symbol_name","qty","available_qty","frozen_qty","avg_cost","settled_date","updated_at") VALUES(1,8,'sz000001','平安银行',100,0,0,1168,'','2026-11-05T01:59:14.349Z');
INSERT INTO "positions" ("id","account_id","symbol","symbol_name","qty","available_qty","frozen_qty","avg_cost","settled_date","updated_at") VALUES(2,4,'sh601899','紫金矿业',100,100,0,2984,'2026-11-05','2026-11-05T02:04:25.220Z');
INSERT INTO "positions" ("id","account_id","symbol","symbol_name","qty","available_qty","frozen_qty","avg_cost","settled_date","updated_at") VALUES(4,4,'sz002185','华天科技',100,100,0,1541,'2026-11-05','2026-11-05T02:04:45.879Z');
INSERT INTO "positions" ("id","account_id","symbol","symbol_name","qty","available_qty","frozen_qty","avg_cost","settled_date","updated_at") VALUES(6,4,'sh600900','长江电力',100,100,0,2892,'2026-11-05','2026-11-05T02:05:15.827Z');
INSERT INTO "positions" ("id","account_id","symbol","symbol_name","qty","available_qty","frozen_qty","avg_cost","settled_date","updated_at") VALUES(8,4,'sh601398','工商银行',200,200,0,827,'2026-11-05','2026-11-05T02:05:35.888Z');
INSERT INTO "positions" ("id","account_id","symbol","symbol_name","qty","available_qty","frozen_qty","avg_cost","settled_date","updated_at") VALUES(10,10,'sh601899','紫金矿业',100,100,0,2986,'2026-11-05','2026-11-05T02:09:47.102Z');
INSERT INTO "positions" ("id","account_id","symbol","symbol_name","qty","available_qty","frozen_qty","avg_cost","settled_date","updated_at") VALUES(12,10,'sz002185','华天科技',200,100,0,1553,'2026-11-05','2026-11-05T02:10:48.981Z');
INSERT INTO "positions" ("id","account_id","symbol","symbol_name","qty","available_qty","frozen_qty","avg_cost","settled_date","updated_at") VALUES(15,10,'sh600900','长江电力',100,100,0,2893,'2026-11-05','2026-11-05T02:11:02.679Z');
INSERT INTO "positions" ("id","account_id","symbol","symbol_name","qty","available_qty","frozen_qty","avg_cost","settled_date","updated_at") VALUES(17,10,'sh601398','工商银行',100,100,0,827,'2026-11-05','2026-11-05T02:11:17.093Z');
INSERT INTO "positions" ("id","account_id","symbol","symbol_name","qty","available_qty","frozen_qty","avg_cost","settled_date","updated_at") VALUES(19,12,'sh603986','兆易创新',100,100,0,26605,'2026-11-05','2026-11-05T02:53:46.073Z');
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
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(2,2,'deposit',1000000,1000000,NULL,'开户注入初始资金','2026-11-04T03:19:31.670Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(3,3,'deposit',1000000,1000000,NULL,'开户注入初始资金','2026-11-04T10:07:16.301Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(4,4,'deposit',1000000000,1000000000,NULL,'开户注入初始资金','2026-11-04T10:08:32.911Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(5,5,'deposit',1000000,1000000,NULL,'开户注入初始资金','2026-11-05T01:16:04.899Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(6,6,'deposit',500000,500000,NULL,'开户注入初始资金','2026-11-05T01:16:07.363Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(7,7,'deposit',100000,100000,NULL,'开户注入初始资金','2026-11-05T01:26:47.987Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(8,8,'deposit',100000000,100000000,NULL,'比赛账户初始资金','2026-11-05T01:58:41.792Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(9,9,'deposit',100000000,100000000,NULL,'比赛账户初始资金','2026-11-05T01:58:41.792Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(10,8,'buy',-116802,99883198,1,'买入 平安银行 100股 @11.63 佣金5.00 过户费0.02','2026-11-05T01:59:14.261Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(11,4,'buy',-298403,999701597,2,'买入 紫金矿业 100股 @29.79 佣金5.00 过户费0.03','2026-11-05T02:04:21.687Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(12,4,'buy',-154102,999547495,3,'买入 华天科技 100股 @15.36 佣金5.00 过户费0.02','2026-11-05T02:04:44.368Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(13,4,'buy',-289203,999258292,4,'买入 长江电力 100股 @28.87 佣金5.00 过户费0.03','2026-11-05T02:05:15.113Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(14,4,'buy',-165302,999092990,5,'买入 工商银行 200股 @8.24 佣金5.00 过户费0.02','2026-11-05T02:05:32.343Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(15,10,'deposit',1000000,1000000,NULL,'开户注入初始资金','2026-11-05T02:08:58.176Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(16,10,'buy',-298603,701397,6,'买入 紫金矿业 100股 @29.81 佣金5.00 过户费0.03','2026-11-05T02:09:44.378Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(17,10,'buy',-155302,546095,7,'买入 华天科技 100股 @15.48 佣金5.00 过户费0.02','2026-11-05T02:09:58.200Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(18,10,'buy',-155302,390793,8,'买入 华天科技 100股 @15.48 佣金5.00 过户费0.02','2026-11-05T02:10:48.885Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(19,10,'buy',-289303,101490,9,'买入 长江电力 100股 @28.88 佣金5.00 过户费0.03','2026-11-05T02:11:00.059Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(20,10,'buy',-82701,18789,10,'买入 工商银行 100股 @8.22 佣金5.00 过户费0.01','2026-11-05T02:11:13.034Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(21,11,'deposit',1000000000,1000000000,NULL,'开户注入初始资金','2026-11-05T02:26:02.718Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(22,12,'deposit',10000000,10000000,NULL,'比赛账户初始资金','2026-11-05T02:37:59.576Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(23,13,'deposit',10000000,10000000,NULL,'比赛账户初始资金','2026-11-05T02:37:59.576Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(24,14,'deposit',10000000,10000000,NULL,'比赛账户初始资金','2026-11-05T02:37:59.576Z');
INSERT INTO "cash_flows" ("id","account_id","type","amount","balance_after","ref_id","remark","created_at") VALUES(25,12,'buy',-2660492,7339508,11,'买入 兆易创新 100股 @265.98 佣金6.65 过户费0.27','2026-11-05T02:53:43.046Z');
CREATE TABLE watchlist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  symbol     TEXT    NOT NULL,              -- sh600519 / sz300308
  name       TEXT    NOT NULL DEFAULT '',   -- 添加时的股票名（快照，避免回查）
  created_at TEXT    NOT NULL,
  UNIQUE (user_id, symbol)
);
INSERT INTO "watchlist" ("id","user_id","symbol","name","created_at") VALUES(3,2,'sz300308','中际旭创','2026-11-04T10:02:25.508Z');
INSERT INTO "watchlist" ("id","user_id","symbol","name","created_at") VALUES(4,6,'sh601899','紫金矿业','2026-11-05T02:03:20.373Z');
INSERT INTO "watchlist" ("id","user_id","symbol","name","created_at") VALUES(5,6,'sz002185','华天科技','2026-11-05T02:04:34.804Z');
INSERT INTO "watchlist" ("id","user_id","symbol","name","created_at") VALUES(6,6,'sh600900','长江电力','2026-11-05T02:05:07.542Z');
INSERT INTO "watchlist" ("id","user_id","symbol","name","created_at") VALUES(7,6,'sh601398','工商银行','2026-11-05T02:05:24.032Z');
INSERT INTO "watchlist" ("id","user_id","symbol","name","created_at") VALUES(8,2,'sh603986','兆易创新','2026-11-05T02:39:41.064Z');
CREATE TABLE daily_snapshots (
  user_id        INTEGER NOT NULL,
  account_id     INTEGER NOT NULL REFERENCES trade_accounts(id),
  date           TEXT    NOT NULL,              -- 东八区交易日 'YYYY-MM-DD'
  total_assets   INTEGER NOT NULL,              -- 分 = cash(含冻结) + 持仓市值
  cash           INTEGER NOT NULL,              -- 分 = cash_available + frozen_cash
  market_value   INTEGER NOT NULL,              -- 分
  day_pnl        INTEGER NOT NULL DEFAULT 0,    -- 分 = 当日资产 − 上一交易日快照资产
  snapshotted_at TEXT    NOT NULL,              -- ISO UTC，收盘覆盖时更新
  PRIMARY KEY (user_id, account_id, date)
);
INSERT INTO "daily_snapshots" ("user_id","account_id","date","total_assets","cash","market_value","day_pnl","snapshotted_at") VALUES(4,5,'2026-11-05',1000000,1000000,0,0,'2026-11-05T01:16:10.500Z');
INSERT INTO "daily_snapshots" ("user_id","account_id","date","total_assets","cash","market_value","day_pnl","snapshotted_at") VALUES(4,6,'2026-11-05',500000,500000,0,0,'2026-11-05T01:16:10.500Z');
INSERT INTO "daily_snapshots" ("user_id","account_id","date","total_assets","cash","market_value","day_pnl","snapshotted_at") VALUES(2,2,'2026-11-05',1000000,1000000,0,0,'2026-11-05T01:18:47.154Z');
INSERT INTO "daily_snapshots" ("user_id","account_id","date","total_assets","cash","market_value","day_pnl","snapshotted_at") VALUES(6,4,'2026-11-05',1000000000,1000000000,0,0,'2026-11-05T02:02:38.705Z');
INSERT INTO "daily_snapshots" ("user_id","account_id","date","total_assets","cash","market_value","day_pnl","snapshotted_at") VALUES(6,7,'2026-11-05',100000,100000,0,0,'2026-11-05T02:02:38.705Z');
INSERT INTO "daily_snapshots" ("user_id","account_id","date","total_assets","cash","market_value","day_pnl","snapshotted_at") VALUES(6,10,'2026-11-05',1000000,1000000,0,0,'2026-11-05T02:09:38.698Z');
INSERT INTO "daily_snapshots" ("user_id","account_id","date","total_assets","cash","market_value","day_pnl","snapshotted_at") VALUES(9,11,'2026-11-05',1000000000,1000000000,0,0,'2026-11-05T02:36:31.287Z');
INSERT INTO "daily_snapshots" ("user_id","account_id","date","total_assets","cash","market_value","day_pnl","snapshotted_at") VALUES(10,14,'2026-11-05',10000000,10000000,0,0,'2026-11-05T02:38:41.757Z');
INSERT INTO "daily_snapshots" ("user_id","account_id","date","total_assets","cash","market_value","day_pnl","snapshotted_at") VALUES(2,12,'2026-11-05',10000000,10000000,0,0,'2026-11-05T02:38:44.834Z');
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
INSERT INTO "contests" ("id","name","creator_id","init_cash","duration_months","status","start_date","end_date","created_at","updated_at") VALUES(1,'谁是股神·第一弹',4,100000000,1,'active','2026-11-05','2026-12-05','2026-11-05T01:58:39.678Z','2026-11-05T01:58:41.792Z');
INSERT INTO "contests" ("id","name","creator_id","init_cash","duration_months","status","start_date","end_date","created_at","updated_at") VALUES(2,'谁是大赢家',2,1000000,1,'pending',NULL,NULL,'2026-11-05T02:28:32.562Z','2026-11-05T02:28:32.562Z');
INSERT INTO "contests" ("id","name","creator_id","init_cash","duration_months","status","start_date","end_date","created_at","updated_at") VALUES(3,'IT宅男谁是股王',2,10000000,1,'active','2026-11-05','2026-12-05','2026-11-05T02:35:36.544Z','2026-11-05T02:37:59.576Z');
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
INSERT INTO "contest_participants" ("id","contest_id","user_id","role","invite_status","account_id","final_total","is_winner","created_at") VALUES(1,1,4,'creator','accepted',8,NULL,0,'2026-11-05T01:58:39.678Z');
INSERT INTO "contest_participants" ("id","contest_id","user_id","role","invite_status","account_id","final_total","is_winner","created_at") VALUES(2,1,7,'invitee','accepted',9,NULL,0,'2026-11-05T01:58:39.678Z');
INSERT INTO "contest_participants" ("id","contest_id","user_id","role","invite_status","account_id","final_total","is_winner","created_at") VALUES(3,2,2,'creator','accepted',NULL,NULL,0,'2026-11-05T02:28:32.562Z');
INSERT INTO "contest_participants" ("id","contest_id","user_id","role","invite_status","account_id","final_total","is_winner","created_at") VALUES(4,2,5,'invitee','pending',NULL,NULL,0,'2026-11-05T02:28:32.562Z');
INSERT INTO "contest_participants" ("id","contest_id","user_id","role","invite_status","account_id","final_total","is_winner","created_at") VALUES(5,2,6,'invitee','accepted',NULL,NULL,0,'2026-11-05T02:28:32.562Z');
INSERT INTO "contest_participants" ("id","contest_id","user_id","role","invite_status","account_id","final_total","is_winner","created_at") VALUES(6,3,2,'creator','accepted',12,NULL,0,'2026-11-05T02:35:36.544Z');
INSERT INTO "contest_participants" ("id","contest_id","user_id","role","invite_status","account_id","final_total","is_winner","created_at") VALUES(7,3,9,'invitee','accepted',13,NULL,0,'2026-11-05T02:35:36.544Z');
INSERT INTO "contest_participants" ("id","contest_id","user_id","role","invite_status","account_id","final_total","is_winner","created_at") VALUES(8,3,10,'invitee','accepted',14,NULL,0,'2026-11-05T02:35:36.544Z');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('email_verifications',11);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('users',10);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('trade_accounts',14);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('cash_flows',25);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('watchlist',8);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('contests',3);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('contest_participants',8);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('orders',12);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('trades',11);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('positions',20);
CREATE INDEX idx_ev_day ON email_verifications (day_key);
CREATE INDEX idx_ta_user ON trade_accounts (user_id, status);
CREATE INDEX idx_orders_account ON orders (account_id, status, created_at DESC);
CREATE INDEX idx_orders_open   ON orders (account_id) WHERE status IN ('pending','partial');
CREATE INDEX idx_trades_account ON trades (account_id, traded_at DESC);
CREATE INDEX idx_cf_account ON cash_flows (account_id, created_at DESC);
CREATE INDEX idx_watchlist_user ON watchlist (user_id, created_at);
CREATE INDEX idx_ds_user_date ON daily_snapshots (user_id, date);
CREATE INDEX idx_contests_due ON contests (status, end_date);
CREATE INDEX idx_cp_user ON contest_participants (user_id);

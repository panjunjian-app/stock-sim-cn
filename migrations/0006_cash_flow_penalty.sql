-- 0006_cash_flow_penalty.sql — 流水类型扩展：游手好闲费（penalty）
-- SQLite 无法 ALTER CHECK 约束，需重建表（batch 事务内执行，先全量拷贝再替换）。
-- 数据安全：执行前已有全量备份（backups/）。

CREATE TABLE cash_flows_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL REFERENCES trade_accounts(id),
  type          TEXT NOT NULL CHECK (type IN ('deposit','buy','sell','penalty')),
  amount        INTEGER NOT NULL,               -- 正=入账 负=出账（分，净额含费用）
  balance_after INTEGER NOT NULL,               -- 变动后可用资金（分）
  ref_id        INTEGER,                        -- 关联单据 id
  remark        TEXT NOT NULL DEFAULT '',       -- 明细备注（penalty 记录扣费日期，作幂等键）
  created_at    TEXT NOT NULL
);

INSERT INTO cash_flows_new (id, account_id, type, amount, balance_after, ref_id, remark, created_at)
  SELECT id, account_id, type, amount, balance_after, ref_id, remark, created_at FROM cash_flows;

DROP TABLE cash_flows;

ALTER TABLE cash_flows_new RENAME TO cash_flows;

CREATE INDEX idx_cf_account ON cash_flows (account_id, created_at DESC);

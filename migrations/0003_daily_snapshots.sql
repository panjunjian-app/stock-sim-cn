-- 0003_daily_snapshots.sql — BI 报表：账户每日资产快照
-- 约定：金额一律整数「分」；date 为东八区交易日 'YYYY-MM-DD'；
--       每用户每账户每日一行（幂等 upsert，收盘 15:05 后允许覆盖一次）。

CREATE TABLE IF NOT EXISTS daily_snapshots (
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
CREATE INDEX IF NOT EXISTS idx_ds_user_date ON daily_snapshots (user_id, date);

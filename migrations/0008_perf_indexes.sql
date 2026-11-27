-- 0008_perf_indexes.sql — 性能索引（修复 D1 rows_read 打满免费额度）
--
-- 背景：2026-11-27 收到 Cloudflare「D1 operations are nearing the daily cap」告警，
--       rows_read 达 76%（约 380 万 / 500 万）。wrangler d1 insights 定位到两条高频全表扫描：
--   1) SELECT day_pnl FROM daily_snapshots WHERE account_id = ?1 ORDER BY date DESC LIMIT 1
--      —— 12,530 次 / 平均扫 199 行 / 合计 2,557,683 行（占总读取 73%）。
--      daily_snapshots 主键为 (user_id, account_id, date)，另有 idx_ds_user_date(user_id, date)，
--      两者都无法服务「只按 account_id 过滤 + 按 date 排序」→ EXPLAIN 显示
--      SCAN daily_snapshots + USE TEMP B-TREE FOR ORDER BY。
--   2) 游手好闲费幂等检查（GET /api/contests 每 30s 触发）
--      —— SELECT remark FROM cash_flows WHERE account_id=? AND type='penalty' 等，
--      idx_cf_account 只定位到 account_id，仍要扫该账户全部流水。
--
-- 说明：两处均为纯新增索引，不改表结构、不动数据，可随时 DROP INDEX 回退。

-- 比赛排名取当日盈亏：按账户 + 日期倒序，直接命中索引，LIMIT 1 只读 1 行
CREATE INDEX IF NOT EXISTS idx_ds_account_date
  ON daily_snapshots (account_id, date);

-- 游手好闲费幂等判重：按账户 + 费用类型 + 备注日期定位
CREATE INDEX IF NOT EXISTS idx_cf_penalty
  ON cash_flows (account_id, type, remark);

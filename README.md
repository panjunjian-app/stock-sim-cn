# 炒炒乐 · A股模拟盘（stock-sim-cn）

> **纯模拟的 A 股炒股练习网页游戏** — 零真实资金交易、零开发资金投入。
> 游戏名：**炒炒乐** ｜ 线上地址：**https://stock-sim-cn.pages.dev**

> ⚠️ **模拟盘 · 虚拟资金 · 与真实财产无关 · 仅供学习娱乐**
> 全站不接入任何支付/充值/提现通道，所有资金均为虚拟数字，行情与成交仅供学习娱乐，不构成投资建议。

## 项目简介

一个尽可能还原真实券商体验的 A 股模拟交易网站：像用雪球/同花顺一样看盘、下单、查持仓与交割单，但**完全不涉及真实金钱交易**。UI 采用 MUJI 无印良品式的极简风格（纸感底色、极细字重、深红点缀、直角细线框），涨跌配色遵循中国习惯（**红涨绿跌**）。

## 功能清单

**账号体系**
- 邮箱注册 + 6 位数字验证码（服务端哈希存储、10 分钟有效、60 秒限发、单日 5 封、用后即焚防重放）
- 复杂密码策略：必须含大写字母 + 小写字母 + 数字 + 标点符号，两次输入双重确认
- 登录 / 忘记密码（重置后旧登录凭证全部失效）/ JWT + httpOnly Secure Cookie

**模拟交易账户**
- 每个用户最多 5 个独立交易账户，开户时**自行输入初始资金：10 元 ~ 1000 万元**（人民币，即时校验）
- 资产总览（总资产/可用资金/持仓市值/当日盈亏/累计盈亏）
- 持仓、委托、成交、资金流水四张明细表，含佣金/印花税/过户费逐笔明细

**看盘与交易**
- 股票搜索与自选列表、实时报价（最新价/涨跌幅/开高低收/成交量额）
- 分时图（自绘 SVG）+ 日K/周K/月K（klinecharts v9）+ 成交量副图 + 均线
- 限价单 / 市价单、撤单、委托状态（待成交/已成交/已废单）
- 严格还原 A 股规则：**T+1**、涨跌停 ±10%（ST ±5%）、100 股整手、真实费率（佣金万 2.5 最低 5 元 / 印花税卖出 0.05% / 过户费 0.001%）
- 严格遵循交易日历：周末与 2026 年法定节假日休市，仅 9:30–11:30 / 13:00–15:00 连续竞价时段可委托；非交易时段显示休市横幅
- 撮合引擎「下单即刻撮合 + 5 秒行情轮询 tick 重试」，金额全链路以整数「分」存储，避免浮点误差

## 技术栈（全部开源 / 永久免费，零成本）

| 层 | 选型 |
|---|---|
| 前端 | Vite 5 + React 18 + TypeScript 5 + MUI v5 + Tailwind CSS 3（关闭 preflight，与 MUI 共存） |
| 图表 | klinecharts v9（Apache-2.0）+ 自绘 SVG 分时 |
| 状态/路由 | Zustand + react-router v6 |
| 后端 | Cloudflare Pages Functions（文件路由式 REST API，Workers 原生运行时） |
| 数据库 | Cloudflare D1（SQLite） |
| 认证 | jose JWT HS256 + PBKDF2-SHA256 密码哈希（WebCrypto） |
| 行情 | 腾讯 / 新浪免费公开接口（服务端代理绕 CORS，主备切换，失败降级保留最后快照） |
| 邮件 | Resend Hobby 永久免费版（REST，无 SDK） |
| 部署 | Cloudflare Pages + D1；代码托管 GitHub |

环境变量：`JWT_SECRET`（≥32 字节）、`RESEND_API_KEY`、`EMAIL_FROM`、D1 绑定 `DB`。

> **开箱体验**：未配置 `RESEND_API_KEY` 时，注册/找回密码页点击「发送验证码」后验证码会自动填入输入框（页面标注「开发模式」），无需邮件服务即可完整体验。配置 Resend 后自动切换为真实邮件发送。

## 目录结构

```
shared/      前后端共享纯 TS（类型 / 交易日历 / 费率 / 金额 / 校验）——交易规则单处定义
functions/   Pages Functions 后端（lib/ 公共逻辑 + api/ 端点）
src/         React SPA（pages / components / services / store / hooks）
migrations/  D1 建表迁移（7 张表）
tests/       vitest 单元测试（费率 / 交易日历 / 撮合 / 校验 / 金额，104 例全绿）
```

## 本地开发

```bash
npm install
cp .env.example .dev.vars      # 填入 JWT_SECRET / RESEND_API_KEY / EMAIL_FROM
npm run dev                    # http://localhost:5173
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
```

## 部署（Cloudflare Pages，已完成）

1. `npx wrangler d1 create stock-sim-db` → 将 `database_id` 填入 `wrangler.toml`
2. `npx wrangler d1 execute stock-sim-db --remote --file migrations/0001_init.sql` 建表
3. `npx wrangler pages project create stock-sim-cn` 创建 Pages 项目
4. `npx wrangler pages secret put JWT_SECRET` 配置密钥
5. `npx wrangler pages deploy dist --branch main` 部署（前端 + Functions 同源）

## 测试与质量

- `tsc --noEmit`：0 错误
- `vitest run`：**104 / 104 通过**（费用公式、交易日历、撮合引擎、参数校验、金额换算）
- 已经过完整线上冒烟：鉴权 → 发码 → 验码 → 注册 → 开户 → 实时行情 → K线 → 休市拦截

## 文档

- PRD：`deliverables/模拟炒股游戏-PRD-v1.0.md`
- 架构设计：`deliverables/模拟炒股游戏-架构设计-v1.0.md`
- UI 设计稿（MUJI 版定稿）：`deliverables/模拟炒股游戏-UI设计稿-v2.0-muji.html`

## 合规声明

本平台所有资金、行情与成交数据均为虚构模拟，不构成任何投资建议。投资有风险，入市需谨慎。

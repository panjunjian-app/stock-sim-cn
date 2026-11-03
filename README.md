# 模拟炒股 · A股模拟盘（stock-sim-cn）

纯模拟的 A 股炒股练习平台：邮箱注册登录、多模拟交易账户、实时看盘与虚拟撮合。**零真实资金、零开发成本。**

> ⚠️ 模拟盘 · 虚拟资金 · 与真实财产无关 · 仅供学习娱乐

## 技术栈

- 前端：Vite 5 + React 18 + TypeScript 5 + MUI v5 + Tailwind CSS 3（关闭 preflight，与 MUI 共存）
- 图表：klinecharts v9（日/周/月K）+ 自绘 SVG 分时图
- 后端：Cloudflare Pages Functions（文件路由式 REST API）
- 数据库：Cloudflare D1（SQLite）
- 认证：JWT（jose，HS256）+ httpOnly Secure Cookie，7 天有效
- 邮件：Resend Hobby 免费版（fetch REST，无 SDK）

## 本地开发

```bash
npm install
cp .env.example .dev.vars          # 填入 JWT_SECRET / RESEND_API_KEY / EMAIL_FROM
npm run d1:migrate:local           # 初始化本地 D1（wrangler 自动建本地库）
npm run dev                        # http://localhost:5173
```

> 本地未配置 RESEND_API_KEY 时，验证码会打印到 `wrangler pages dev` 的控制台，便于联调。

## 部署（Cloudflare Pages）

1. 推送至 GitHub，在 Cloudflare Pages 连接仓库（框架预设 Vite，输出目录 `dist`）。
2. `npx wrangler d1 create stock-sim-db`，将返回的 `database_id` 填入 `wrangler.toml`。
3. 在 Pages 项目 Settings → Environment variables 配置 `JWT_SECRET`、`RESEND_API_KEY`、`EMAIL_FROM`（生产 + 预览）。
4. `npm run d1:migrate:remote` 应用建表迁移。
5. 部署完成后即同源提供 `/api/*` 与静态页面。

## 目录结构

- `shared/` 前后端共享纯 TS 模块（类型/交易日历/费率/金额/校验）——交易规则单处定义
- `functions/` Pages Functions 后端（`lib/` 公共逻辑 + `api/` 端点）
- `src/` React SPA（pages / components / services / store / hooks）
- `migrations/` D1 建表迁移
- `tests/` vitest 单测（费率/撮合/交易日历）

## 合规声明

本平台所有资金、行情与成交数据均为虚构模拟，不构成任何投资建议。投资有风险，入市需谨慎。

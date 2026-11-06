# 炒炒乐移动端支持 — 增量 PRD（仅变更部分）

> 版本 v1.0 · 产品：许清楚 · 状态：待对齐
> 结论先行：**单域名、同一构建、同一套数据库与 API**。路由层按屏幕宽度（<768px）自动切换到全新开发的移动版布局与页面组件，现有 PC 页面组件**零改动**。共享 `src/services/`、`src/store/`、`shared/types`、登录态（sim_token cookie）。

## 一、架构与实现原则（基于主理人已定决策）

1. **判定方式**：`useIsMobile()` hook（`matchMedia('(max-width: 767px)')` + resize 监听），在 `src/router.tsx` 的 `<RequireAuth>`/页面路由处按宽度渲染 `PC 版组件` 或 `M 版组件`（同一路径，如 `/trade/:symbol` → PC `MarketPage` / 移动 `MarketMobilePage`）。窄屏拉宽浏览器窗口可即时切回 PC 版，无 maintenance 双地址。
2. **代码隔离**：所有移动组件放 `src/mobile/` 目录（`src/mobile/pages/`、`src/mobile/components/`、`src/mobile/layouts/MobileLayout.tsx`），PC 端 `src/pages/`、`src/components/`、`src/layouts/AppLayout.tsx` 不动。
3. **复用层**：`services/*`（auth-api、account-api、market-api、watchlist-api、contest-api、bi-api、http）、`store/*`（auth-store、quote-store）、`hooks/use-quote-polling`、`use-snapshot-heartbeat`、`theme/muji-theme`（移动端沿用 MUJI 视觉变量，红涨绿跌、模拟盘横幅样式一致）。
4. **零成本红线**：无付费依赖；图表组件（K线 klinecharts、分时 SVG、BI 图表）直接复用现有组件，仅外层容器适配竖屏。
5. **认证**：沿用 JWT cookie，与 PC 完全同域同库，手机登录后 PC 端登录态互通。

## 二、移动端页面清单（10 个）

| # | 页面 | 对应 PC 页面 | 优先级 |
|---|------|-------------|--------|
| M1 | 登录 / 注册 / 忘记密码 | LoginPage / RegisterPage / ForgotPasswordPage | P0 |
| M2 | 分析报告首页（BI 报表） | DashboardPage + dashboard/* 组件 | P0 |
| M3 | 行情 / 个股详情（搜索、自选、图表、新闻） | MarketPage（/market、/trade/:symbol） | P0 |
| M4 | 下单页（买入 / 卖出） | OrderPanel + OrderConfirmDialog | P0 |
| M5 | 我的账户列表 | AccountListPage（含开户 OpenAccountDialog） | P0 |
| M6 | 账户详情（持仓/委托/成交/流水） | AccountDetailPage（含撤单、快捷下单） | P0 |
| M7 | 大比拼（列表/排行/发起挑战/邀请收件箱/取消） | ContestsPage + contest/* | P1 |
| M8 | 站内消息 | MessageBell → 移动端消息列表页 | P1 |
| M9 | 个人中心（改密/改昵称头像/退出/免责声明） | AccountSettingsDialog 独立成页 | P1 |
| M10 | 全局：模拟盘横幅 + 底部 Tab 框架 | AppLayout → MobileLayout | P0 |

### 各页交互要点

- **M10 MobileLayout（全局框架）**：顶部保留红色「模拟盘」横幅（压缩至 24px）；**底部 Tab 导航 5 项**：`报告`（/dashboard）、`行情`（/market）、`账户`（/accounts）、`大比拼`（/contests）、`我的`（/me）。Tab 高度 ≥52px，图标+文字；消息入口放「我的」页 + Tab badge。内容区独立滚动，页面切换保持滚动位置可选（P2）。
- **M1 登录/注册/忘记密码**：单列竖排表单，输入框高度 ≥48px，键盘类型正确（邮箱 email、密码带显隐切换）；登录/注册按钮全宽 ≥48px；注册成功/失败提示用 MUI Snackbar 而非 hover tooltip。
- **M2 BI 报表**：竖屏卡片流自上而下：账户维度 + 时间范围选择器（横向滚动 Segmented）→ KPI 卡片 2 列网格（A1–A4/B3 等，每张卡 ≥150px 高）→ 净值曲线（全宽，高度 220px，支持 touch 十字准线）→ 每日盈亏柱 → 持仓对比表转**卡片列表** → 个股盈亏 TOP 条形。表格类（成本 vs 现价）转卡片：股票名/成本/现价/盈亏% 上下两行布局。
- **M3 行情/个股**：PC 三栏拆为两级：**列表页**（搜索框置顶 + 「大盘推荐/我的自选」Tab + 股票卡片列表，卡片含名称/现价/涨跌%/涨跌额，整卡可点 ≥48px 行高；自选删除按钮常显不依赖 hover）→ 点股票进**个股详情页**（QuoteHeader + 分时/日K/周K/月K Tab + 加自选按钮 + 新闻流 + 底部固定「买入/卖出」双按钮条，点击进 M4）。下拉刷新：P0 先用轮询（复用 use-quote-polling）+ 顶部手动刷新按钮，**下拉刷新手势 P1**。
- **M4 下单页**：全屏表单而非侧栏面板：股票信息头 + 账户选择下拉 + 买/卖 Segmented + 价格/数量输入（数字键盘 `inputMode="decimal"`）+ 可用资金/可卖股数提示 + 市值与费用预估 + 全宽「确认下单」按钮（≥48px，二次确认弹窗复用 OrderConfirmDialog 逻辑）；废单原因（资金不足/涨跌停越界）顶部 Snackbar 展示。触发区：个股详情底部按钮条、持仓卡片「快捷交易」按钮。
- **M5 账户列表**：账户表格 → **账户卡片**（账户名/类型/总资产/今日盈亏/收益率，点击进详情，卡内「设置」图标进账户设置）；底部固定「+ 开立新账户」全宽按钮（OpenAccountDialog 逻辑复用，改全屏 Dialog）。
- **M6 账户详情**：顶部资产总览条（总资产/现金/市值/今日盈亏 2×2 网格）+ 四 Tab（持仓/委托/成交/流水，MUI Tabs 可横向滚动）。持仓表→**持仓卡片**（名称代码/成本 vs 现价/持仓量/盈亏额盈亏%/「交易」「一键清仓」按钮常显）；委托列表每条带「撤单」按钮（≥44px，二次确认）；成交/流水 → 时间线列表卡片（日期分组头）。轮询复用 PC 逻辑（含 tick 撮合驱动）。
- **M7 大比拼**：规则说明折叠条；「发起挑战」「邀请收件箱（badge）」两个按钮置顶；比赛卡片纵向排列（进行中 x/3、历史），排行表（排名/昵称/总资产/收益率）保留表格但横向紧凑 + 30s 自动刷新；发起人取消比赛走底部弹层二次确认。邀请弹窗改全屏 Dialog。
- **M8 消息**：MessageBell 下拉 → 独立列表页，消息卡片（标题/时间/已读态），点击标记已读。
- **M9 个人中心**：头像昵称卡 + 功能列表行（账号设置/改密、消息、退出登录、免责声明全文、版本号），行高 ≥52px。

### 全局交互规范

- 触控目标一律 **≥44×44px**（MUI 组件统一加大 padding 覆写）。
- **零 hover 依赖**：PC 端依赖 hover 显示的操作（自选删除 ×、行内菜单）在移动端全部常显或改为长按/点击展开。
- viewport meta：`width=device-width, initial-scale=1, user-scalable=no`（防输入聚焦缩放）；禁止 300ms click 延迟（现代浏览器已默认消除）。
- 表单键盘：下单/登录页设置正确 `inputMode`/`autoComplete`。
- 性能：移动端路由组件 lazy 加载（React.lazy + Suspense），行情轮询频率与 PC 一致（免费源限制不变）。

## 三、现有 PC 端功能对照与移动端优先级

| PC 功能（代码出处） | 移动端 | 优先级 |
|---|---|---|
| 登录/注册/忘记密码（pages/Login、Register、ForgotPassword） | M1 | **P0** |
| BI 报表首页：账户维度/时间范围/KPI 卡/净值曲线/每日盈亏/持仓对比/集中度/个股归因（DashboardPage + dashboard/*） | M2 全量图表 | **P0** |
| 行情看盘：股票搜索、大盘推荐/我的自选、分时/K线、加自选、个股新闻（MarketPage） | M3（两级页面） | **P0** |
| 下单：买入/卖出、账户切换、废单提示（OrderPanel/OrderConfirmDialog） | M4 | **P0** |
| 账户列表/开户/账户设置（AccountListPage、OpenAccountDialog、AccountSettingsDialog） | M5 开户 P0，账户设置 P1（并入 M9） | **P0** |
| 账户详情：持仓/委托/成交/流水四 Tab、撤单、快捷下单（AccountDetailPage） | M6 | **P0** |
| 大比拼：发起挑战/邀请/收件箱/排行/取消/游手好闲费规则（ContestsPage + contest/*） | M7 | P1 |
| 站内消息（MessageBell） | M8 | P1 |
| 个人中心：改密/改资料/退出（AccountSettingsDialog） | M9 | P1 |
| 快照心跳（use-snapshot-heartbeat） | 复用，无需改动 | P0（随框架） |
| 市场状态横幅（MarketStatusBanner） | 复用组件置顶 | P0 |
| 免责声明（DisclaimerBanner） | 移动端压缩为「我的」页内全文 + 首页脚注 | P1 |

## 四、需求池汇总表

| 优先级 | 需求 |
|---|---|
| P0 | useIsMobile + 路由层设备分发（ResponsiveRoute），PC 组件零改动 |
| P0 | MobileLayout：顶部模拟盘横幅 + 底部 5 Tab 导航 + 全局触控规范（≥44px、无 hover） |
| P0 | M1 登录/注册/忘记密码移动版 |
| P0 | M2 BI 报表移动版（图表复用 + 卡片流布局） |
| P0 | M3 行情两级页（列表页 + 个股详情）+ 自选管理 |
| P0 | M4 下单页（买/卖、二次确认、废单提示、数字键盘） |
| P0 | M5 账户卡片列表 + 开户 |
| P0 | M6 账户详情（四 Tab + 持仓卡片 + 撤单 + 快捷交易） |
| P1 | M7 大比拼移动版（挑战/邀请/排行/取消） |
| P1 | M8 站内消息页；M9 个人中心（改密/资料/退出/免责声明） |
| P1 | 下拉刷新手势（M3/M6）；移动端路由 lazy 加载 |
| P2 | Tabbar badge 未读数优化、页面滚动位置保持、横屏适配（不承诺，转竖屏布局兜底） |

## 五、待确认问题（均已给出默认假设，不阻塞开发）

1. **断点假设**：以宽度 <768px 判定移动版（含窄窗口 PC）；iPad 竖屏（768px）走 PC 版。如需 iPad 专属优化另立需求（P2）。（默认：<768px）
2. **「我的」Tab 承载范围**：个人中心 + 消息 + 免责声明 + 账户设置都并入「我的」（默认如此）；消息是否需要 Tab badge 数字提示——默认有。
3. **M2 BI 图表取舍**：手机上 KPI 卡片 + 净值曲线 + 持仓卡片全量保留；**每日盈亏柱状图与个股归因图默认保留**，若性能不佳降级为表格（P1 优化）。（默认全保留）
4. **下拉刷新**：P0 版先用轮询 + 手动刷新按钮，下拉刷新 P1 实现。（默认如此，如用户希望 P0 即有下拉刷新请指出）
5. **移动端是否限制部分 PC 功能**：建议不做功能阉割，P0 覆盖看盘+交易全链路，大比拼等社交功能 P1 跟进。（默认不阉割）

/**
 * src/mobile/index.ts — 移动端桶文件：
 * 集中导出全部 lazy 页面，router.tsx 只 import 这一处，
 * Vite 按移动页自动分包（PC 首屏体积零增加）。
 */
import { lazy } from 'react';

// M1 认证
export const LoginMobilePage = lazy(() => import('./pages/LoginMobilePage'));
export const RegisterMobilePage = lazy(() => import('./pages/RegisterMobilePage'));
export const ForgotPasswordMobilePage = lazy(() => import('./pages/ForgotPasswordMobilePage'));

// M2 BI 报表
export const DashboardMobilePage = lazy(() => import('./pages/DashboardMobilePage'));

// M3 行情两级页 + M4 下单
export const MarketListMobilePage = lazy(() => import('./pages/MarketListMobilePage'));
export const StockDetailMobilePage = lazy(() => import('./pages/StockDetailMobilePage'));
export const OrderMobilePage = lazy(() => import('./pages/OrderMobilePage'));

// M5 账户列表 + M6 账户详情
export const AccountListMobilePage = lazy(() => import('./pages/AccountListMobilePage'));
export const AccountDetailMobilePage = lazy(() => import('./pages/AccountDetailMobilePage'));

// M7 大比拼 / M8 消息 / M9 个人中心
export const ContestsMobilePage = lazy(() => import('./pages/ContestsMobilePage'));
export const MessagesMobilePage = lazy(() => import('./pages/MessagesMobilePage'));
export const MeMobilePage = lazy(() => import('./pages/MeMobilePage'));

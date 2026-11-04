/**
 * env.ts — 类型化 Bindings 与 Pages Functions 上下文（零额外依赖，结构兼容 Workers 运行时）
 */

/** D1 最小结构类型（与 Cloudflare workers-types 结构兼容） */
export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

/** Pages Functions 环境变量与绑定 */
export interface Bindings {
  DB: D1Database;
  /** JWT 签名密钥（≥32 字节随机串） */
  JWT_SECRET: string;
  /** Resend 发信密钥；本地未配置时验证码打印到控制台 */
  RESEND_API_KEY?: string;
  /** 发件人，如 '炒炒乐 <noreply@yourdomain.dev>' */
  EMAIL_FROM?: string;
}

/** Pages Functions 请求上下文（本项目的最小子集） */
export interface PagesContext<P = Record<string, string>> {
  request: Request;
  env: Bindings;
  params: P;
}

/** 端点处理函数类型 */
export type PageHandler = (ctx: PagesContext) => Promise<Response>;

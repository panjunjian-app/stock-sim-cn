/**
 * auth.ts — JWT（jose HS256）签发/验签、Cookie 解析、requireAuth
 * 无状态 JWT + httpOnly Secure Cookie，7 天有效；payload 含 token_version 用于强制失效。
 */
import { SignJWT, jwtVerify } from 'jose';
import { ApiError, CODE } from './response';
import type { Bindings, PagesContext } from './env';

export const COOKIE_NAME = 'sim_token';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 天

export interface JwtPayload {
  uid: number;
  email: string;
  ver: number; // users.token_version，重置密码/封号 +1 使旧 token 全失效
}

export interface AuthContext {
  userId: number;
  email: string;
}

function secretKey(env: Bindings): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

/** 签发 JWT */
export async function issueJwt(env: Bindings, user: { id: number; email: string; token_version: number }): Promise<string> {
  return new SignJWT({ uid: user.id, email: user.email, ver: user.token_version })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey(env));
}

/** 解析请求 Cookie */
export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('Cookie') ?? '';
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return out;
}

/** 登录/注册成功 Set-Cookie（httpOnly + Secure + SameSite=Lax，7 天） */
export function setCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TOKEN_TTL_SECONDS}`;
}

/** 登出清 Cookie */
export function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/** 带 Set-Cookie 的成功响应 */
export function okWithCookie<T>(data: T, token: string, message = 'ok'): Response {
  return new Response(JSON.stringify({ code: 0, data, message }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': setCookieHeader(token),
    },
  });
}

/** 验签 + DB 复核（token_version / 封号状态）并返回认证上下文；失败抛 ApiError(1001/1002) */
export async function requireAuth<P>(ctx: PagesContext<P>): Promise<AuthContext> {
  const cookies = parseCookies(ctx.request);
  const token = cookies[COOKIE_NAME];
  if (!token) {
    throw new ApiError(CODE.UNAUTHORIZED, '请先登录');
  }
  let payload: JwtPayload;
  try {
    const { payload: raw } = await jwtVerify(token, secretKey(ctx.env));
    payload = raw as unknown as JwtPayload;
    if (typeof payload.uid !== 'number' || typeof payload.ver !== 'number') {
      throw new Error('bad payload');
    }
  } catch {
    throw new ApiError(CODE.TOKEN_INVALID, '登录已失效，请重新登录');
  }
  // 复核用户当前状态：重置密码（token_version+1）或封号后旧 JWT 立即失效
  const user = await ctx.env.DB.prepare('SELECT token_version, status FROM users WHERE id = ?1')
    .bind(payload.uid)
    .first<{ token_version: number; status: string }>();
  if (!user || user.token_version !== payload.ver || user.status !== 'active') {
    throw new ApiError(CODE.TOKEN_INVALID, '登录已失效，请重新登录');
  }
  return { userId: payload.uid, email: String(payload.email ?? '') };
}

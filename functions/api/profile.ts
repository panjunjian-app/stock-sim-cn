/**
 * /api/profile — 账号信息
 * GET    读个人资料（邮箱只读 + 昵称）
 * PATCH  改昵称（≤20 字符；邮箱为唯一标识不可改）
 */
import { ApiError, CODE, handleError, ok } from '../lib/response';
import { requireAuth } from '../lib/auth';
import type { PagesContext } from '../lib/env';

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const u = await ctx.env.DB
      .prepare('SELECT email, nickname FROM users WHERE id = ?1')
      .bind(auth.userId)
      .first<{ email: string; nickname: string }>();
    if (!u) {
      throw new ApiError(CODE.UNAUTHORIZED, '用户不存在');
    }
    return ok({ email: u.email, nickname: u.nickname });
  } catch (err) {
    return handleError(err);
  }
};

export const onRequestPatch = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const body = (await ctx.request.json().catch(() => null)) as { nickname?: string } | null;
    const nickname = (body?.nickname ?? '').trim();
    if (nickname.length > 20) {
      throw new ApiError(CODE.BAD_PARAM, '昵称最长 20 个字符');
    }
    await ctx.env.DB.prepare('UPDATE users SET nickname = ?2, updated_at = ?3 WHERE id = ?1')
      .bind(auth.userId, nickname, new Date().toISOString())
      .run();
    return ok({ nickname });
  } catch (err) {
    return handleError(err);
  }
};

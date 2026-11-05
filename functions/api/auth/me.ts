import { ApiError, CODE, fail, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import type { PagesContext } from '../../lib/env';

/** GET /api/auth/me — 当前登录用户；未登录返回 401（前端据此恢复/清空登录态） */
export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const u = await ctx.env.DB
      .prepare('SELECT nickname, avatar FROM users WHERE id = ?1')
      .bind(auth.userId)
      .first<{ nickname: string; avatar: string }>();
    return ok({ user: { id: auth.userId, email: auth.email, nickname: u?.nickname ?? '', avatar: u?.avatar ?? '' } });
  } catch {
    return fail(CODE.UNAUTHORIZED, '未登录', 401);
  }
};

void ApiError;

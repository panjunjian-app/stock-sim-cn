/**
 * /api/contests/friends — 好友列表
 * GET 与我共同出现在同一场比赛（含待确认）中的用户，按昵称排序。
 * 好友关系实时推导，无需存储：任何同场竞技过的人自动成为好友。
 */
import { handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import type { PagesContext } from '../../lib/env';

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const rows = await ctx.env.DB
      .prepare(
        `SELECT DISTINCT u.id, u.email,
                COALESCE(NULLIF(u.nickname, ''), u.email) AS nickname,
                u.avatar
         FROM contest_participants me
         JOIN contest_participants other
           ON other.contest_id = me.contest_id AND other.user_id != me.user_id
         JOIN users u ON u.id = other.user_id
         WHERE me.user_id = ?1
           AND me.invite_status != 'declined'
           AND other.invite_status != 'declined'
         ORDER BY nickname
         LIMIT 100`
      )
      .bind(auth.userId)
      .all<{ id: number; email: string; nickname: string; avatar: string }>();
    return ok({ friends: rows.results ?? [] });
  } catch (err) {
    return handleError(err);
  }
};

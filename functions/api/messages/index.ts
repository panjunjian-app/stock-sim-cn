/**
 * /api/messages — 站内系统消息
 * GET      最近 50 条 + 未读数
 * POST     标记已读 { ids?: number[], all?: boolean }
 */
import { handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import type { PagesContext } from '../../lib/env';

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const list = await ctx.env.DB
      .prepare('SELECT id, type, title, body, ref_id AS refId, is_read AS isRead, created_at AS createdAt FROM system_messages WHERE user_id = ?1 ORDER BY id DESC LIMIT 50')
      .bind(auth.userId)
      .all<{ id: number; type: string; title: string; body: string; refId: number | null; isRead: number; createdAt: string }>();
    const unread = await ctx.env.DB
      .prepare('SELECT COUNT(*) AS n FROM system_messages WHERE user_id = ?1 AND is_read = 0')
      .bind(auth.userId)
      .first<{ n: number }>();
    return ok({
      messages: (list.results ?? []).map((m) => ({ ...m, isRead: m.isRead === 1 })),
      unread: unread?.n ?? 0,
    });
  } catch (err) {
    return handleError(err);
  }
};

interface ReadBody {
  ids?: number[];
  all?: boolean;
}

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const body = (await ctx.request.json().catch(() => null)) as ReadBody | null;
    if (body?.all) {
      await ctx.env.DB.prepare('UPDATE system_messages SET is_read = 1 WHERE user_id = ?1 AND is_read = 0').bind(auth.userId).run();
    } else if (Array.isArray(body?.ids) && body.ids.length > 0) {
      const ids = body.ids.filter((x) => Number.isInteger(x)).slice(0, 100);
      await ctx.env.DB
        .prepare(`UPDATE system_messages SET is_read = 1 WHERE user_id = ?1 AND id IN (${ids.join(',')})`)
        .bind(auth.userId)
        .run();
    }
    const unread = await ctx.env.DB
      .prepare('SELECT COUNT(*) AS n FROM system_messages WHERE user_id = ?1 AND is_read = 0')
      .bind(auth.userId)
      .first<{ n: number }>();
    return ok({ unread: unread?.n ?? 0 });
  } catch (err) {
    return handleError(err);
  }
};

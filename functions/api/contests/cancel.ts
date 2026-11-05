/**
 * /api/contests/cancel — 发起人取消未成行的挑战（POST { contestId }）
 * 条件：比赛 pending 且创建已满 24 小时仍未全员确认；
 * 效果：status → cancelled，并向所有已确认参加的用户推送站内系统消息。
 */
import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import type { PagesContext } from '../../lib/env';

const CANCEL_AFTER_MS = 24 * 60 * 60 * 1000;

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const body = (await ctx.request.json().catch(() => null)) as { contestId?: number | string } | null;
    const contestId = typeof body?.contestId === 'string' ? parseInt(body.contestId, 10) : body?.contestId;
    if (!Number.isInteger(contestId)) {
      throw new ApiError(CODE.BAD_PARAM, '参数不正确');
    }

    const c = await ctx.env.DB
      .prepare('SELECT id, name, creator_id, status, created_at FROM contests WHERE id = ?1')
      .bind(contestId as number)
      .first<{ id: number; name: string; creator_id: number; status: string; created_at: string }>();
    if (!c) {
      throw new ApiError(CODE.BAD_PARAM, '比赛不存在');
    }
    if (c.creator_id !== auth.userId) {
      throw new ApiError(CODE.BAD_PARAM, '仅发起人可取消挑战');
    }
    if (c.status !== 'pending') {
      throw new ApiError(CODE.BAD_PARAM, '该比赛已开始或已结束，不能取消');
    }
    if (Date.now() - new Date(c.created_at).getTime() < CANCEL_AFTER_MS) {
      throw new ApiError(CODE.BAD_PARAM, '发起未满 24 小时，暂不能取消（等待被邀请人确认）');
    }

    // 已确认参加的用户（排除发起人本人）
    const accepted = await ctx.env.DB
      .prepare("SELECT user_id FROM contest_participants WHERE contest_id = ?1 AND invite_status = 'accepted' AND user_id != ?2")
      .bind(c.id, auth.userId)
      .all<{ user_id: number }>();

    const nowIso = new Date().toISOString();
    const stmts = [
      ctx.env.DB.prepare("UPDATE contests SET status = 'cancelled', updated_at = ?2 WHERE id = ?1 AND status = 'pending'").bind(c.id, nowIso),
      ...(accepted.results ?? []).map((u) =>
        ctx.env.DB
          .prepare(
            "INSERT INTO system_messages (user_id, type, title, body, ref_id, is_read, created_at) VALUES (?1, 'contest_cancelled', ?2, ?3, ?4, 0, ?5)"
          )
          .bind(
            u.user_id,
            '挑战比赛已取消',
            `您已确认参加的挑战比赛「${c.name}」因 24 小时内未获全员确认，已被发起人取消。`,
            c.id,
            nowIso
          )
      ),
    ];
    await ctx.env.DB.batch(stmts);

    return ok({ contestId: c.id, cancelled: true, notified: accepted.results?.length ?? 0 }, '挑战已取消，已通知已确认参加的用户');
  } catch (err) {
    return handleError(err);
  }
};

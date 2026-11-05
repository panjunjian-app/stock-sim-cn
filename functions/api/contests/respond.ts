/**
 * POST /api/contests/respond — 应邀（同意 / 拒绝）
 * body: { contestId, accept }
 * 同意：全员接受 → 当日开赛（非交易日顺延）+ 创建比赛账户；
 * 拒绝：比赛作废（cancelled），结果反馈发起人（列表状态可见）。
 */
import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import type { PagesContext } from '../../lib/env';
import { activateContest } from '../../lib/contest';

interface RespondRow {
  p_id: number;
  contest_id: number;
  contest_status: 'pending' | 'active' | 'finished' | 'cancelled';
  invite_status: 'pending' | 'accepted' | 'declined';
}

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const body = (await ctx.request.json().catch(() => null)) as { contestId?: number; accept?: boolean } | null;
    const contestId = Number(body?.contestId);
    const accept = Boolean(body?.accept);
    if (!Number.isInteger(contestId) || contestId <= 0) {
      throw new ApiError(CODE.BAD_PARAM, '参数不正确');
    }

    const row = await ctx.env.DB
      .prepare(
        `SELECT p.id AS p_id, c.id AS contest_id, c.status AS contest_status, p.invite_status
         FROM contest_participants p JOIN contests c ON c.id = p.contest_id
         WHERE p.contest_id = ?1 AND p.user_id = ?2`
      )
      .bind(contestId, auth.userId)
      .first<RespondRow>();
    if (!row) {
      throw new ApiError(CODE.NOT_OWNER, '邀请不存在');
    }
    if (row.contest_status !== 'pending' || row.invite_status !== 'pending') {
      throw new ApiError(CODE.BAD_PARAM, '该邀请已处理或比赛已开始');
    }
    const nowIso = new Date().toISOString();

    if (!accept) {
      // 拒绝即作废
      await ctx.env.DB.batch([
        ctx.env.DB.prepare("UPDATE contest_participants SET invite_status = 'declined' WHERE id = ?1").bind(row.p_id),
        ctx.env.DB.prepare("UPDATE contests SET status = 'cancelled', updated_at = ?2 WHERE id = ?1").bind(contestId, nowIso),
      ]);
      return ok({ result: 'declined', contestStatus: 'cancelled' }, '已拒绝，本次挑战已作废');
    }

    await ctx.env.DB.prepare("UPDATE contest_participants SET invite_status = 'accepted' WHERE id = ?1").bind(row.p_id).run();
    const remaining = await ctx.env.DB
      .prepare("SELECT COUNT(*) AS n FROM contest_participants WHERE contest_id = ?1 AND invite_status = 'pending'")
      .bind(contestId)
      .first<{ n: number }>();

    if ((remaining?.n ?? 0) > 0) {
      return ok({ result: 'accepted', contestStatus: 'pending' }, '已同意参赛，等待其他被邀请人确认');
    }

    // 全员到齐 → 开赛
    const contest = await ctx.env.DB.prepare('SELECT * FROM contests WHERE id = ?1').bind(contestId).first<
      Parameters<typeof activateContest>[1]
    >();
    if (!contest) {
      throw new ApiError(CODE.BAD_PARAM, '比赛不存在');
    }
    await activateContest(ctx.env.DB, contest);
    return ok({ result: 'accepted', contestStatus: 'active' }, '全员确认完毕，比赛正式开始！');
  } catch (err) {
    return handleError(err);
  }
};

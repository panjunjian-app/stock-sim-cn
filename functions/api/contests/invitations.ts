/**
 * GET /api/contests/invitations — 我的待处理比赛邀请（收件箱）
 */
import { handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import type { PagesContext } from '../../lib/env';

interface InviteRow {
  contest_id: number;
  name: string;
  init_cash: number;
  duration_months: number;
  created_at: string;
  creator_email: string;
  creator_nickname: string;
  accepted_count: number;
  total_count: number;
}

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const res = await ctx.env.DB
      .prepare(
        `SELECT p.contest_id, c.name, c.init_cash, c.duration_months, c.created_at,
                cu.email AS creator_email, COALESCE(NULLIF(cu.nickname, ''), cu.email) AS creator_nickname,
                (SELECT COUNT(*) FROM contest_participants x WHERE x.contest_id = p.contest_id AND x.invite_status = 'accepted') AS accepted_count,
                (SELECT COUNT(*) FROM contest_participants x WHERE x.contest_id = p.contest_id) AS total_count
         FROM contest_participants p
         JOIN contests c ON c.id = p.contest_id
         JOIN users cu ON cu.id = c.creator_id
         WHERE p.user_id = ?1 AND p.role = 'invitee' AND p.invite_status = 'pending' AND c.status = 'pending'
         ORDER BY p.id DESC`
      )
      .bind(auth.userId)
      .all<InviteRow>();
    const invitations = (res.results ?? []).map((r) => ({
      contestId: r.contest_id,
      name: r.name,
      initCash: r.init_cash,
      durationMonths: r.duration_months,
      createdAt: r.created_at,
      creator: { email: r.creator_email, nickname: r.creator_nickname },
      acceptedCount: r.accepted_count,
      totalCount: r.total_count,
    }));
    return ok({ invitations });
  } catch (err) {
    return handleError(err);
  }
};

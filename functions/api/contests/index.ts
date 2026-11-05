/**
 * /api/contests — 大比拼
 * GET  我的比赛列表（含各参与者排行/邀请状态）+ 待处理邀请数
 * POST 发起挑战 { name, initCash(分), durationMonths, inviteEmails[] ≤2 }
 */
import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { requireAuth } from '../../lib/auth';
import type { PagesContext } from '../../lib/env';
import {
  contestStandings, countOccupiedContests, finishDueContests,
  CONTEST_INIT_MIN, CONTEST_INIT_MAX, CONTEST_DURATIONS, CONTEST_MAX_OCCUPIED, CONTEST_MAX_PARTICIPANTS,
  type ContestRow,
} from '../../lib/contest';
import { settleIdleFees } from '../../lib/idle-fee';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ContestListItem {
  contest: ContestRow;
  creatorEmail: string;
  creatorNickname: string;
  standings: Awaited<ReturnType<typeof contestStandings>>;
}

/** 组装单个比赛的完整视图 */
async function contestView(db: PagesContext['env']['DB'], contest: ContestRow, creatorId: number) {
  const creator = await db
    .prepare("SELECT email, COALESCE(NULLIF(nickname, ''), email) AS nickname FROM users WHERE id = ?1")
    .bind(creatorId)
    .first<{ email: string; nickname: string }>();
  const standings = await contestStandings(db, contest);
  return {
    id: contest.id,
    name: contest.name,
    status: contest.status,
    initCash: contest.init_cash,
    durationMonths: contest.duration_months,
    startDate: contest.start_date,
    endDate: contest.end_date,
    createdAt: contest.created_at,
    creator: { userId: creatorId, email: creator?.email ?? '', nickname: creator?.nickname ?? '' },
    participants: standings,
  };
}

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    await finishDueContests(ctx.env.DB); // 懒结算到期比赛

    // 游手好闲费懒结算：active 比赛逐场检查（开赛以来无买卖成交的账户每交易日扣初始资金 1%，终身制，幂等）
    const activeRows = await ctx.env.DB
      .prepare("SELECT id, init_cash, start_date FROM contests WHERE status = 'active'")
      .all<{ id: number; init_cash: number; start_date: string | null }>();
    for (const c of activeRows.results ?? []) {
      await settleIdleFees(ctx.env.DB, c);
    }

    const myContests = await ctx.env.DB
      .prepare(
        `SELECT c.*, p.user_id AS joined FROM contests c JOIN contest_participants p ON p.contest_id = c.id
         WHERE p.user_id = ?1 AND c.status IN ('active', 'finished', 'pending') ORDER BY c.id DESC LIMIT 30`
      )
      .bind(auth.userId)
      .all<ContestRow & { joined: number }>();

    const contests = [];
    for (const c of myContests.results ?? []) {
      contests.push(await contestView(ctx.env.DB, c, c.creator_id));
    }

    const inv = await ctx.env.DB
      .prepare(
        `SELECT COUNT(*) AS n FROM contest_participants p JOIN contests c ON c.id = p.contest_id
         WHERE p.user_id = ?1 AND p.role = 'invitee' AND p.invite_status = 'pending' AND c.status = 'pending'`
      )
      .bind(auth.userId)
      .first<{ n: number }>();

    return ok({ contests, pendingInvitations: inv?.n ?? 0 });
  } catch (err) {
    return handleError(err);
  }
};

interface CreateBody {
  name?: string;
  initCash?: number | string;
  durationMonths?: number;
  inviteEmails?: string[];
}

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const body = (await ctx.request.json().catch(() => null)) as CreateBody | null;

    const name = (body?.name ?? '').trim();
    if (name.length === 0 || name.length > 30) {
      throw new ApiError(CODE.BAD_PARAM, '比赛名需为 1~30 个字符');
    }
    const initCash = typeof body?.initCash === 'string' ? parseInt(body.initCash, 10) : (body?.initCash ?? 0);
    if (!Number.isInteger(initCash) || initCash < CONTEST_INIT_MIN || initCash > CONTEST_INIT_MAX) {
      throw new ApiError(CODE.BAD_PARAM, '每人初始资金需在 1 万 ~ 1000 万元之间');
    }
    const duration = body?.durationMonths ?? 0;
    if (!(CONTEST_DURATIONS as readonly number[]).includes(duration)) {
      throw new ApiError(CODE.BAD_PARAM, '比赛周期仅支持 1 / 3 / 6 / 12 个月');
    }
    const emails = [...new Set((body?.inviteEmails ?? []).map((e) => (e ?? '').trim().toLowerCase()).filter(Boolean))];
    if (emails.length === 0 || emails.length > CONTEST_MAX_PARTICIPANTS - 1) {
      throw new ApiError(CODE.BAD_PARAM, `需邀请 1~${CONTEST_MAX_PARTICIPANTS - 1} 位用户（含发起人共 ${CONTEST_MAX_PARTICIPANTS} 人）`);
    }
    if (emails.some((e) => !EMAIL_RE.test(e))) {
      throw new ApiError(CODE.BAD_PARAM, '邀请邮箱格式不正确');
    }
    if (emails.includes(auth.email.toLowerCase())) {
      throw new ApiError(CODE.BAD_PARAM, '不能邀请自己（发起人自动参赛）');
    }

    const occupied = await countOccupiedContests(ctx.env.DB, auth.userId);
    if (occupied >= CONTEST_MAX_OCCUPIED) {
      throw new ApiError(CODE.BAD_PARAM, `同时进行中的比赛最多 ${CONTEST_MAX_OCCUPIED} 场，请等待某场结束或取消`);
    }

    // 邀请对象必须已注册
    const invitees: Array<{ id: number; email: string }> = [];
    for (const email of emails) {
      const u = await ctx.env.DB.prepare('SELECT id, email FROM users WHERE email = ?1').bind(email).first<{ id: number; email: string }>();
      if (!u) {
        throw new ApiError(CODE.BAD_PARAM, `用户 ${email} 尚未注册，无法邀请`);
      }
      const occ = await countOccupiedContests(ctx.env.DB, u.id);
      if (occ >= CONTEST_MAX_OCCUPIED) {
        throw new ApiError(CODE.BAD_PARAM, `用户 ${email} 进行中的比赛已满 ${CONTEST_MAX_OCCUPIED} 场`);
      }
      invitees.push(u);
    }

    const nowIso = new Date().toISOString();
    const ins = await ctx.env.DB
      .prepare(
        `INSERT INTO contests (name, creator_id, init_cash, duration_months, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?5)`
      )
      .bind(name, auth.userId, initCash, duration, nowIso)
      .run();
    const contestId = ins.meta?.last_row_id ?? ins.meta?.row_id;

    const stmts = [
      ctx.env.DB.prepare(
        "INSERT INTO contest_participants (contest_id, user_id, role, invite_status, created_at) VALUES (?1, ?2, 'creator', 'accepted', ?3)"
      ).bind(contestId as number, auth.userId, nowIso),
      ...invitees.map((u) =>
        ctx.env.DB.prepare(
          "INSERT INTO contest_participants (contest_id, user_id, role, invite_status, created_at) VALUES (?1, ?2, 'invitee', 'pending', ?3)"
        ).bind(contestId as number, u.id, nowIso)
      ),
    ];
    await ctx.env.DB.batch(stmts);

    return ok({ contestId, invited: invitees.map((u) => u.email) }, '挑战邀请已发送');
  } catch (err) {
    return handleError(err);
  }
};

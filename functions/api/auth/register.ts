import { ApiError, CODE, handleError } from '../../lib/response';
import { issueJwt, okWithCookie } from '../../lib/auth';
import { hashPassword } from '../../lib/password';
import { checkEmail, checkPassword } from '../../../shared/validate';
import type { PagesContext } from '../../lib/env';

interface Body {
  email?: string;
  password?: string;
}

/** POST /api/auth/register — 注册（邮箱为唯一标识，无需验证码），成功即自动登录 */
export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const body = (await ctx.request.json().catch(() => ({}))) as Body;
    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    if (!checkEmail(email).ok) {
      throw new ApiError(CODE.BAD_PARAM, '邮箱格式不正确');
    }
    const pwCheck = checkPassword(password);
    if (!pwCheck.ok) {
      throw new ApiError(CODE.BAD_PARAM, pwCheck.reason ?? '密码不符合要求');
    }

    // 邮箱唯一性：唯一标识，重复注册直接拒绝
    const exists = await ctx.env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first<{ id: number }>();
    if (exists) {
      throw new ApiError(CODE.EMAIL_TAKEN, '该邮箱已注册，请直接登录', 409);
    }

    const nowIso = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const result = await ctx.env.DB
      .prepare('INSERT INTO users (email, password_hash, token_version, status, created_at, updated_at) VALUES (?1, ?2, 0, ?3, ?4, ?4)')
      .bind(email, passwordHash, 'active', nowIso)
      .run();
    const userId = (result.meta?.row_id ?? result.meta?.last_row_id) as number;

    const token = await issueJwt(ctx.env, { id: userId, email, token_version: 0 });
    return okWithCookie({ user: { id: userId, email } }, token);
  } catch (err) {
    return handleError(err);
  }
};

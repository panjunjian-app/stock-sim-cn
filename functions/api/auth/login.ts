import { ApiError, CODE, handleError } from '../../lib/response';
import { issueJwt, okWithCookie } from '../../lib/auth';
import { verifyPassword } from '../../lib/password';
import { checkEmail } from '../../../shared/validate';
import type { PagesContext } from '../../lib/env';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  token_version: number;
  status: 'active' | 'banned';
}

interface Body {
  email?: string;
  password?: string;
}

/** POST /api/auth/login — 邮箱 + 密码登录 */
export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const body = (await ctx.request.json().catch(() => ({}))) as Body;
    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';
    if (!checkEmail(email).ok || password.length === 0) {
      throw new ApiError(CODE.BAD_PARAM, '请输入邮箱与密码');
    }
    const user = await ctx.env.DB.prepare('SELECT * FROM users WHERE email = ?1').bind(email).first<UserRow>();
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new ApiError(CODE.BAD_PARAM, '邮箱或密码不正确');
    }
    if (user.status !== 'active') {
      throw new ApiError(CODE.TOKEN_INVALID, '账号已被禁用');
    }
    const token = await issueJwt(ctx.env, user);
    return okWithCookie({ user: { id: user.id, email: user.email } }, token);
  } catch (err) {
    return handleError(err);
  }
};

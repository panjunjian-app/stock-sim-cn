/**
 * POST /api/profile/password — 修改密码
 * 验证旧密码 → 新密码过策略 → token_version+1（旧会话全失效）→ 换发新 cookie 保持当前登录。
 */
import { ApiError, CODE, handleError } from '../../lib/response';
import { requireAuth, issueJwt, okWithCookie } from '../../lib/auth';
import { hashPassword, verifyPassword } from '../../lib/password';
import { checkPassword } from '../../../shared/validate';
import type { PagesContext } from '../../lib/env';

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  token_version: number;
}

interface PasswordBody {
  oldPassword?: string;
  newPassword?: string;
}

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const body = (await ctx.request.json().catch(() => null)) as PasswordBody | null;
    const oldPw = body?.oldPassword ?? '';
    const newPw = body?.newPassword ?? '';
    if (!oldPw || !newPw) {
      throw new ApiError(CODE.BAD_PARAM, '请输入旧密码与新密码');
    }
    const u = await ctx.env.DB
      .prepare('SELECT id, email, password_hash, token_version FROM users WHERE id = ?1')
      .bind(auth.userId)
      .first<UserRow>();
    if (!u) {
      throw new ApiError(CODE.UNAUTHORIZED, '用户不存在');
    }
    if (!(await verifyPassword(oldPw, u.password_hash))) {
      throw new ApiError(CODE.BAD_PARAM, '旧密码不正确');
    }
    const check = checkPassword(newPw);
    if (!check.ok) {
      throw new ApiError(CODE.BAD_PARAM, check.reason ?? '密码不符合安全要求');
    }
    if (await verifyPassword(newPw, u.password_hash)) {
      throw new ApiError(CODE.BAD_PARAM, '新密码不能与旧密码相同');
    }
    const newPasswordHash = await hashPassword(newPw);
    const newTokenVersion = u.token_version + 1;
    await ctx.env.DB
      .prepare('UPDATE users SET password_hash = ?2, token_version = ?3, updated_at = ?4 WHERE id = ?1')
      .bind(u.id, newPasswordHash, newTokenVersion, new Date().toISOString())
      .run();
    const token = await issueJwt(ctx.env, { id: u.id, email: u.email, token_version: newTokenVersion });
    return okWithCookie({ changed: true }, token, '密码修改成功');
  } catch (err) {
    return handleError(err);
  }
};

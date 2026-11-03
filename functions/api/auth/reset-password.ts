import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { recheckVerified } from '../../lib/email';
import { hashPassword } from '../../lib/password';
import { checkEmail, checkPassword, checkVerifyCode } from '../../../shared/validate';
import type { PagesContext } from '../../lib/env';

interface Body {
  email?: string;
  purpose?: 'register' | 'reset';
  code?: string;
  newPassword?: string;
}

/** POST /api/auth/reset-password — 忘记密码重置（邮箱+验证码+新密码），重置后旧 JWT 全失效 */
export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const body = (await ctx.request.json().catch(() => ({}))) as Body;
    const email = (body.email ?? '').trim().toLowerCase();
    const purpose = body.purpose;
    const code = (body.code ?? '').trim();
    const newPassword = body.newPassword ?? '';
    if (!checkEmail(email).ok) {
      throw new ApiError(CODE.BAD_PARAM, '邮箱格式不正确');
    }
    if (purpose !== 'reset') {
      throw new ApiError(CODE.BAD_PARAM, 'purpose 必须为 reset');
    }
    if (!checkVerifyCode(code).ok) {
      throw new ApiError(CODE.BAD_PARAM, '验证码应为 6 位数字');
    }
    const pwCheck = checkPassword(newPassword);
    if (!pwCheck.ok) {
      throw new ApiError(CODE.BAD_PARAM, pwCheck.reason ?? '密码不符合要求');
    }
    await recheckVerified(ctx.env.DB, email, 'reset', code);

    const user = await ctx.env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first<{ id: number }>();
    if (!user) {
      throw new ApiError(CODE.BAD_PARAM, '该邮箱尚未注册');
    }
    const nowIso = new Date().toISOString();
    const passwordHash = await hashPassword(newPassword);
    await ctx.env.DB
      .prepare('UPDATE users SET password_hash = ?2, token_version = token_version + 1, updated_at = ?3 WHERE id = ?1')
      .bind(user.id, passwordHash, nowIso)
      .run();
    return ok({});
  } catch (err) {
    return handleError(err);
  }
};

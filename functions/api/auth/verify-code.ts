import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { checkAndMarkVerified } from '../../lib/email';
import { checkEmail, checkVerifyCode } from '../../../shared/validate';
import type { PagesContext } from '../../lib/env';

interface Body {
  email?: string;
  purpose?: 'register' | 'reset';
  code?: string;
}

/** POST /api/auth/verify-code — 校验验证码（通过后置 verified=1） */
export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const body = (await ctx.request.json().catch(() => ({}))) as Body;
    const email = (body.email ?? '').trim().toLowerCase();
    const purpose = body.purpose;
    const code = (body.code ?? '').trim();
    if (!checkEmail(email).ok) {
      throw new ApiError(CODE.BAD_PARAM, '邮箱格式不正确');
    }
    if (purpose !== 'register' && purpose !== 'reset') {
      throw new ApiError(CODE.BAD_PARAM, 'purpose 必须为 register 或 reset');
    }
    if (!checkVerifyCode(code).ok) {
      throw new ApiError(CODE.BAD_PARAM, '验证码应为 6 位数字');
    }
    await checkAndMarkVerified(ctx.env.DB, email, purpose, code);
    return ok({ verified: true });
  } catch (err) {
    return handleError(err);
  }
};

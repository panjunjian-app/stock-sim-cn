import { ApiError, CODE, handleError, ok } from '../../lib/response';
import { sendAndLimit } from '../../lib/email';
import { checkEmail } from '../../../shared/validate';
import type { PagesContext } from '../../lib/env';

interface Body {
  email?: string;
  purpose?: 'reset';
}

/** POST /api/auth/send-code — 发送邮箱验证码（仅找回密码场景；60s 冷却 / 单日 5 封） */
export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  try {
    const body = (await ctx.request.json().catch(() => ({}))) as Body;
    const email = (body.email ?? '').trim().toLowerCase();
    const purpose = body.purpose;
    if (!checkEmail(email).ok) {
      throw new ApiError(CODE.BAD_PARAM, '邮箱格式不正确');
    }
    if (purpose !== 'reset') {
      throw new ApiError(CODE.BAD_PARAM, 'purpose 必须为 reset（注册无需验证码）');
    }
    const exists = await ctx.env.DB.prepare('SELECT id FROM users WHERE email = ?1').bind(email).first<{ id: number }>();
    if (!exists) {
      throw new ApiError(CODE.BAD_PARAM, '该邮箱尚未注册');
    }
    const result = await sendAndLimit(ctx.env.DB, ctx.env, email, purpose);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
};

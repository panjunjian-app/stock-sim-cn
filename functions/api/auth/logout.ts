import { clearCookieHeader } from '../../lib/auth';
import { ok } from '../../lib/response';
import type { PagesContext } from '../../lib/env';

/** POST /api/auth/logout — 登出（清 Cookie） */
export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  return new Response(JSON.stringify({ code: 0, data: {}, message: 'ok' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': clearCookieHeader(),
    },
  });
};

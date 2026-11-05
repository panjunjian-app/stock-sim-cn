/**
 * /api/profile — 账号信息
 * GET    读个人资料（邮箱只读 + 昵称 + 头像）
 * PATCH  改昵称（≤20 字符）/ 改头像（≤80KB base64 图片；邮箱为唯一标识不可改）
 */
import { ApiError, CODE, handleError, ok } from '../lib/response';
import { requireAuth } from '../lib/auth';
import type { PagesContext } from '../lib/env';

/** 头像原始二进制上限：80KB（客户端已压缩为 128px JPEG） */
export const AVATAR_MAX_BYTES = 80 * 1024;
/** 头像 data URL 校验（允许 jpeg/png/webp） */
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
/** base64 膨胀 4/3，另留前缀余量 */
const AVATAR_MAX_LEN = Math.ceil((AVATAR_MAX_BYTES * 4) / 3) + 64;

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const u = await ctx.env.DB
      .prepare('SELECT email, nickname, avatar FROM users WHERE id = ?1')
      .bind(auth.userId)
      .first<{ email: string; nickname: string; avatar: string }>();
    if (!u) {
      throw new ApiError(CODE.UNAUTHORIZED, '用户不存在');
    }
    return ok({ email: u.email, nickname: u.nickname, avatar: u.avatar });
  } catch (err) {
    return handleError(err);
  }
};

export const onRequestPatch = async (ctx: PagesContext): Promise<Response> => {
  try {
    const auth = await requireAuth(ctx);
    const body = (await ctx.request.json().catch(() => null)) as
      | { nickname?: string; avatar?: string }
      | null;
    if (!body || (body.nickname === undefined && body.avatar === undefined)) {
      throw new ApiError(CODE.BAD_PARAM, '无可更新字段');
    }

    const sets: string[] = [];
    const binds: Array<string | number> = [auth.userId];

    if (body.nickname !== undefined) {
      const nickname = body.nickname.trim();
      if (nickname.length > 20) {
        throw new ApiError(CODE.BAD_PARAM, '昵称最长 20 个字符');
      }
      sets.push('nickname = ?' + (binds.length + 1));
      binds.push(nickname);
    }

    if (body.avatar !== undefined) {
      const avatar = body.avatar;
      if (avatar !== '' && (!AVATAR_RE.test(avatar) || avatar.length > AVATAR_MAX_LEN)) {
        throw new ApiError(CODE.BAD_PARAM, '头像格式不支持或超过 80KB');
      }
      sets.push('avatar = ?' + (binds.length + 1));
      binds.push(avatar);
    }

    sets.push('updated_at = ?' + (binds.length + 1));
    binds.push(new Date().toISOString());

    await ctx.env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?1`)
      .bind(...binds)
      .run();

    return ok({
      ...(body.nickname !== undefined ? { nickname: body.nickname.trim() } : {}),
      ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
    });
  } catch (err) {
    return handleError(err);
  }
};

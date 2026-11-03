import { apiGet, apiPost } from './http';
import type { User } from '../../shared/types';

interface AuthPayload {
  user: User;
}

export const authApi = {
  /** 发送验证码（purpose: register | reset）；未配置邮件服务时返回 devCode（开发模式自动填入） */
  sendCode(email: string, purpose: 'register' | 'reset'): Promise<{ sent: true; devCode?: string }> {
    return apiPost('/api/auth/send-code', { email, purpose });
  },
  /** 校验验证码（服务端置 verified=1） */
  verifyCode(email: string, purpose: 'register' | 'reset', code: string): Promise<{ verified: true }> {
    return apiPost('/api/auth/verify-code', { email, purpose, code });
  },
  /** 注册（自动登录，Set-Cookie） */
  register(email: string, code: string, password: string): Promise<AuthPayload> {
    return apiPost('/api/auth/register', { email, purpose: 'register', code, password });
  },
  /** 登录 */
  login(email: string, password: string): Promise<AuthPayload> {
    return apiPost('/api/auth/login', { email, password });
  },
  /** 登出（清 Cookie） */
  logout(): Promise<Record<string, never>> {
    return apiPost('/api/auth/logout');
  },
  /** 当前用户；未登录抛 ApiError(1001) */
  me(): Promise<{ user: User }> {
    return apiGet('/api/auth/me');
  },
  /** 重置密码 */
  resetPassword(email: string, code: string, newPassword: string): Promise<Record<string, never>> {
    return apiPost('/api/auth/reset-password', { email, purpose: 'reset', code, newPassword });
  },
};

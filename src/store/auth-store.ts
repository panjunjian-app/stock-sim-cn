import { create } from 'zustand';
import type { User } from '../../shared/types';
import { authApi } from '../services/auth-api';

interface AuthState {
  user: User | null;
  /** 是否已完成首次登录态探测（/api/auth/me） */
  loaded: boolean;
  setUser: (user: User) => void;
  clear: () => void;
  fetchMe: () => Promise<void>;
}

/** 全局登录态（zustand）：启动时 fetchMe 恢复 Cookie 会话 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loaded: false,
  setUser: (user) => set({ user, loaded: true }),
  clear: () => set({ user: null }),
  fetchMe: async () => {
    try {
      const { user } = await authApi.me();
      set({ user: user ?? null, loaded: true });
    } catch {
      set({ user: null, loaded: true });
    }
  },
}));

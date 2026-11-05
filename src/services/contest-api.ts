/**
 * profile-api.ts / contest-api.ts — 账号设置与大比拼 API 客户端
 */
import { apiGet, apiPatch, apiPost } from './http';
import type { ContestInfo, ContestInvitation } from '../../shared/types';

export const profileApi = {
  getProfile(): Promise<{ email: string; nickname: string; avatar: string }> {
    return apiGet('/api/profile');
  },
  updateProfile(fields: { nickname?: string; avatar?: string }): Promise<{ nickname?: string; avatar?: string }> {
    return apiPatch('/api/profile', fields);
  },
  updateNickname(nickname: string): Promise<{ nickname: string }> {
    return this.updateProfile({ nickname }) as Promise<{ nickname: string }>;
  },
  changePassword(oldPassword: string, newPassword: string): Promise<{ changed: boolean }> {
    return apiPost('/api/profile/password', { oldPassword, newPassword });
  },
};

export interface ContestListResult {
  contests: ContestInfo[];
  pendingInvitations: number;
}

export const contestApi = {
  list(): Promise<ContestListResult> {
    return apiGet('/api/contests');
  },
  create(body: { name: string; initCash: number; durationMonths: number; inviteEmails: string[] }): Promise<{ contestId: number; invited: string[] }> {
    return apiPost('/api/contests', body);
  },
  invitations(): Promise<{ invitations: ContestInvitation[] }> {
    return apiGet('/api/contests/invitations');
  },
  respond(contestId: number, accept: boolean): Promise<{ result: string; contestStatus: string }> {
    return apiPost('/api/contests/respond', { contestId, accept });
  },
};

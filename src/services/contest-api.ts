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

/** 好友：与我同场竞技过的用户 */
export interface Friend {
  id: number;
  email: string;
  nickname: string;
  avatar: string;
}

export const contestApi = {
  list(): Promise<ContestListResult> {
    return apiGet('/api/contests');
  },
  friends(): Promise<{ friends: Friend[] }> {
    return apiGet('/api/contests/friends');
  },
  create(body: { name: string; initCash: number; durationMonths: number; inviteEmails: string[] }): Promise<{ contestId: number; invited: string[] }> {
    return apiPost('/api/contests', body);
  },
  cancel(contestId: number): Promise<{ contestId: number; cancelled: boolean; notified: number }> {
    return apiPost('/api/contests/cancel', { contestId });
  },
  invitations(): Promise<{ invitations: ContestInvitation[] }> {
    return apiGet('/api/contests/invitations');
  },
  respond(contestId: number, accept: boolean): Promise<{ result: string; contestStatus: string }> {
    return apiPost('/api/contests/respond', { contestId, accept });
  },
};

/** 站内系统消息（比赛取消等事件通知） */
export interface SystemMessage {
  id: number;
  type: string;
  title: string;
  body: string;
  refId: number | null;
  isRead: boolean;
  createdAt: string;
}

export const messageApi = {
  list(): Promise<{ messages: SystemMessage[]; unread: number }> {
    return apiGet('/api/messages');
  },
  markRead(ids?: number[]): Promise<{ unread: number }> {
    return apiPost('/api/messages/read', ids && ids.length > 0 ? { ids } : { all: true });
  },
};

import type { ApiResponse } from '../../shared/types';

/** 业务 API 错误：code 为统一错误码（见 functions/lib/response.ts CODE 表） */
export class ApiError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  let envelope: ApiResponse<T> | null = null;
  try {
    envelope = (await resp.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(-1, '服务响应格式异常');
  }
  if (envelope.code !== 0) {
    throw new ApiError(envelope.code, envelope.message || '请求失败');
  }
  return envelope.data;
}

/** GET /api/** */
export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

/** POST /api/**（JSON body） */
export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

/** DELETE /api/** */
export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

/**
 * 炒炒乐挑战赛容量规则单测：
 *  - 每用户同时作为发起人的进行中比赛 ≤ CONTEST_MAX_CREATED（4 场）
 *  - 单场比赛含发起人 ≤ CONTEST_MAX_PARTICIPANTS（5 人）
 *  - accept 防御路径：名额已满拒绝加入（该比赛人数已满）
 * 纯校验逻辑，不依赖 D1（数据访问 countCreatedContests / countContestOccupancy 由调用方传入计数结果）。
 */
import { describe, expect, it } from 'vitest';
import {
  assertContestNotFull,
  assertCreatorCreatedQuota,
  CONTEST_MAX_CREATED,
  CONTEST_MAX_OCCUPIED,
  CONTEST_MAX_PARTICIPANTS,
} from '../contest';
import { ApiError } from '../response';

describe('容量常量（2025 规则调整：4 场发起 / 5 人参赛）', () => {
  it('每用户进行中比赛上限为 4', () => {
    expect(CONTEST_MAX_OCCUPIED).toBe(4);
  });

  it('单场比赛含发起人上限为 5（最多邀请 4 人）', () => {
    expect(CONTEST_MAX_PARTICIPANTS).toBe(5);
    expect(CONTEST_MAX_PARTICIPANTS - 1).toBe(4);
  });

  it('每用户同时作为发起人的进行中比赛上限为 4', () => {
    expect(CONTEST_MAX_CREATED).toBe(4);
  });
});

describe('assertCreatorCreatedQuota 发起人进行中比赛护栏', () => {
  it('已发起 3 场（<4）→ 允许再发起', () => {
    expect(() => assertCreatorCreatedQuota(0)).not.toThrow();
    expect(() => assertCreatorCreatedQuota(3)).not.toThrow();
  });

  it('已发起 4 场（≥4）→ 拒绝并提示最多同时发起 4 场', () => {
    expect(() => assertCreatorCreatedQuota(4)).toThrowError(ApiError);
    expect(() => assertCreatorCreatedQuota(4)).toThrowError('最多同时发起 4 场挑战');
    expect(() => assertCreatorCreatedQuota(5)).toThrowError('最多同时发起 4 场挑战');
  });
});

describe('assertContestNotFull 参赛人数护栏（accept 防御路径）', () => {
  it('占用名额 4 人（<5）→ 允许加入', () => {
    expect(() => assertContestNotFull(0)).not.toThrow();
    expect(() => assertContestNotFull(4)).not.toThrow();
  });

  it('占用名额已达 5 人 → 拒绝并提示该比赛人数已满', () => {
    expect(() => assertContestNotFull(5)).toThrowError(ApiError);
    expect(() => assertContestNotFull(5)).toThrowError('该比赛人数已满');
    expect(() => assertContestNotFull(6)).toThrowError('该比赛人数已满');
  });
});

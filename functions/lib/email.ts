/**
 * email.ts — Resend 发送 + 限流（60s 冷却 / 单日 5 封，防刷在 D1 实现）
 * 本地未配置 RESEND_API_KEY 时验证码打印到控制台（联调用）。
 */
import { ApiError, CODE } from './response';
import { sha256Hex } from './password';
import { beijingDateKey } from '../../shared/trading-calendar';
import type { Bindings, D1Database } from './env';

const COOLDOWN_MS = 60 * 1000;
const DAILY_LIMIT = 5;
const EXPIRES_MS = 10 * 60 * 1000;

export interface VerificationRow {
  id: number;
  email: string;
  purpose: 'register' | 'reset';
  code_hash: string;
  expires_at: string;
  attempts: number;
  verified: number;
  last_sent_at: string;
  day_key: string;
  day_count: number;
  created_at: string;
}

/** 生成 6 位随机数字验证码（拒绝采样，无模数偏差） */
export function genCode(): string {
  // 4294 * 1_000_000 = 4_294_000_000 < 2^32；落在该范围内时对 1e6 取模均匀
  for (;;) {
    const v = crypto.getRandomValues(new Uint32Array(1))[0];
    if (v < 4_294_000_000) {
      return String(v % 1_000_000).padStart(6, '0');
    }
  }
}

interface SendRowParams {
  email: string;
  purpose: 'register' | 'reset';
  codeHash: string;
  expiresAt: string;
  lastSentAt: string;
  dayKey: string;
  dayCount: number;
  nowIso: string;
}

function upsertStmt(db: D1Database, p: SendRowParams) {
  return db
    .prepare(
      `INSERT INTO email_verifications
         (email, purpose, code_hash, expires_at, attempts, verified, last_sent_at, day_key, day_count, created_at)
       VALUES (?1, ?2, ?3, ?4, 0, 0, ?5, ?6, ?7, ?8)
       ON CONFLICT (email, purpose) DO UPDATE SET
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         attempts = 0,
         verified = 0,
         last_sent_at = excluded.last_sent_at,
         day_key = excluded.day_key,
         day_count = excluded.day_count`,
    )
    .bind(p.email, p.purpose, p.codeHash, p.expiresAt, p.lastSentAt, p.dayKey, p.dayCount, p.nowIso);
}

/** 通过 Resend REST API 发送（零 SDK 依赖） */
async function sendViaResend(env: Bindings, email: string, code: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    // 本地/未配置：打印验证码便于联调
    console.log(`[email] DEV MODE 验证码 → ${email}: ${code}`);
    return;
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || '模拟炒股 <onboarding@resend.dev>',
      to: [email],
      subject: `模拟炒股验证码：${code}`,
      html: `<p>你的验证码是 <strong>${code}</strong>，10 分钟内有效。</p>
             <p>本邮件由模拟炒股平台发送（纯模拟练习环境，与真实财产无关）。</p>`,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    console.error('[email] resend error:', resp.status, body);
    throw new ApiError(500, '邮件发送失败，请稍后重试', 500);
  }
}

/**
 * 发送验证码并执行限流：
 * - 同 email+purpose 60s 内只发一次（1004）
 * - 单日（北京时间）上限 5 封（1004）
 * - 成功后 upsert 验证码行（重置 attempts/verified，10 分钟有效）
 */
export async function sendAndLimit(
  db: D1Database,
  env: Bindings,
  email: string,
  purpose: 'register' | 'reset',
): Promise<{ sent: true }> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const dayKey = beijingDateKey(now);

  const row = await db
    .prepare('SELECT * FROM email_verifications WHERE email = ?1 AND purpose = ?2')
    .bind(email, purpose)
    .first<VerificationRow>();

  let dayCount = 1;
  if (row) {
    if (now - new Date(row.last_sent_at).getTime() < COOLDOWN_MS) {
      throw new ApiError(CODE.CODE_FREQ, '发送过于频繁，请 60 秒后再试');
    }
    const rowDayCount = row.day_key === dayKey ? row.day_count : 0;
    if (rowDayCount >= DAILY_LIMIT) {
      throw new ApiError(CODE.CODE_FREQ, '该邮箱今日验证码发送次数已达上限');
    }
    dayCount = rowDayCount + 1;
  }

  const code = genCode();
  const codeHash = await sha256Hex(code);
  await upsertStmt(db, {
    email,
    purpose,
    codeHash,
    expiresAt: new Date(now + EXPIRES_MS).toISOString(),
    lastSentAt: nowIso,
    dayKey,
    dayCount,
    nowIso,
  }).run();

  await sendViaResend(env, email, code);
  return { sent: true };
}

export interface VerifyOutcome {
  row: VerificationRow;
}

/**
 * 校验验证码（verify-code 端点用）：比对哈希 + 有效期 + attempts<5；
 * 通过后置 verified=1（注册/重置时服务端复查此标记）。
 */
export async function checkAndMarkVerified(
  db: D1Database,
  email: string,
  purpose: 'register' | 'reset',
  code: string,
): Promise<VerifyOutcome> {
  const now = Date.now();
  const row = await db
    .prepare('SELECT * FROM email_verifications WHERE email = ?1 AND purpose = ?2')
    .bind(email, purpose)
    .first<VerificationRow>();
  if (!row) {
    throw new ApiError(CODE.CODE_WRONG, '请先获取验证码');
  }
  if (row.attempts >= 5) {
    throw new ApiError(CODE.CODE_WRONG, '验证码错误次数过多，请重新获取');
  }
  const codeHash = await sha256Hex(code);
  if (row.code_hash !== codeHash || new Date(row.expires_at).getTime() <= now) {
    await db
      .prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?1')
      .bind(row.id)
      .run();
    throw new ApiError(CODE.CODE_WRONG, '验证码错误或已过期');
  }
  await db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?1').bind(row.id).run();
  return { row: { ...row, verified: 1 } };
}

/** 注册/重置时的服务端复查：verified=1 且 code 哈希匹配（不信任前端状态）；复查通过后立即消费验证码，防重放 */
export async function recheckVerified(
  db: D1Database,
  email: string,
  purpose: 'register' | 'reset',
  code: string,
): Promise<void> {
  const now = Date.now();
  const row = await db
    .prepare('SELECT * FROM email_verifications WHERE email = ?1 AND purpose = ?2')
    .bind(email, purpose)
    .first<VerificationRow>();
  if (!row || row.verified !== 1) {
    throw new ApiError(CODE.CODE_WRONG, '请先完成验证码校验');
  }
  const codeHash = await sha256Hex(code);
  if (row.code_hash !== codeHash || new Date(row.expires_at).getTime() <= now) {
    throw new ApiError(CODE.CODE_WRONG, '验证码错误或已过期，请重新获取');
  }
  // 一次性消费：置 verified=2 并作废哈希，10 分钟窗口内不可重放
  await db
    .prepare("UPDATE email_verifications SET verified = 2, code_hash = 'consumed' WHERE id = ?1")
    .bind(row.id)
    .run();
}

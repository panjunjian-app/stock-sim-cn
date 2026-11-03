/**
 * password.ts — WebCrypto PBKDF2-SHA256 密码哈希（Workers 原生兼容，无 Node 依赖）
 * 存储格式：'pbkdf2$100000$<salt_b64>$<hash_b64>'
 */

const ITERATIONS = 100_000;
const HASH_ALGO = 'SHA-256';
const KEY_LEN = 32; // bytes

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: HASH_ALGO, salt: salt as BufferSource, iterations },
    key,
    KEY_LEN * 8,
  );
}

/** 哈希密码 → 'pbkdf2$100000$<salt_b64>$<hash_b64>' */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(bits)}`;
}

/** 常量时间比较两个字符串 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** 校验密码是否与存储哈希匹配 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return false;
  }
  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }
  const salt = fromBase64(parts[2]);
  const expected = parts[3];
  const bits = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(toBase64(bits), expected);
}

/** SHA-256 十六进制摘要（验证码哈希用） */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

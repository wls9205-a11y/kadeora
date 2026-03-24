import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY environment variable is not set');
  return Buffer.from(key, 'hex');
}

/** AES-256-GCM 암호화 — 전화번호 등 민감 데이터 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  // iv:tag:encrypted 형태로 저장
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/** AES-256-GCM 복호화 */
export function decrypt(encryptedText: string): string {
  const key = getKey();
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** 전화번호 마스킹 (010-1234-5678 → ****5678) */
export function maskPhone(phone: string): string {
  const clean = phone.replace(/-/g, '');
  if (clean.length < 4) return '****';
  return `****${clean.slice(-4)}`;
}

/** 암호화 키 존재 여부 확인 */
export function hasEncryptionKey(): boolean {
  return !!process.env.ENCRYPTION_KEY;
}

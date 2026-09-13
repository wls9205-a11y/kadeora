/**
 * 수신거부 토큰 — 발급(email-templates)과 검증(/api/unsubscribe)의 «같은 문».
 *
 * ── 왜 한 파일인가 ──────────────────────────────────────────────────────────
 * 전에는 두 파일이 각자 `env || NEXTAUTH_SECRET || 'kadeora-unsub-secret'` 를 들고 있었다.
 * 한쪽만 고치면 발급한 토큰을 검증이 거절한다. 규칙이 둘이면 언젠가 갈라진다.
 *
 * ── 왜 폴백 리터럴을 걷었나 (FINAL_HC_20260913 C-1) ────────────────────────
 * 2026-09-13 실측: UNSUBSCRIBE_SECRET·NEXTAUTH_SECRET 둘 다 프로덕션에 «없었다».
 * 즉 프로덕션 토큰은 공개 리포에 적힌 문자열로 서명되고 있었고, 누구나 임의 이메일의
 * 수신거부 토큰을 만들 수 있었다. 같은 날 UNSUBSCRIBE_SECRET 을 등록했다.
 *
 * ⚠️ 구 폴백은 «검증측에서만» LEGACY_ACCEPT_UNTIL 까지 받아 준다.
 *    이미 발송된 메일의 수신거부 링크가 구 비밀로 서명돼 있어서, 즉시 끊으면
 *    수신거부가 안 되는 메일이 남는다(법정 의무 경로). 4주면 발송 메일 대부분이 소비된다.
 *    ⛔ 날짜가 지나면 코드가 스스로 거부한다 — 「나중에 지우자」가 잊혀도 구멍이 닫힌다.
 *    그 뒤 이 상수와 분기를 지우는 정리 커밋은 별건.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const LEGACY_SECRET = 'kadeora-unsub-secret';
export const LEGACY_ACCEPT_UNTIL = Date.parse('2026-10-11T00:00:00+09:00');

function currentSecret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || null;
}

function hmac(secret: string, email: string): string {
  return createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex');
}

function sameHex(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** 비밀이 없으면 null — 발급측은 토큰 링크를 만들지 않는다(위조 가능한 토큰을 내보내지 않는다). */
export function generateUnsubToken(email: string): string | null {
  const secret = currentSecret();
  return secret ? hmac(secret, email) : null;
}

export function verifyUnsubToken(email: string, token: string | null, now: number = Date.now()): boolean {
  if (!token) return false;
  const secret = currentSecret();
  if (secret && sameHex(token, hmac(secret, email))) return true;
  if (now < LEGACY_ACCEPT_UNTIL && sameHex(token, hmac(LEGACY_SECRET, email))) return true;
  return false;
}

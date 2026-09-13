/**
 * FINAL_HC_20260913 C-1 — 수신거부 토큰 발급→검증 왕복 + 구 폴백 유예.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'crypto';
import { generateUnsubToken, LEGACY_ACCEPT_UNTIL, verifyUnsubToken } from '@/lib/unsub-token';
import { buildUnsubUrl, unsubAnchor } from '@/lib/email-templates';

const legacy = (e: string) => createHmac('sha256', 'kadeora-unsub-secret').update(e.toLowerCase().trim()).digest('hex');
const saved = { u: process.env.UNSUBSCRIBE_SECRET, n: process.env.NEXTAUTH_SECRET };

describe('unsub-token', () => {
  beforeEach(() => { process.env.UNSUBSCRIBE_SECRET = 'test-secret-xyz'; delete process.env.NEXTAUTH_SECRET; });
  afterEach(() => { process.env.UNSUBSCRIBE_SECRET = saved.u; process.env.NEXTAUTH_SECRET = saved.n; if (saved.u === undefined) delete process.env.UNSUBSCRIBE_SECRET; if (saved.n === undefined) delete process.env.NEXTAUTH_SECRET; });

  it('발급한 토큰을 검증이 받는다 (대소문자·공백 정규화 포함)', () => {
    const t = generateUnsubToken('User@Example.com ')!;
    expect(verifyUnsubToken('user@example.com', t)).toBe(true);
  });

  it('다른 이메일·변조 토큰·빈 토큰은 거부', () => {
    const t = generateUnsubToken('a@b.com')!;
    expect(verifyUnsubToken('c@d.com', t)).toBe(false);
    expect(verifyUnsubToken('a@b.com', t.slice(0, -1) + (t.endsWith('0') ? '1' : '0'))).toBe(false);
    expect(verifyUnsubToken('a@b.com', null)).toBe(false);
    expect(verifyUnsubToken('a@b.com', 'short')).toBe(false);
  });

  it('⚠️ 구 폴백 서명은 유예일 전까지만 받는다 — 기발송 메일 링크 보존', () => {
    expect(verifyUnsubToken('a@b.com', legacy('a@b.com'), LEGACY_ACCEPT_UNTIL - 1)).toBe(true);
    expect(verifyUnsubToken('a@b.com', legacy('a@b.com'), LEGACY_ACCEPT_UNTIL)).toBe(false);
  });

  it('⛔ 비밀이 없으면 발급하지 않는다 — 링크도 생략된다', () => {
    delete process.env.UNSUBSCRIBE_SECRET;
    expect(generateUnsubToken('a@b.com')).toBeNull();
    expect(buildUnsubUrl('a@b.com')).toBeNull();
    expect(unsubAnchor(buildUnsubUrl('a@b.com'), 'x', '수신거부')).toBe('');
  });

  it('비밀이 있으면 링크가 토큰을 싣는다', () => {
    const url = buildUnsubUrl('a@b.com')!;
    const token = new URL(url).searchParams.get('token');
    expect(verifyUnsubToken('a@b.com', token)).toBe(true);
    expect(unsubAnchor(url, 's', 'L')).toContain(`href="${url}"`);
  });
});

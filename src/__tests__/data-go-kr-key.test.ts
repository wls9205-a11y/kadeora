/**
 * serviceKey 정규화 (PV-2).
 *
 * 이 판정이 틀리면 «401 이 아니라 0건» 으로 나타난다 — 크론은 성공으로 기록되고
 * 아무도 모른다. 그래서 두 형태가 «같은 값으로 수렴하는지» 를 테스트로 잠근다.
 */
import { describe, expect, it } from 'vitest';
import { buildDataGoKrUrl, normalizeServiceKey } from '@/lib/cron/data-go-kr-key';

// data.go.kr 인증키의 실제 문자집합(base64)을 본뜬 값. 실제 키가 아니다.
const DECODING = 'aB3+xY9/zQ7w==';
const ENCODING = 'aB3%2BxY9%2FzQ7w%3D%3D';

describe('normalizeServiceKey', () => {
  it('Decoding 키와 Encoding 키가 «같은 값» 으로 수렴한다', () => {
    expect(normalizeServiceKey(DECODING)).toBe(ENCODING);
    expect(normalizeServiceKey(ENCODING)).toBe(ENCODING);
  });

  it('멱등이다 — 두 번 걸어도 %25 로 부풀지 않는다', () => {
    const once = normalizeServiceKey(DECODING);
    expect(normalizeServiceKey(once)).toBe(once);
    expect(once).not.toContain('%25');
  });

  it('앞뒤 공백을 지운다 — env 에 줄바꿈이 섞여 들어오는 일이 잦다', () => {
    expect(normalizeServiceKey(`  ${ENCODING}\n`)).toBe(ENCODING);
  });

  it('빈 값은 빈 문자열이다 — 「키 없음」을 호출부가 판정할 수 있어야 한다', () => {
    expect(normalizeServiceKey(undefined)).toBe('');
    expect(normalizeServiceKey(null)).toBe('');
    expect(normalizeServiceKey('   ')).toBe('');
  });

  it('escape 가 아닌 % 가 있어도 던지지 않는다 (decode 실패 경로)', () => {
    expect(normalizeServiceKey('abc%zz')).toBe('abc%25zz');
  });
});

describe('buildDataGoKrUrl', () => {
  it('serviceKey 는 «다시 감기지 않는다»', () => {
    const url = buildDataGoKrUrl('https://x/y', ENCODING, { sigunguCd: '26350' });
    expect(url).toBe(`https://x/y?serviceKey=${ENCODING}&sigunguCd=26350`);
    expect(url).not.toContain('%252B');
  });

  it('undefined·빈 파라미터는 «붙지 않는다» — 빈 값을 보내면 스펙 위반이 된다', () => {
    const url = buildDataGoKrUrl('https://x/y', 'K', { a: 1, b: undefined, c: '' });
    expect(url).toBe('https://x/y?serviceKey=K&a=1');
  });

  it('파라미터가 없으면 serviceKey 만 남는다', () => {
    expect(buildDataGoKrUrl('https://x/y', 'K', {})).toBe('https://x/y?serviceKey=K');
  });
});

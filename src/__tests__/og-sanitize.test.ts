/**
 * FINAL_HC_20260913 C-3 — og 폰트 밖 글자 필터.
 * s270(U+25CF) 의 형제로 U+FFFD 가 들어왔다. 화이트리스트가 이미 걷지만,
 * og-apt 폴백은 slug «원문» 을 렌더해 이 함수를 우회하고 있었다. 회귀 고정용.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeForOG } from '@/lib/og-sanitize';

describe('sanitizeForOG', () => {
  it('U+FFFD(깨진 퍼센트 디코드 잔해)를 걷는다', () => {
    expect(sanitizeForOG('래미안�원베일리')).toBe('래미안원베일리');
  });

  it('깨진 인코딩 slug 를 decode 한 결과도 폰트 안 글자만 남는다', () => {
    const broken = new TextDecoder().decode(new Uint8Array([0xeb, 0x9e, 0x98, 0xeb, 0x9e])); // '래' + 잘린 바이트
    expect(sanitizeForOG(`slug=${broken}`)).toBe('slug=래');
  });

  it('U+25CF(s270) 도 여전히 걷는다', () => {
    expect(sanitizeForOG('●분양')).toBe('분양');
  });
});

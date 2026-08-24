// V18 A — slug 생성 규칙 회귀 테스트.
//
// 중복 256쌍의 원인이 "규칙이 두 벌" 이었다. 규칙을 한 곳으로 모았으니
// **두 규칙이 각각 무엇을 하는지** 고정해 둔다.
//
// ⚠️ 기존 slug 를 바꾸는 변경은 이 테스트가 막는다 —
//    색인이 걸려 있고 apt_site_merges 301 맵도 기존 값 기준이다.

import { describe, expect, it } from 'vitest';
import { generateAptSlug, generateAptSlugStrict, isDegradedSlug } from '@/lib/apt-slug';

describe('generateAptSlug — 느슨한 규칙 (기존 데이터 호환)', () => {
  it('공백은 하이픈, 영문은 소문자로 보존한다', () => {
    // 영문 토막을 지우던 규칙이 `---아이파크포레` 를 만들었다. 지우지 않는다.
    expect(generateAptSlug('DMC SK VIEW 아이파크포레')).toBe('dmc-sk-view-아이파크포레');
  });

  it('연속 공백도 하이픈 하나가 된다', () => {
    expect(generateAptSlug('힐스테이트   황성')).toBe('힐스테이트-황성');
  });

  it('한글·영숫자·밑줄·하이픈 외에는 지운다', () => {
    expect(generateAptSlug('e편한세상(가평)퍼스트원!')).toBe('e편한세상가평퍼스트원');
  });

  it('빈 값은 빈 문자열', () => {
    expect(generateAptSlug('')).toBe('');
    expect(generateAptSlug('   ')).toBe('');
  });

  it('⚠️ 하이픈 주변 공백에서 연속 하이픈이 생긴다 — 알고도 두는 동작이다', () => {
    // sync-apt-sites 가 이 값으로 **기존 행을 조회**하므로 바꾸면 매칭이 어긋난다.
    expect(generateAptSlug('e편한세상 - 가평')).toBe('e편한세상---가평');
    expect(isDegradedSlug(generateAptSlug('e편한세상 - 가평'))).toBe(true);
  });
});

describe('generateAptSlugStrict — 새 레코드 전용', () => {
  it('연속 하이픈을 하나로 접는다', () => {
    expect(generateAptSlugStrict('e편한세상 - 가평')).toBe('e편한세상-가평');
  });

  it('앞뒤 하이픈을 뗀다', () => {
    expect(generateAptSlugStrict(' - 아이파크포레 - ')).toBe('아이파크포레');
  });

  it('멀쩡한 이름은 느슨한 규칙과 같은 결과다', () => {
    for (const n of ['DMC SK VIEW 아이파크포레', '힐스테이트 황성', '범천1-1구역']) {
      expect(generateAptSlugStrict(n)).toBe(generateAptSlug(n));
    }
  });

  it('결과가 깨진 형태로 남지 않는다', () => {
    for (const n of ['- - -', 'A - B - C', '  -힐스테이트-  ']) {
      const s = generateAptSlugStrict(n);
      if (s) expect(isDegradedSlug(s)).toBe(false);
    }
  });
});

describe('isDegradedSlug', () => {
  it('앞·뒤·연속 하이픈을 잡는다', () => {
    expect(isDegradedSlug('---아이파크포레')).toBe(true);
    expect(isDegradedSlug('시화--파라곤')).toBe(true);
    expect(isDegradedSlug('중촌--')).toBe(true);
  });
  it('멀쩡한 slug 는 통과', () => {
    expect(isDegradedSlug('dmc센트럴자이')).toBe(false);
    expect(isDegradedSlug('sh-마곡지구-9단지')).toBe(false);
  });
});

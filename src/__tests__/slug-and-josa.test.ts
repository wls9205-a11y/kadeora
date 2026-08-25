// slug 구분기호 규칙 · 중복 판정 키 · 조사 처리 자물쇠.
//
// ⚠️ 중복 14쌍(2026-08-25 정리)이 **규칙이 두 갈래였던** 결과다.
//    같은 이름에서 두 형태가 나왔다:
//      광안동-부흥-부광-소규모재건축  /  광안동-부흥부광-소규모재건축
//      남천2-3-삼익비치-재건축        /  남천2-3삼익비치-재건축
//    한쪽으로 못 박고 테스트로 잠근다. 안 그러면 신규 등록에서 또 생긴다.

import { describe, it, expect } from 'vitest';
import { generateAptSlug, generateAptSlugStrict, slugDupKey } from '@/lib/apt-slug';
import { hasFinalConsonant, josa, withJosa } from '@/lib/ko/josa';
import { anchorPool, rotateAnchor } from '@/lib/blog/anchor';

describe('generateAptSlugStrict — 구분기호는 지운다, 하이픈으로 바꾸지 않는다', () => {
  // ⚠️ 실측 근거: 특수문자가 든 활성 현장 670건 중 지우는 형태 412 : 바꾸는 형태 30.
  //    규칙을 뒤집으면 412건이 재동기화 때 쌍둥이가 된다.
  it('가운뎃점을 지운다', () => {
    expect(generateAptSlugStrict('광안동 부흥·부광 소규모재건축')).toBe('광안동-부흥부광-소규모재건축');
  });

  it('괄호를 지운다 — 안의 글자는 앞말에 붙는다', () => {
    expect(generateAptSlugStrict('남천2-3(삼익비치) 재건축')).toBe('남천2-3삼익비치-재건축');
  });

  it('쉼표를 지운다', () => {
    expect(generateAptSlugStrict('구서동(금화,산호,삼산) 소규모재건축')).toBe(
      '구서동금화산호삼산-소규모재건축',
    );
  });

  it('공백만 하이픈이 된다', () => {
    expect(generateAptSlugStrict('e편한세상 검단 웰카운티(국민주택)')).toBe(
      'e편한세상-검단-웰카운티국민주택',
    );
  });

  it('영문은 소문자로 보존한다 — 지우지 않는다', () => {
    expect(generateAptSlugStrict('DMC SK VIEW 아이파크포레')).toBe('dmc-sk-view-아이파크포레');
  });

  it('연속·앞뒤 하이픈을 정리한다', () => {
    expect(generateAptSlugStrict('e편한세상 - 가평')).toBe('e편한세상-가평');
    expect(generateAptSlug('e편한세상 - 가평')).toBe('e편한세상---가평'); // 느슨한 쪽은 그대로 둔다
  });
});

describe('slugDupKey — 하이픈 위치가 달라도 같은 현장으로 본다', () => {
  // 두 파이프라인(청약 동기화 · 정비사업 승격)의 차이가 하이픈뿐이라는 실측에 기댄다.
  const pairs: [string, string][] = [
    ['광안동-부흥-부광-소규모재건축', '광안동-부흥부광-소규모재건축'],
    ['남천2-3-삼익비치-재건축', '남천2-3삼익비치-재건축'],
    ['구서동-금화-산호-삼산-소규모재건축', '구서동금화산호삼산-소규모재건축'],
  ];

  it.each(pairs)('%s ←→ %s', (a, b) => {
    expect(slugDupKey(a)).toBe(slugDupKey(b));
  });

  it('이름에서 뽑아도 같은 키가 나온다', () => {
    expect(slugDupKey('남천2-3(삼익비치) 재건축')).toBe(slugDupKey('남천2-3-삼익비치-재건축'));
  });

  it('다른 현장까지 같게 만들지는 않는다', () => {
    expect(slugDupKey('반여3-재건축')).not.toBe(slugDupKey('반여4-재건축'));
    expect(slugDupKey('재송2-재건축')).not.toBe(slugDupKey('재송5-재건축'));
  });
});

describe('josa — 받침에 따라 조사를 고른다', () => {
  it('실제로 틀렸던 문장', () => {
    // 「한국토지주택공사이 참여하고」 가 그대로 나갔다.
    expect(withJosa('한국토지주택공사', '이/가')).toBe('한국토지주택공사가');
    expect(withJosa('포스코이앤씨', '이/가')).toBe('포스코이앤씨가');
  });

  it('받침 있는 이름', () => {
    expect(withJosa('현대건설', '이/가')).toBe('현대건설이');
    expect(withJosa('롯데건설', '은/는')).toBe('롯데건설은');
  });

  it('받침 없는 이름', () => {
    expect(withJosa('대우', '이/가')).toBe('대우가');
    expect(josa('삼성물산', '으로/로')).toBe('으로');
    expect(josa('현대', '으로/로')).toBe('로');
  });

  it('한글이 아니면 판정하지 않는다 — 지어내지 않고 받침 쪽으로 떨어진다', () => {
    expect(hasFinalConsonant('SK')).toBeNull();
    expect(hasFinalConsonant('')).toBeNull();
    expect(josa('SK', '이/가')).toBe('이');
  });
});

describe('anchorPool — 시공사명이 든 변형을 앵커로 쓰지 않는다', () => {
  it('실제로 나갔던 앵커', () => {
    // `- [동구 대우건설](/apt/부산-수정5-재개발)` — 길이 기준만으로는 안 걸린다.
    const pool = anchorPool(
      '부산 수정5 재개발',
      ['동구 대우건설', '부산 수정5 재개발', '부산수정5재개발', '부산 수정5구역'],
      '대우건설',
    );
    expect(pool).not.toContain('동구 대우건설');
    expect(pool).toContain('부산수정5재개발');
  });

  it('시공사가 여럿이면 전부 뺀다', () => {
    const pool = anchorPool(
      '부산 동구 초량2 재개발',
      ['동구 SK', '동구 현대건설 초량', '초량2 재개발', '초량2재개발'],
      'SK, 현대건설',
    );
    expect(pool.some((v) => v.includes('현대건설'))).toBe(false);
  });

  it('(주) 접두어가 붙어 있어도 알아본다', () => {
    const pool = anchorPool(
      '부산 해운대구 반여4 재건축',
      ['해운대 DL이앤씨', '반여4 재건축', '반여4재건축'],
      '(주)DL이앤씨',
    );
    expect(pool).not.toContain('해운대 DL이앤씨');
  });

  it('⚠️ 현장 이름에 시공사가 들어있으면 빼지 않는다 — 앵커가 하나로 줄어든다', () => {
    const pool = anchorPool(
      '해운대 아이파크',
      ['해운대 아이파크', '해운대아이파크'],
      '아이파크',
    );
    expect(pool).toContain('해운대아이파크');
    expect(pool.length).toBeGreaterThan(1);
  });

  it('builder 를 안 넘기면 예전대로 동작한다', () => {
    expect(rotateAnchor('창원 의창 푸르지오', ['창원의창푸르지오', '창원'], 1)).toBe('창원의창푸르지오');
  });
});

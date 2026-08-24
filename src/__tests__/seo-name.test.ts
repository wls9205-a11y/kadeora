// ONESHOT §B-5 — 표시 이름 · 지역 중복 회귀 테스트.
//
// 지키려는 것 둘.
//   ① **지역이 두 번 찍히지 않는다.** 실측 344건이 `울산 남구 울산 남구 달동 재개발` 이었다.
//   ② **display_name 이 없으면 지어내지 않는다.** name 을 그대로 쓴다.

import { describe, expect, it } from 'vitest';
import { displayNameOf, regionPrefix, regionedName, regionSuffix, stripDupRegionPrefix, swapLeadingName } from '@/lib/apt/seo-name';

describe('displayNameOf', () => {
  it('display_name 이 있으면 그걸 쓴다', () => {
    expect(displayNameOf('서울 동작구 흑석9구역 재개발', '흑석9구역 재개발')).toBe('서울 동작구 흑석9구역 재개발');
  });
  it('없거나 비면 name 을 쓴다 — 지어내지 않는다', () => {
    expect(displayNameOf(null, '흑석9구역 재개발')).toBe('흑석9구역 재개발');
    expect(displayNameOf('   ', '흑석9구역 재개발')).toBe('흑석9구역 재개발');
  });
});

describe('regionPrefix — 이미 들어 있으면 붙이지 않는다', () => {
  it('시·도로 시작하면 접두사 없음', () => {
    expect(regionPrefix('울산 남구 달동 재개발', '울산', '남구')).toBe('');
    expect(regionPrefix('경남 창원 회원1 재개발', '경남', '창원시')).toBe('');
  });
  it('시군구로 시작하면 시·도만', () => {
    expect(regionPrefix('남구 달동 재개발', '울산', '남구')).toBe('울산');
  });
  it('둘 다 없으면 전부 붙인다', () => {
    expect(regionPrefix('흑석9구역 재개발', '서울', '동작구')).toBe('서울 동작구');
  });
  it('지역 값이 없어도 깨지지 않는다', () => {
    expect(regionedName('흑석9구역 재개발', null, null)).toBe('흑석9구역 재개발');
  });
});

describe('regionedName', () => {
  it('실측 사례 — 지역이 한 번만 나온다', () => {
    const out = regionedName('울산 남구 달동 재개발', '울산', '남구');
    expect(out).toBe('울산 남구 달동 재개발');
    expect(out.match(/울산/g)!.length).toBe(1);
  });
});

describe('stripDupRegionPrefix — 저장된 설명의 앞머리 중복만 걷어낸다', () => {
  it('실측 사례를 고친다', () => {
    expect(stripDupRegionPrefix('울산 남구 울산 남구 달동 재개발. 분양가, 청약 일정.', '울산', '남구'))
      .toBe('울산 남구 달동 재개발. 분양가, 청약 일정.');
  });
  it('중복이 아니면 손대지 않는다', () => {
    const ok = '서울 동작구 흑석9구역 재개발 — 시공사: DL이앤씨. 분양가.';
    expect(stripDupRegionPrefix(ok, '서울', '동작구')).toBe(ok);
  });
  it('본문은 건드리지 않는다 — 뒤쪽에 지역이 또 나와도 그대로', () => {
    const t = '서울 동작구 흑석9구역. 서울 지하철 9호선.';
    expect(stripDupRegionPrefix(t, '서울', '동작구')).toBe(t);
  });
  it('지역 값이 없으면 그대로', () => {
    expect(stripDupRegionPrefix('아무 설명', null, null)).toBe('아무 설명');
  });
});

describe('regionSuffix — 타이틀 양끝에 지역이 찍히지 않는다', () => {
  it('앞머리에 이미 있으면 꼬리를 안 붙인다', () => {
    expect(regionSuffix('울산 남구 달동 재개발 분양정보', '울산')).toBe('');
  });
  it('없으면 붙인다', () => {
    expect(regionSuffix('흑석9구역 재개발 분양정보', '서울')).toBe(' — 서울');
  });
});

describe('swapLeadingName — 꼬리를 잃지 않는다', () => {
  const TAIL = ' 분양정보 — 분양가·청약일정·입주시기 2026';
  it('앞머리 이름만 갈아끼우고 꼬리는 남긴다', () => {
    expect(swapLeadingName('흑석9구역 재개발' + TAIL, '흑석9구역 재개발', '서울 동작구 흑석9구역 재개발'))
      .toBe('서울 동작구 흑석9구역 재개발' + TAIL);
  });
  it('표시 이름이 같으면 손대지 않는다', () => {
    const t = '울산 남구 달동 재개발' + TAIL;
    expect(swapLeadingName(t, '울산 남구 달동 재개발', '울산 남구 달동 재개발')).toBe(t);
  });
  it('직접 손본 제목(앞머리가 name 이 아님)은 손대지 않는다', () => {
    const t = '2026년 흑석9구역 청약 총정리';
    expect(swapLeadingName(t, '흑석9구역 재개발', '서울 동작구 흑석9구역 재개발')).toBe(t);
  });
});

// H4-1 (c)(d) 자물쇠 — 칩 소스와 라벨이 «같이» 움직이는지.
//
// 이 파일이 잠그는 건 하나다: 칩에 들어간 현장의 «성격» 과 라벨이 어긋나지 않는 것.
// 「인기」 없는 순위를 만들어 붙이던 문제(H3-3)와 같은 종류의 회귀를 막는다.

import { describe, it, expect } from 'vitest';
import {
  buildHomeChips,
  pickChipNames,
  CHIP_LABEL_CURATED,
  CHIP_LABEL_MOVES,
  CHIP_LIMIT,
} from '@/lib/home/chips';

describe('pickChipNames', () => {
  it('2~16자만 남긴다 — 넘으면 검색창에서 잘린다', () => {
    const out = pickChipNames([
      '해링턴 마레',                                   // 6
      '엄궁역 트라비스 하늘채',                          // 12
      '울산 다운2지구 우미린 더 시그니처 본청약',           // 23 → 탈락
      '가',                                            // 1 → 탈락
    ]);
    expect(out).toEqual(['해링턴 마레', '엄궁역 트라비스 하늘채']);
  });

  it('공백을 정규화하고 중복·빈값을 버린다', () => {
    expect(pickChipNames(['해링턴  마레', '해링턴 마레', null, undefined, '   ']))
      .toEqual(['해링턴 마레']);
  });
});

describe('buildHomeChips — 라벨은 소스를 따라간다', () => {
  const curated = ['두산위브더제니스 대연', '온천장 하늘채 엘리시움', '해링턴 마레', '엄궁역 트라비스 하늘채'];
  const moves = ['센트레빌 아스테리움 거제', '포레나힐스테이트 진주', '더샵 트리센트'];

  it('큐레이션이 있으면 큐레이션만 쓰고 「지금 계약 가능한 현장」', () => {
    const r = buildHomeChips({ curated, moves });
    expect(r.names).toEqual(curated);
    expect(r.label).toBe(CHIP_LABEL_CURATED);
  });

  it('**두 소스를 섞지 않는다** — 5개에 모자라도 최근 움직임을 끼워 넣지 않는다', () => {
    const r = buildHomeChips({ curated, moves });
    expect(r.names.length).toBe(4);            // limit 5 인데 4개
    for (const m of moves) expect(r.names).not.toContain(m);
  });

  it('큐레이션이 0이면 최근 움직인 현장으로 «통째로» 바뀌고 라벨도 같이 바뀐다', () => {
    const r = buildHomeChips({ curated: [], moves });
    expect(r.names).toEqual(moves);
    expect(r.label).toBe(CHIP_LABEL_MOVES);
  });

  it('둘 다 없으면 이름도 라벨도 비운다 — 호출부가 줄을 통째로 미렌더한다', () => {
    const r = buildHomeChips({ curated: [], moves: [] });
    expect(r.names).toEqual([]);
    expect(r.label).toBe('');
  });

  it('길이 미달로 전부 걸러지면 다음 소스로 내려간다', () => {
    const r = buildHomeChips({ curated: ['가', '울산 다운2지구 우미린 더 시그니처 본청약'], moves });
    expect(r.label).toBe(CHIP_LABEL_MOVES);
  });

  it('상한을 넘기지 않는다', () => {
    const many = ['가나', '다라', '마바', '사아', '자차', '카타', '파하'];
    expect(buildHomeChips({ curated: many, moves: [] }).names.length).toBe(CHIP_LIMIT);
  });
});

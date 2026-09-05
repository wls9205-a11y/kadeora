/**
 * PV2-B1·B4 — «구역 토큰» 축 수용 게이트 (2026-09-05).
 *
 * ── 이 파일이 지키는 것 ────────────────────────────────────────────────────
 * 미매칭 인허가 70건의 다수는 «못 찾은 것» 이 아니라 «후보에 오르지도 못한» 것이었다.
 * 후보를 법정동 색인 하나로만 뽑았는데, 부울경 공고 전 활성 현장 346 중 306(88%)이
 * `dong` 결측이고 그 현장들의 `address` 는 조합 사무실이라 `extractDong` 도 실패한다.
 *
 * 아래 픽스처는 전부 2026-09-05 DB 실물이다(이름·세대수·주소 그대로).
 * ⛔ 「살아야 하는 것」을 같이 잰다 — 한쪽만 재면 과잉 매칭을 못 잡는다.
 */
import { describe, expect, it } from 'vitest';
import {
  extractZoneTokens, judgeMatch, parseJibun, zoneTokenShared,
  type PermitFact, type SiteFact,
} from '@/lib/permits/match';

const site = (o: Partial<SiteFact> & { id: string; names: string[] }): SiteFact => ({
  address: null, units: null, sigungu: null, ...o,
});

// ── 실물 현장 (apt_sites · dong 전부 결측) ──────────────────────────────────
const S = {
  대연8: site({ id: 's-대연8', names: ['대연8 재개발', '부산 남구 대연8 재개발'], units: 3312, sigungu: '남구', address: '석포로 76, 7층 (대연동)' }),
  부곡2: site({ id: 's-부곡2', names: ['부곡2 재개발', '부산 금정구 부곡2 재개발'], units: 1968, sigungu: '금정구', address: '가마실로 19, 2층' }),
  용호2: site({ id: 's-용호2', names: ['용호2 재개발', '부산 남구 용호2 재개발'], units: 1041, sigungu: '남구', address: '용호로 99, 3층(용호동)' }),
  남천2: site({ id: 's-남천2', names: ['남천2 재개발', '부산 수영구 남천2 재개발'], units: 975, sigungu: '수영구', address: '황령대로 489번길 22(남천동)' }),
  광안A: site({ id: 's-광안A', names: ['광안A 재개발', '부산 수영구 광안A 재개발'], units: 2780, sigungu: '수영구', address: '연수로 375, 보광빌딩3층' }),
  서금사6: site({ id: 's-서금사6', names: ['서금사재정비촉진6구역 재개발'], units: 2543, sigungu: '수영구', address: '서동로 129, 3층' }),
  범천4: site({ id: 's-범천4', names: ['범천4 재개발', '부산진구 범천4 재개발'], units: 2370, sigungu: '부산진구', address: '범천동 1269-15' }),
  중동5: site({ id: 's-중동5', names: ['중동5 재개발'], units: 1149, sigungu: '해운대구', address: '부산광역시 해운대구 중동 785-8번지, 1층' }),
  복산1: site({ id: 's-복산1', names: ['복산1 재개발'], units: 4673, sigungu: '동래구', address: '동래구 칠산동246번지 일원' }),
  가야1: site({ id: 's-가야1', names: ['가야1 재개발', '더 다이너스티 가야'], units: 1943, sigungu: '부산진구', address: '가야동 410번지 일원(가야초교 남측 일원)' }),
  괴정5: site({ id: 's-괴정5', names: ['괴정5(시범생활권) 재개발'], units: 3509, sigungu: '사하구', address: '괴정 571-1번지 일원' }),
  // ⚠️ 이 둘은 «구역명이 아니라 브랜드명» 으로 들어와 있다. 연결고리는 지번이다.
  회원2: site({ id: 's-회원2', names: ['창원 한신더휴 메가센텀'], units: 1139, sigungu: '창원시', address: '경상남도 창원시 마산회원구 회원동 480-31번지 일대' }),
  진주이현: site({ id: 's-진주이현', names: ['포레나힐스테이트 진주'], units: 398, sigungu: '진주시', address: '경상남도 진주시 이현동 10-1번지 외 13필지' }),
  // 살아야 하는 이웃들 — 같은 동의 «다른» 구역이다. 붙으면 안 된다.
  광안5: site({ id: 's-광안5', names: ['광안5 재개발'], units: 2058, sigungu: '수영구', address: null }),
  남천2_3: site({ id: 's-남천2-3', names: ['남천2-3(삼익비치) 재건축', '그랑자이 더 비치'], units: 3325, sigungu: '수영구', address: '남천동로82 반도빌딩 3층' }),
};
const ALL = Object.values(S);

const permit = (o: Partial<PermitFact>): PermitFact => ({ ...o });

describe('PV2-B1 — 구역 토큰 추출', () => {
  it('동명+번호+구역·재개발 표기를 같은 키로 떨어뜨린다', () => {
    const a = extractZoneTokens('대연8구역재개발공동주택');
    const b = extractZoneTokens('대연8 재개발');
    expect(a.some((t) => b.includes(t))).toBe(true);
  });

  it('가운뎃점·접두 길이가 달라도 만난다 — 「서·금사 재정비촉진6구역」 ↔ 「서금사재정비촉진6구역」', () => {
    const a = extractZoneTokens('부산광역시 서·금사 재정비촉진6구역 주택재개발 정비사업');
    const b = extractZoneTokens('서금사재정비촉진6구역 재개발');
    expect(a.some((t) => b.includes(t))).toBe(true);
  });

  it('머리 토큰 — 번호 뒤 괄호 설명이 끼어도 잡는다(「괴정5(시범생활권) 재개발」)', () => {
    const a = extractZoneTokens('괴정5구역 주택재개발 정비사업');
    const b = extractZoneTokens('괴정5(시범생활권) 재개발');
    expect(a.some((t) => b.includes(t))).toBe(true);
  });

  it('⛔ 번호가 «없는» 구역명은 토큰을 내지 않는다 — 같은 구의 여러 사업을 뭉갠다', () => {
    expect(extractZoneTokens('반월구역 재개발 공동주택')).toHaveLength(0);
    expect(extractZoneTokens('문화구역 재개발정비사업')).toHaveLength(0);
  });

  it('⛔ 번호가 다르면 남남이다', () => {
    const a = extractZoneTokens('광안5 재개발');
    const b = extractZoneTokens('광안A 재개발사업 정비구역 공동주택 신축공사');
    expect(a.some((t) => b.includes(t))).toBe(false);
  });
});

describe('PV2-B1 — 지번 꼬리 허용', () => {
  it('「번지 일대」·「번지 외 13필지」를 털고 같은 지번으로 읽는다', () => {
    expect(parseJibun('경상남도 창원시 마산회원구 회원동 480-31번지 일대'))
      .toEqual(parseJibun('경상남도 창원시 마산회원구 회원동 480-31번지'));
    expect(parseJibun('경상남도 진주시 이현동 10-1번지 외 13필지'))
      .toEqual(parseJibun('경상남도 진주시 이현동 10-1번지'));
  });

  it('동과 번지 사이 공백이 없어도 읽는다(「칠산동246번지」)', () => {
    expect(parseJibun('동래구 칠산동246번지 일원')?.bon).toBe(246);
  });

  it('⛔ 지번 자체는 느슨해지지 않는다 — 본번이 다르면 다른 땅이다', () => {
    expect(parseJibun('부산 남구 대연동 1173-2번지')).not.toEqual(parseJibun('부산 남구 대연동 1173-3번지'));
  });
});

// ── 수용 게이트 — 13건은 이 축이 잇는다. 14번째(서금사5)는 아래에 따로 기록. ──
const ACCEPT: Array<[string, PermitFact]> = [
  ['회원2', permit({ sigungu: '창원시', name: '회원2구역 주택재개발 정비사업', units: 2103, address: '경상남도 창원시 마산회원구 회원동 480-31번지' })],
  ['남천2', permit({ sigungu: '수영구', name: '남천2구역(비치아파트)', units: 3060, address: '부산광역시 수영구 남천동 148-4번지' })],
  ['용호2', permit({ sigungu: '남구', name: '용호2구역재개발정비사업 공동주택', units: 1041, address: '부산광역시 남구 용호동 434번지' })],
  ['광안A', permit({ sigungu: '수영구', name: '광안A 재개발사업 정비구역 공동주택 신축공사', units: 2550, address: '부산광역시 수영구 망미동 800-1번지' })],
  ['서금사6', permit({ sigungu: '수영구', name: '부산광역시 서·금사 재정비촉진6구역 주택재개발 정비사업', units: 2543, address: '부산광역시 금정구 서동 302-1204번지' })],
  ['부곡2', permit({ sigungu: '금정구', name: '부곡2구역 재개발 정비사업 1단지', units: 1924, address: '부산광역시 금정구 부곡동 624번지' })],
  ['대연8', permit({ sigungu: '남구', name: '대연8구역재개발공동주택', units: 1674, address: '부산광역시 남구 대연동 1173-2번지' })],
  ['범천4', permit({ sigungu: '부산진구', name: '범천4 재개발 (Ⅰ-1)', units: 1546, address: '부산광역시 부산진구 범천동 1269-15번지' })],
  ['중동5', permit({ sigungu: '해운대구', name: '중동5구역 재개발 정비사업 (1단지)', units: 972, address: '부산광역시 해운대구 중동 785-8번지' })],
  ['복산1', permit({ sigungu: '동래구', name: '복산1구역재개발정비사업(5BL)', units: 1645, address: '부산광역시 동래구 칠산동 246번지' })],
  ['괴정5', permit({ sigungu: '사하구', name: '괴정5구역주택재개발정비사업', units: 1683, address: '부산광역시 사하구 괴정동 550-1번지' })],
  ['가야1', permit({ sigungu: '부산진구', name: '가야1 재개발', units: 935, address: '부산광역시 부산진구 가야동 410번지' })],
  ['진주이현', permit({ sigungu: '진주시', name: '진주 이현 주공 재건축아파트', units: 1032, address: '경상남도 진주시 이현동 10-1번지' })],
];

describe('PV2 수용 게이트 — 14건이 후보에 오르고 판정을 받는다', () => {
  for (const [label, p] of ACCEPT) {
    it(`${label} — unmatched 가 아니다`, () => {
      const v = judgeMatch(p, ALL);
      expect(v.status).not.toBe('unmatched');
    });
  }

  it('세대수가 함께 서면 확정으로 올라간다 (B-4 units_zone)', () => {
    // 용호2: 인허가 1041 ↔ 현장 1041
    const v = judgeMatch(ACCEPT.find(([l]) => l === '용호2')![1], ALL);
    expect(v.status).toBe('matched');
    expect(v.siteId).toBe('s-용호2');
  });

  it('구역이 블록으로 쪼개져 세대수가 어긋나면 확정하지 않는다 (zone_only review)', () => {
    // 남천2: 인허가 3060(비치아파트) ↔ 현장 975 — 토큰만 같다
    const v = judgeMatch(ACCEPT.find(([l]) => l === '남천2')![1], ALL);
    expect(v.status).toBe('review');
  });

  it('브랜드명뿐인 현장도 지번이 같으면 붙는다 (회원2 · 진주 이현)', () => {
    expect(judgeMatch(ACCEPT.find(([l]) => l === '회원2')![1], ALL).siteId).toBe('s-회원2');
    expect(judgeMatch(ACCEPT.find(([l]) => l === '진주이현')![1], ALL).siteId).toBe('s-진주이현');
  });
});

/**
 * ⚠️ 영구 등재 — 2026-09-05 실측. 수용 목록 14건 중 «서금사5» 만 이 축으로 못 잇는다.
 *    현장 「서금사재정비촉진5구역 재개발」(3802세대)의 `sigungu` 가 **NULL** 이라
 *    구역 토큰 색인에 아예 실리지 않는다(부산 활성 정비사업 현장 36건이 같은 상태).
 *    ⛔ 그렇다고 시군구 없이 토큰만으로 열지 «않는다» — 「대연8」은 남구 안에서만 유일하다.
 *    이 건은 코드가 아니라 «데이터» 로 닫는다(B-2 백필 · sigungu 채움).
 *    참고: 운영에서는 이미 법정동(서동) 축으로 review 상태다 — 게이트는 그쪽이 통과시킨다.
 */
describe('서금사5 — 이 축이 «못» 잇는 자리를 기록한다', () => {
  const 서금사5_현장_sigungu없음: SiteFact = site({
    id: 's-서금사5', names: ['서금사재정비촉진5구역 재개발'], units: 3802, sigungu: null,
    address: '서명로 15-1, 3층',
  });
  const p = permit({ sigungu: '금정구', name: '부산 서금사 재정비촉진5구역 5-1BL 재개발사업', units: 1976, address: '부산광역시 금정구 서동 산557-16번지' });

  it('토큰은 «공유한다» — 못 잇는 이유가 이름이 아님을 못박는다', () => {
    const a = extractZoneTokens(p.name);
    const b = extractZoneTokens('서금사재정비촉진5구역 재개발');
    expect(a.some((t) => b.includes(t))).toBe(true);
  });

  it('그런데 sigungu 가 없어 후보가 되지 못한다', () => {
    expect(judgeMatch(p, [서금사5_현장_sigungu없음]).status).toBe('unmatched');
  });

  it('sigungu 만 채우면 즉시 이어진다 — 백필이 답이라는 증거', () => {
    const fixed = { ...서금사5_현장_sigungu없음, sigungu: '금정구' };
    expect(judgeMatch(p, [fixed]).status).not.toBe('unmatched');
  });
});

describe('⛔ 과잉 매칭 — 붙으면 안 되는 것들', () => {
  it('시군구가 다르면 토큰이 같아도 후보가 아니다', () => {
    const other = site({ id: 's-타구-대연8', names: ['대연8 재개발'], units: 3312, sigungu: '해운대구' });
    expect(zoneTokenShared(permit({ sigungu: '남구', name: '대연8구역재개발공동주택' }), other)).toBe(true);
    // 판정에서는 sameSigungu 가 막는다
    const v = judgeMatch(permit({ sigungu: '남구', name: '대연8구역재개발공동주택', units: 3312 }), [other]);
    expect(v.status).toBe('unmatched');
  });

  it('같은 동의 다른 번호 구역에 붙지 않는다 (광안A ↛ 광안5)', () => {
    const v = judgeMatch(ACCEPT.find(([l]) => l === '광안A')![1], [S.광안5]);
    expect(v.status).toBe('unmatched');
  });

  it('번호 없는 구역명은 아무 데도 붙지 않는다', () => {
    const v = judgeMatch(permit({ sigungu: '창원시', name: '반월구역 재개발 공동주택', units: 1702, address: '경상남도 창원시 마산합포구 반월동 61-1번지' }), ALL);
    expect(v.status).toBe('unmatched');
  });
});

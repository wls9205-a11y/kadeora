/**
 * PV-3a 매칭 판정 (안건 ③·⑤).
 *
 * 이 파일이 지키는 것: «이름만으로는 붙지 않는다».
 * 2026-08-29 게이트가 브랜드 한 조각으로 다른 현장 둘을 잡아 「5/5 통과」로 보고했다.
 * 아래 케이스는 전부 그날의 실측이고, 그 실패가 코드로 다시 들어오지 못하게 잠근다.
 */
import { describe, expect, it } from 'vitest';
import {
  extractDong,
  extractZoneCodes,
  isOutOfWindow,
  jibunEqual,
  judgeMatch,
  nameSupports,
  normalizeName,
  parseJibun,
  sameRegion,
  unitsCloseness,
  type PermitFact,
  type SiteFact,
} from '@/lib/permits/match';

// ── 실측 픽스처 (2026-08-29 permits-candidates.json) ─────────────────────────
/** 아실 명단의 그랑라크. 인허가 원문에는 이 이름이 «없다». */
const GRANDLAC: SiteFact = {
  id: 'site-grandlac',
  address: '울산광역시 남구 야음동',
  names: ['그랑라크 에일린의 뜰', '울산 남구 B-14'],
  units: 1521,
};
/** 인허가 원문 — 구역명으로 온다. */
const B14: PermitFact = {
  address: '울산광역시 남구 야음동 350-5번지',
  name: '울산 남구 B-14 주택재개발 정비사업',
  units: 1521,
  permitDate: '20190628',
};
/** 게이트가 그랑라크로 «잘못» 잡았던 다른 현장. */
const MUNSURO_DAEGONGWON: PermitFact = {
  address: '울산광역시 남구 신정동 1178번지',
  name: '문수로대공원 에일린의 뜰',
  units: 384,
  permitDate: '20200901',
};
/** 같은 동인데 브랜드만 겹치는 다른 현장. */
const EILLIN_1DANJI: PermitFact = {
  address: '울산광역시 남구 야음동 389-49번지',
  name: '울산 남구 야음동 에일린의뜰 1단지 공동주택 신축공사',
  units: 310,
  permitDate: '20211012',
};

describe('지번 파싱', () => {
  it('본번·부번·산을 가른다', () => {
    expect(parseJibun('울산광역시 남구 야음동 350-5번지')).toEqual({ dong: '야음동', san: false, bon: 350, bu: 5 });
    expect(parseJibun('부산광역시 사하구 다대동 37번지')).toEqual({ dong: '다대동', san: false, bon: 37, bu: 0 });
    expect(parseJibun('울산광역시 울주군 삼남읍 교동리 산145번지')).toEqual({ dong: '교동리', san: true, bon: 145, bu: 0 });
  });

  it('«블록형» 주소는 지번이 아니다 — 0 으로 채우지 않는다', () => {
    // 에코델타시티·택지지구는 블록 단위로 허가가 난다. 빈 지번으로 채우면
    // 서로 다른 블록이 «같은 지번» 으로 붙는다.
    expect(parseJibun('부산광역시 강서구 강동동 블록')).toBeNull();
    expect(parseJibun('울산광역시 울주군 범서읍 서사리 블록')).toBeNull();
    expect(parseJibun('부산광역시 수영구 남천동')).toBeNull();
  });

  it('산번지는 «다른 땅» 이다', () => {
    expect(jibunEqual(parseJibun('경남 사천시 용현면 송지리 산25번지'), parseJibun('경남 사천시 용현면 송지리 25번지'))).toBe(false);
  });

  it('동까지만인 주소에서도 법정동을 뽑는다', () => {
    expect(extractDong('울산광역시 남구 야음동')).toBe('야음동');
    expect(extractDong('경상남도 창원시 의창구 북면 무동리 150-1번지')).toBe('무동리');
  });
});

describe('세대수 근접도', () => {
  it('모르면 0 이 아니라 null 이다', () => {
    // 「모르는 것」과 「다른 것」을 섞으면 커버율이 그 순간 거짓말이 된다.
    expect(unitsCloseness(null, 500)).toBeNull();
    expect(unitsCloseness(500, undefined)).toBeNull();
  });
  it('정확일치 1 · ±15% 밖 0', () => {
    expect(unitsCloseness(1521, 1521)).toBe(1);
    expect(unitsCloseness(1521, 384)).toBe(0);
    expect(unitsCloseness(700, 481)).toBe(0);
  });
});

describe('구역 식별자', () => {
  it('B-14 · A3블록 · 27블럭 · 내이3지구를 뽑는다', () => {
    expect(extractZoneCodes('울산 남구 B-14 주택재개발 정비사업')).toContain('B14');
    expect(extractZoneCodes('울산KTX역세권복합특화단지 A3블록 공동주택')).toContain('A3');
    expect(extractZoneCodes('창원 무동지구 27블럭 공동주택 건립공사')).toContain('BL27');
    expect(extractZoneCodes('밀양시 내이3지구 1BL 2롯트')).toContain('내이3지구');
  });
  it('블록 번호가 다르면 겹치지 않는다', () => {
    const a = extractZoneCodes('창원무동지구 14블럭 공동주택');
    const b = extractZoneCodes('창원 무동지구 27블럭 공동주택 건립공사');
    expect(a.some((x) => b.includes(x))).toBe(false);
  });
});

describe('⛔ 이름만으로는 붙지 않는다 — 2026-08-29 실패의 잠금', () => {
  it('브랜드 조각이 겹쳐도 다른 법정동이면 후보조차 아니다', () => {
    const v = judgeMatch(MUNSURO_DAEGONGWON, [GRANDLAC]);
    expect(v.status).toBe('unmatched');
    expect(v.siteId).toBeNull();
  });

  it('같은 법정동 + 브랜드 조각이어도 세대수가 멀면 붙지 않는다', () => {
    // 야음동 에일린의뜰 1단지(310)는 그랑라크(1,521)가 아니다.
    const v = judgeMatch(EILLIN_1DANJI, [GRANDLAC]);
    expect(v.status).toBe('unmatched');
  });

  it('이름만 겹치고 지번·세대수 근거가 없으면 «review» 이지 matched 가 아니다', () => {
    // ⚠️ 「야음동 공동주택」처럼 지역 낱말뿐인 겹침은 근거가 «아니다» — 아래 별도 검사.
    const site: SiteFact = { id: 's', address: '울산광역시 남구 야음동', names: ['대명 루첸'], units: null };
    const p: PermitFact = { address: '울산광역시 남구 야음동 401-1번지', name: '대명 루첸', units: null };
    const v = judgeMatch(p, [site]);
    expect(v.status).toBe('review');
    expect(v.method).toBe('name_only');
  });
});

describe('✅ 지번·세대수가 1순위다 (안건 ⑤)', () => {
  it('세대수 정확일치 단독으로 붙는다 — 이름이 «전혀» 안 겹쳐도', () => {
    // 그랑라크 ↔ B-14. 이름 축으로는 어떤 문자열로도 닿지 않는다.
    expect(nameSupports(B14, GRANDLAC)).toBe(true); // 구역명 B-14 가 variants 에 있어 거든다
    const bare: SiteFact = { ...GRANDLAC, names: ['그랑라크 에일린의 뜰'] };
    expect(nameSupports(B14, bare)).toBe(false); // 이름 근거를 «완전히» 뺀 상태
    const v = judgeMatch(B14, [bare]);
    expect(v.status).toBe('matched');
    expect(v.method).toBe('units_exact');
    expect(v.siteId).toBe('site-grandlac');
  });

  it('지번 정확일치가 최우선이다', () => {
    const site: SiteFact = { id: 'hwajeong', address: '울산광역시 동구 화정동 638-3번지', names: ['화정동 638-3'], units: null };
    const p: PermitFact = { address: '울산광역시 동구 화정동 638-3번지', name: '울산시 동구 화정동 638-3 주거복합단지 신축공사', units: 356 };
    const v = judgeMatch(p, [site]);
    expect(v.status).toBe('matched');
    expect(v.method).toBe('jibun_exact');
  });

  it('지역 낱말만 겹치는 것은 이름 근거가 «아니다» — sameRegion 을 두 번 세지 않는다', () => {
    const site: SiteFact = { id: 's', address: '울산광역시 남구 야음동', names: ['야음동 공동주택'], units: null };
    const p: PermitFact = { address: '울산광역시 남구 야음동 363-2번지', name: '울산 남구 야음동 공동주택', units: null };
    expect(nameSupports(p, site)).toBe(false);
    expect(judgeMatch(p, [site]).status).toBe('unmatched');
  });

  it('세대수 ±15% 단독은 review 로 내린다', () => {
    const site: SiteFact = { id: 'x', address: '경상남도 밀양시 내이동', names: ['밀양 내이동 2차'], units: 640 };
    const p: PermitFact = { address: '경상남도 밀양시 내이동 1196-4번지', name: '밀양 내이동 공동주택 신축공사', units: 705 };
    const v = judgeMatch(p, [site]);
    expect(v.status).toBe('review');
    expect(v.method).toBe('units_only');
  });
});

describe('⛔ 애매하면 고르지 않는다 (a5 원칙 승계)', () => {
  it('matched 후보가 둘이면 전부 review 이고 siteId 는 null 이다', () => {
    const a: SiteFact = { id: 'a', address: '울산광역시 남구 야음동', names: ['가'], units: 1521 };
    const b: SiteFact = { id: 'b', address: '울산광역시 남구 야음동', names: ['나'], units: 1521 };
    const v = judgeMatch(B14, [a, b]);
    expect(v.status).toBe('review');
    expect(v.siteId).toBeNull();
    expect(v.note).toContain('억지로 고르지 않는다');
  });

  it('무동지구 세 블록이 서로를 «오매칭하지 않는다»', () => {
    const site27: SiteFact = { id: 'bl27', address: '경상남도 창원시 의창구 북면 무동리', names: ['창원 무동지구 27블럭'], units: 625 };
    const p14: PermitFact = { address: '경상남도 창원시 의창구 북면 무동리 블록', name: '창원무동지구 14블럭 공동주택', units: 415 };
    expect(judgeMatch(p14, [site27]).status).toBe('unmatched');
    const p27: PermitFact = { address: '경상남도 창원시 의창구 북면 무동리 150-1번지', name: '창원 무동지구 27블럭 공동주택 건립공사', units: 625 };
    expect(judgeMatch(p27, [site27]).method).toBe('units_exact');
  });
});

describe('안건 ③ — 시간창은 «표기» 지 필터가 아니다', () => {
  const asOf = new Date('2026-08-29T00:00:00Z');
  it('36개월 밖을 표시한다', () => {
    expect(isOutOfWindow('19940101', asOf)).toBe(true);
    expect(isOutOfWindow('20050804', asOf)).toBe(true);
  });
  it('창 안은 표시하지 않는다', () => {
    expect(isOutOfWindow('20250627', asOf)).toBe(false);
    expect(isOutOfWindow('20240404', asOf)).toBe(false);
  });
  it('허가일을 모르면 «밖» 이라고 단정하지 않는다', () => {
    expect(isOutOfWindow(null, asOf)).toBe(false);
    expect(isOutOfWindow('', asOf)).toBe(false);
  });
  it('창 밖이어도 매칭 자체는 막지 않는다', () => {
    // 버리면 그 현장이 API 커버에 있었는지조차 모르게 된다.
    expect(judgeMatch(B14, [GRANDLAC]).status).toBe('matched');
    expect(isOutOfWindow(B14.permitDate, asOf)).toBe(true);
  });
});

describe('보조 함수', () => {
  it('정규화가 정비사업·신축공사 꼬리를 턴다', () => {
    expect(normalizeName('명륜2구역 주택재건축정비사업조합')).toBe('명륜2구역');
    expect(normalizeName('울산 옥교동 224번지 일원 주거복합 신축공사')).toBe('울산옥교동224번지일원');
  });
  it('법정동코드가 양쪽에 있으면 그것이 우선이다', () => {
    const p: PermitFact = { bjdCd: '3114010700', address: '울산광역시 남구 야음동 350-5번지' };
    const s: SiteFact = { id: 's', bjdCd: '3114010800', address: '울산광역시 남구 야음동', names: [] };
    expect(sameRegion(p, s)).toBe(false);
  });
});

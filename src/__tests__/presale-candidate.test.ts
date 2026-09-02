import { describe, it, expect } from 'vitest';
import {
  adBlockedFor, isKnownRegion, isProvisional, judgeSupplyType, normName,
  isSameArea, isSameSiteHint, provisionalSlug, seedGate, similarKey, stripProvisional,
  type CandidateFact,
} from '@/lib/presale/candidate';
import { htmlToText, validateCards } from '@/lib/presale/extract';
import type { PresaleSource } from '@/lib/builder-sites/presale-registry';

const SRC: PresaleSource = {
  key: 'desian:presale', builder: '태영건설', brand: '데시앙',
  label: '태영 데시앙 분양예정',
  listUrl: 'https://www.desian.co.kr/web/complex/preSale',
  kind: 'presale', robotsCheckedAt: '2026-09-02',
};

const fact = (o: Partial<CandidateFact> = {}): CandidateFact => ({
  rawName: '김해 외동 재건축사업',
  addrRaw: '경상남도 김해시 외동 705번지 일원',
  region: '경남', sigungu: '김해시', totalUnits: 1135,
  sourceUrl: SRC.listUrl, kind: 'presale', ...o,
});

describe('가칭 규약 (R6)', () => {
  it('slug 에서만 「(가칭)」을 뗀다', () => {
    expect(stripProvisional('부암동 데시앙(가칭)')).toBe('부암동 데시앙');
    expect(provisionalSlug('부암동 데시앙(가칭)')).toBe('부암동-데시앙');
    // ⚠️ 떼지 않으면 `부암동-데시앙가칭` 이 되고 확정명 리다이렉트 대상이 괄호 낀 URL 이 된다.
    expect(provisionalSlug('부암동 데시앙(가칭)')).not.toContain('가칭');
  });

  it('전각 괄호·「가제」도 같은 규칙', () => {
    expect(stripProvisional('명지 A5（가제）')).toBe('명지 A5');
    expect(isProvisional('부암동 데시앙(가칭)')).toBe(true);
    expect(isProvisional('서면 어반센트 데시앙')).toBe(false);
  });

  it('가칭이 없으면 이름을 그대로 둔다', () => {
    expect(stripProvisional('김해 외동 재건축사업')).toBe('김해 외동 재건축사업');
  });
});

describe('공급유형 게이트 (R2)', () => {
  // 2026-09-02 태영 공식 실측 카드 + §0-2 결측 4건이 판정의 근거다.
  it.each([
    ['고창 덕산지구 공동주택(공공분양)', '공공'],
    ['화성동탄2A78BL공공주택사업', '공공'],
    ['LH 김해 진영 아파트', '공공'],
    ['부산 명지 A5', '미상'],
    ['거제 옥포 공동주택', '미상'],
    ['김해 외동 재건축사업', '민영'],
    ['대전 유천1구역 지역주택조합', '민영'],
    ['청주 사창 재건축 정비사업', '민영'],
  ])('%s → %s', (name, expected) => {
    expect(judgeSupplyType(name, null, '데시앙')).toBe(expected);
  });

  it('브랜드가 붙으면 민영으로 본다 — 공공 블록에는 브랜드가 없다', () => {
    expect(judgeSupplyType('서면 어반센트 데시앙', null, '데시앙')).toBe('민영');
  });

  it('민영만 광고 적격', () => {
    expect(adBlockedFor('민영')).toBe(false);
    expect(adBlockedFor('공공')).toBe(true);
    expect(adBlockedFor('임대')).toBe(true);
    // ⚠️ 「모른다」도 광고하지 않는다. 명지 A5 가 새게 된 자리다.
    expect(adBlockedFor('미상')).toBe(true);
  });
});

describe('자동 시드 게이트', () => {
  it('분양예정 + 식별자 + region + source_url 이면 통과', () => {
    expect(seedGate(fact()).seed).toBe(true);
  });

  it('분양중·공사중 목록은 시드하지 않는다 — 매칭·보강 전용', () => {
    const v = seedGate(fact({ kind: 'sale' }));
    expect(v.seed).toBe(false);
    expect(v.reason).toContain('매칭·보강 전용');
  });

  it('region 이 없으면 앉히지 않는다', () => {
    const v = seedGate(fact({ region: null }));
    expect(v.seed).toBe(false);
    expect(v.reason).toContain('지역 미확정');
  });

  it('시·도가 아닌 region 은 앉히지 않는다 — 실측 「청주시 서원구 …」', () => {
    // parseAddress 는 못 알아본 첫 토막을 그대로 준다. 그대로 앉으면 18번째 region 이 생기고
    // CV-4 잔량 지표와 sa.py 존 필터가 둘 다 그 행을 못 본다.
    const v = seedGate(fact({ region: '청주시', sigungu: '서원구' }));
    expect(v.seed).toBe(false);
    expect(v.reason).toContain('시·도가 아니다');
  });

  it('17개 시·도만 통과한다', () => {
    expect(isKnownRegion('경남')).toBe(true);
    expect(isKnownRegion('전북')).toBe(true);
    expect(isKnownRegion('청주시')).toBe(false);
    expect(isKnownRegion('전라북도')).toBe(false); // 축약형으로만 저장된다
    expect(isKnownRegion(null)).toBe(false);
  });

  it('source_url 이 없으면 앉히지 않는다 — 원본으로 못 돌아가는 값', () => {
    expect(seedGate(fact({ sourceUrl: '' })).seed).toBe(false);
  });

  it('식별자가 두 글자면 이름이 아니다', () => {
    expect(seedGate(fact({ rawName: 'A5' })).seed).toBe(false);
  });
});

describe('정규화 키', () => {
  it('DB 표현식 인덱스와 같은 규칙 — 공백·하이픈·괄호를 전부 턴다', () => {
    expect(normName('서면 어반센트 데시앙')).toBe('서면어반센트데시앙');
    expect(normName('남천2-3(삼익비치) 재건축')).toBe('남천23삼익비치재건축');
  });
  it('similarKey 는 가칭을 뗀 뒤의 키다', () => {
    expect(similarKey('부암동 데시앙(가칭)')).toBe('부암동데시앙');
  });
});

describe('AI 추출 스키마 검증', () => {
  it('세대·가구와 결합되지 않은 수치는 버린다 (PV-5 판정 1-③)', () => {
    const [a, b, c] = validateCards([
      { name: '가', units_raw: '1,135세대' },
      { name: '나', units_raw: '78' },       // 맨숫자 — 버린다
      { name: '다', units_raw: '69실' },      // 「실」은 세대수가 아니다
    ], SRC);
    expect(a.totalUnits).toBe(1135);
    expect(b.totalUnits).toBeNull();
    expect(c.totalUnits).toBeNull();
  });

  it('아파트 세대수를 취한다 — 실측 「아파트 762세대, 오피스텔 69실」', () => {
    const [card] = validateCards([{ name: '서면 어반센트 데시앙', units_raw: '762세대' }], SRC);
    expect(card.totalUnits).toBe(762);
  });

  it('주소에서 시도·시군구를 뽑고 축약형으로 맞춘다', () => {
    const [card] = validateCards(
      [{ name: '김해 외동 재건축사업', address: '경상남도 김해시 외동 705번지 일원' }], SRC);
    expect(card.region).toBe('경남');
    expect(card.sigungu).toBe('김해시');
  });

  it('이름 없는 카드·비객체·중복은 통과하지 않는다', () => {
    const out = validateCards(
      [{ name: '' }, null, 'x', { units_raw: '100세대' }, { name: '가' }, { name: ' 가 ' }], SRC);
    expect(out).toHaveLength(1);
  });

  it('배열이 아니면 빈 배열 — 어떤 입력에도 던지지 않는다', () => {
    expect(validateCards(null, SRC)).toEqual([]);
    expect(validateCards({ name: '가' }, SRC)).toEqual([]);
    expect(validateCards('[]', SRC)).toEqual([]);
  });

  it('상대경로 detail_url 은 목록 URL 로 접는다 — 지어낸 경로를 저장하지 않는다', () => {
    const [rel, abs] = validateCards([
      { name: '가', detail_url: '/web/complex/detail?id=1' },
      { name: '나', detail_url: 'https://www.desian.co.kr/x' },
    ], SRC);
    expect(rel.sourceUrl).toBe(SRC.listUrl);
    expect(abs.sourceUrl).toBe('https://www.desian.co.kr/x');
  });

  it('builder 는 canonical 로 치환해 담는다', () => {
    const [card] = validateCards([{ name: '가' }], { ...SRC, builder: '대림산업' });
    expect(card.builderRaw).toBe('DL이앤씨');
  });
});

describe('htmlToText', () => {
  it('script·style 을 걷어내고 <br> 을 줄바꿈으로 바꾼다', () => {
    const t = htmlToText(
      '<style>.a{}</style><script>var x=1</script><li>위치 : 김해<br>세대수 : 1,135세대</li>');
    expect(t).not.toContain('var x');
    expect(t).not.toContain('.a{}');
    expect(t).toContain('위치 : 김해');
    expect(t).toContain('세대수 : 1,135세대');
  });

  it('어떤 입력에도 던지지 않는다', () => {
    expect(htmlToText('')).toBe('');
    expect(htmlToText(null as unknown as string)).toBe('');
  });
});

describe('유사명 검색의 지역 울타리 (CV-B ②)', () => {
  it('고창(전북) 카드에 창원(경남) 현장이 후보로 들어오지 않는다', () => {
    expect(isSameArea({ region: '전북', sigungu: '고창군' },
                      { region: '경남', sigungu: '창원시 의창구' })).toBe(false);
  });

  it('같은 시·도 안의 다른 시군구는 막지 않는다 — 병합 후보일 수 있다', () => {
    expect(isSameArea({ region: '부산', sigungu: null },
                      { region: '부산', sigungu: '남구' })).toBe(true);
  });

  it('같은 시군구는 통과', () => {
    expect(isSameArea({ region: '부산', sigungu: '남구' },
                      { region: '부산', sigungu: '남구' })).toBe(true);
  });

  it('같은 시·도라도 시군구가 다르면 막는다', () => {
    expect(isSameArea({ region: '경남', sigungu: '김해시' },
                      { region: '경남', sigungu: '창원시 성산구' })).toBe(false);
  });

  it('한쪽 값이 없으면 막지 않는다 — 중복 페이지 생성이 더 비싼 실패다', () => {
    expect(isSameArea({ region: null, sigungu: null }, { region: '경남', sigungu: '김해시' })).toBe(true);
    expect(isSameArea({ region: '전북', sigungu: '고창군' }, { region: null, sigungu: null })).toBe(true);
  });
});

describe('소스 내 동일 현장 힌트 (CV-B ③)', () => {
  const a78 = { rawName: '화성동탄2 A78BL 공공주택사업', region: null, totalUnits: 1140 };
  const dsn = { rawName: '동탄 자연&데시앙', region: '경기', totalUnits: 1140 };

  it('region 을 못 읽은 사업명 카드와 브랜드명 카드를 짝으로 본다', () => {
    expect(isSameSiteHint(a78, dsn)).toBe(true);
  });

  it('세대수가 다르면 짝이 아니다', () => {
    expect(isSameSiteHint(a78, { ...dsn, totalUnits: 930 })).toBe(false);
  });

  it('세대수가 한쪽이라도 없으면 짝이 아니다 — null 을 같음으로 세지 않는다', () => {
    expect(isSameSiteHint({ ...a78, totalUnits: null }, dsn)).toBe(false);
    expect(isSameSiteHint(a78, { ...dsn, totalUnits: null })).toBe(false);
  });

  it('시·도가 둘 다 있고 다르면 짝이 아니다', () => {
    expect(isSameSiteHint({ ...a78, region: '전북' }, dsn)).toBe(false);
  });

  it('이름이 같은 카드(중복 행)는 짝으로 세지 않는다', () => {
    expect(isSameSiteHint({ ...dsn }, { ...dsn, region: null })).toBe(false);
  });
});

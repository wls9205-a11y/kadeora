// V16 E-2 — 매칭 규칙 회귀 테스트.
//
// 여기서 지키려는 건 하나다: **틀린 자동 반영을 내지 않는다.**
// 놓치는 건(큐로 감) 괜찮지만 엉뚱한 현장에 confirmed 를 찍으면 광고 랜딩까지 흘러간다.

import { describe, expect, it } from 'vitest';
import {
  bodyMentionsRedev,
  extractZoneNames,
  isConstructionCorp,
  isSupplyContract,
  matchSite,
  type CandidateSite,
} from '@/lib/dart/redev-match';

const site = (o: Partial<CandidateSite> & { id: string; name: string }): CandidateSite => ({
  slug: o.slug ?? o.name,
  builder: o.builder ?? null,
  name_variants: o.name_variants ?? [],
  ...o,
});

describe('1차 필터 — 건설사 판별', () => {
  it('건설사를 받는다', () => {
    for (const n of ['대우건설', '코오롱글로벌건설', 'DL이앤씨', '현대산업개발', '반도건설'])
      expect(isConstructionCorp(n), n).toBe(true);
  });

  // 사용자가 실측으로 지목한 오탐원 4곳. 이름 때문에 걸리던 것들이다.
  it('조선·중공업·전자를 버린다', () => {
    for (const n of ['HJ중공업', '삼성중공업', '한화오션', '현대오토에버'])
      expect(isConstructionCorp(n), n).toBe(false);
  });

  it('빈 값을 받지 않는다', () => {
    expect(isConstructionCorp('')).toBe(false);
    expect(isConstructionCorp(null)).toBe(false);
  });
});

describe('공급계약 공시 판별', () => {
  it('정식·정정본을 모두 받는다', () => {
    expect(isSupplyContract('단일판매ㆍ공급계약체결              ')).toBe(true);
    expect(isSupplyContract('[기재정정]단일판매ㆍ공급계약체결')).toBe(true);
    expect(isSupplyContract('단일판매·공급계약 체결')).toBe(true);
  });
  it('무관한 공시를 버린다', () => {
    expect(isSupplyContract('분기보고서')).toBe(false);
    expect(isSupplyContract('주권매매거래정지              (단일판매공급계약)')).toBe(true);
  });
});

describe('본문 정비사업 조건', () => {
  it('구역·정비사업이 있으면 통과', () => {
    expect(bodyMentionsRedev('부산 범천1-1구역 주택재개발정비사업 계약금액 8,420억')).toBe(true);
    expect(bodyMentionsRedev('○○ 정비사업 시공')).toBe(true);
  });
  it('선박·플랜트 본문은 떨어진다', () => {
    expect(bodyMentionsRedev('LNG 운반선 2척 건조 계약')).toBe(false);
    expect(bodyMentionsRedev(null)).toBe(false);
  });
});

describe('구역명 추출', () => {
  it('구역으로 끝나는 토큰을 집는다', () => {
    const z = extractZoneNames('부산광역시 부산진구 범천1-1구역 주택재개발정비사업 계약');
    expect(z).toContain('범천1-1구역');
  });
  it('사업명 앞 토막도 집는다', () => {
    expect(extractZoneNames('사직5 재건축정비사업 공사도급')).toContain('사직5');
  });
  it('지시어는 현장 이름이 아니다', () => {
    expect(extractZoneNames('해당구역 및 본구역 일원')).not.toContain('해당구역');
  });
});

describe('자동 반영은 두 조건이 모두 맞을 때만', () => {
  const zones = ['범천1-1구역'];

  it('구역명 정확 일치 + 시공사 일치 → auto', () => {
    const r = matchSite(zones, '코오롱글로벌', [
      site({ id: 's1', name: '범천1-1구역', builder: '코오롱글로벌' }),
    ]);
    expect(r.kind).toBe('auto');
  });

  it('name_variants 로도 맞는다', () => {
    const r = matchSite(['광안A구역'], 'DL이앤씨', [
      site({ id: 's2', name: '부산 망미 재건축', builder: 'DL이앤씨', name_variants: ['광안A구역', '망미2구역'] }),
    ]);
    expect(r.kind).toBe('auto');
  });

  it('시공사가 다르면 큐로 — 구역명이 맞아도 자동 반영하지 않는다', () => {
    const r = matchSite(zones, '대우건설', [
      site({ id: 's1', name: '범천1-1구역', builder: '코오롱글로벌' }),
    ]);
    expect(r).toMatchObject({ kind: 'queue', reason: 'builder_mismatch' });
  });

  it('현장에 시공사가 없으면 큐로', () => {
    const r = matchSite(zones, '코오롱글로벌', [site({ id: 's1', name: '범천1-1구역' })]);
    expect(r).toMatchObject({ kind: 'queue', reason: 'site_has_no_builder' });
  });

  it('같은 구역명 현장이 둘이면 고르지 않는다', () => {
    const r = matchSite(zones, '코오롱글로벌', [
      site({ id: 's1', name: '범천1-1구역', builder: '코오롱글로벌' }),
      site({ id: 's2', name: '범천1-1구역', builder: '코오롱글로벌' }),
    ]);
    expect(r).toMatchObject({ kind: 'queue', reason: 'multiple_zone_matches' });
  });

  it('부분 일치를 자동 반영으로 올리지 않는다', () => {
    // '범천1-1구역' 공시가 '범천' 이라는 현장에 붙으면 안 된다.
    const r = matchSite(zones, '코오롱글로벌', [
      site({ id: 's1', name: '범천', builder: '코오롱글로벌' }),
    ]);
    expect(r).toMatchObject({ kind: 'queue', reason: 'no_exact_zone_match' });
  });

  it('브랜드명 단독 현장이 키워드로 걸리지 않는다', () => {
    // 1980~90년대 아파트는 실제로 이름이 '대우'·'삼성' 이다 (실존 데이터).
    const r = matchSite(['대우건설컨소시엄구역'], '대우건설', [
      site({ id: 's3', name: '대우', builder: '대우건설' }),
    ]);
    expect(r.kind).toBe('queue');
  });

  it('공백·괄호 표기 차이는 흡수한다', () => {
    const r = matchSite(['범천1-1구역'], '코오롱글로벌', [
      site({ id: 's1', name: '범천1-1 구역', builder: '코오롱 글로벌' }),
    ]);
    expect(r.kind).toBe('auto');
  });
});

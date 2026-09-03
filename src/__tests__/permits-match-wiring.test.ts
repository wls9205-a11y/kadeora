import { describe, it, expect } from 'vitest';
import { confidenceOf, indexByDong, toColumnStatus, toSiteFact } from '@/lib/permits/site-fact';
import { judgeMatch, type PermitFact } from '@/lib/permits/match';

/**
 * PV-3b 배선 — 판정기는 이미 테스트로 잠겨 있다(permits-*.test.ts).
 * 여기서 재는 것은 «배선» 이다: 사이트 행이 판정기 입력으로 옳게 번역되는가.
 */
const row = (o: Partial<Parameters<typeof toSiteFact>[0]> = {}) => ({
  id: 's1', name: '그랑라크 에일린의 뜰', display_name: null, name_variants: [],
  address: '울산광역시 남구 야음동 350-5번지', region: '울산', sigungu: '남구', dong: '야음동',
  total_units: null, complex_units: 1521, ...o,
}) as Parameters<typeof toSiteFact>[0];

describe('PV-3b 배선 — 사이트 → 판정기 입력', () => {
  it('세대수는 complex_units 가 먼저다 — total_units 에는 공급분이 섞여 있다', () => {
    expect(toSiteFact(row({ complex_units: 1521, total_units: 300 })).units).toBe(1521);
    expect(toSiteFact(row({ complex_units: null, total_units: 300 })).units).toBe(300);
  });

  it('주소가 없으면 region·sigungu·dong 으로 합성한다 — 활성 절반이 주소가 없다', () => {
    const f = toSiteFact(row({ address: null }));
    expect(f.address).toBe('울산 남구 야음동');
  });

  it('이름은 name·display_name·name_variants 를 합친다', () => {
    const f = toSiteFact(row({ display_name: '(가칭) 그랑라크', name_variants: ['B-14 재개발'] }));
    expect(f.names).toContain('B-14 재개발');
    expect(f.names).toHaveLength(3);
  });

  it('법정동 색인 — 동이 없으면 후보에 넣지 않는다(전수 비교를 막는 문)', () => {
    const idx = indexByDong([row(), row({ id: 's2', dong: null, address: null, region: null, sigungu: null })]);
    expect(idx.get('야음동')).toHaveLength(1);
    expect(idx.size).toBe(1);
  });
});

describe('PV-3b 배선 — 실측 케이스가 실제로 붙는가', () => {
  // 2026-08-29 게이트의 그 사례. 이름축으로는 «어떤 문자열로도» 닿지 않고 세대수만이 연결고리다.
  const permit: PermitFact = {
    bjdCd: null, address: '울산광역시 남구 야음동 350-5번지',
    name: '울산 남구 B-14 주택재개발 정비사업', units: 1521, permitDate: '2019-06-28',
  };

  it('그랑라크 — 지번 정확일치로 matched', () => {
    const v = judgeMatch(permit, [toSiteFact(row())]);
    expect(v.status).toBe('matched');
    expect(v.method).toBe('jibun_exact');
    expect(confidenceOf(v.score)).toBe('verified');
  });

  it('주소가 동까지뿐인 행도 세대수로 붙는다 — 합성 주소의 목적이 이것이다', () => {
    const v = judgeMatch(permit, [toSiteFact(row({ address: null }))]);
    expect(v.status).toBe('matched');
    expect(v.method).toBe('units_exact');
  });

  it('같은 동의 «다른» 현장은 붙지 않는다 — 문수로대공원 오매칭 재발 방지', () => {
    const other = toSiteFact(row({ id: 's9', name: '문수로대공원 에일린의 뜰', complex_units: 384, address: '울산광역시 남구 야음동' }));
    const v = judgeMatch(permit, [other]);
    expect(v.status).not.toBe('matched');
  });

  it('matched 후보가 둘이면 고르지 않는다 — siteId 는 null 이고 review 다', () => {
    const a = toSiteFact(row({ id: 'a', address: '울산광역시 남구 야음동' }));
    const b = toSiteFact(row({ id: 'b', name: '다른 이름', address: '울산광역시 남구 야음동' }));
    const v = judgeMatch(permit, [a, b]);
    expect(v.status).toBe('review');
    expect(v.siteId).toBeNull();
  });

  // ⚠️ 2026-09-02 실측 사고 — 판정기 어휘와 «컬럼» 어휘가 다르다.
  //    unmatched 1,190건의 UPDATE 가 CHECK 에 걸려 전량 거부됐는데 에러를 안 봐서
  //    「후보 없음 1,190」으로 보고까지 됐다. 행은 pending 그대로였다.
  it('판정기 unmatched 는 컬럼에서 no_target 이다', () => {
    expect(toColumnStatus('unmatched')).toBe('no_target');
    expect(toColumnStatus('matched')).toBe('matched');
    expect(toColumnStatus('review')).toBe('review');
  });

  it('confidence 는 CHECK 가 허용하는 낱말만 쓴다 — low 는 없는 말이다', () => {
    const allowed = ['rumor', 'estimated', 'confirmed', 'verified', 'conflicting'];
    for (const sc of [1, 0.95, 0.9, 0.85, 0.8, 0.4, 0]) {
      expect(allowed).toContain(confidenceOf(sc));
    }
    expect(confidenceOf(1)).toBe('verified');
    expect(confidenceOf(0.9)).toBe('confirmed');
    expect(confidenceOf(0.8)).toBe('estimated');
  });
});

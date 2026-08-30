/**
 * 인증키 확장 ① 면적 타입표 (2026-08-30 · 울산 남구 야음동 600호 실측이 근거).
 *
 * 이 파일이 잠그는 것: 「(근생)214」와 「102동2002호」가 «세대수를 부풀리지» 못하게.
 * 그리고 평형계열(84A)과 면적계열(21.62C)이 «같은 축으로 정렬되지» 못하게.
 */
import { describe, expect, it } from 'vitest';
import {
  buildTypeTable,
  buildTypeTables,
  exclusiveAreas,
  matchArea,
  parseUnitType,
  type HoRow,
} from '@/lib/permits/unittypes';

const ho = (bld: string, dong: string, t: string): HoRow => ({ bldNm: bld, dongNm: dong, pngtypGbNm: t });

describe('타입 라벨 판정', () => {
  it('평형계열 — 「84A」는 면적힌트 84 · 접미 A', () => {
    expect(parseUnitType('84A')).toMatchObject({ kind: 'apt', areaHint: 84, suffix: 'A' });
    expect(parseUnitType('59')).toMatchObject({ kind: 'apt', areaHint: 59, suffix: null });
  });
  it('면적계열 — 「21.62C」는 면적 그대로', () => {
    expect(parseUnitType('21.62C')).toMatchObject({ kind: 'apt', areaHint: 21.62, suffix: 'C' });
  });

  it('⛔ 「(근생)214」는 주거 타입이 «아니다» — 세면 세대수가 부푼다', () => {
    for (const s of ['(근생)214', '(근생)101', '근생 205', '상가1', '판매시설']) {
      expect(parseUnitType(s)!.kind).toBe('retail');
    }
  });
  it('⛔ 「102동2002호」는 «호 표기» 다 — 입력 사고이지 타입이 아니다', () => {
    expect(parseUnitType('102동2002호')!.kind).toBe('malformed');
    expect(parseUnitType('101동 1503호')!.kind).toBe('malformed');
  });
  it('빈 값·이상값은 null 이거나 malformed 다 — 지어내지 않는다', () => {
    expect(parseUnitType('')).toBeNull();
    expect(parseUnitType('   ')).toBeNull();
    expect(parseUnitType('999')!.kind).toBe('malformed');   // 400㎡ 초과
    expect(parseUnitType('A동')!.kind).toBe('malformed');
  });
});

describe('타입표 — 실측 재현 (번영로 센텀파크 에일린의 뜰)', () => {
  // 2026-08-30 실측: 호 217 · 동 3 · 84A×64 · 59×52 · 70A×47 · 70B×14 · 84B×13
  //                  + 「102동2002호」×1 + 「(근생)214」×1
  const rows: HoRow[] = [
    ...Array.from({ length: 64 }, (_, i) => ho('센텀파크', `10${i % 3 + 1}동`, '84A')),
    ...Array.from({ length: 52 }, () => ho('센텀파크', '101동', '59')),
    ...Array.from({ length: 47 }, () => ho('센텀파크', '102동', '70A')),
    ...Array.from({ length: 14 }, () => ho('센텀파크', '103동', '70B')),
    ...Array.from({ length: 13 }, () => ho('센텀파크', '101동', '84B')),
    ho('센텀파크', '102동', '102동2002호'),
    ho('센텀파크', '102동', '(근생)214'),
  ];

  it('오염 2건이 «빠지고» 세대수가 정확해진다', () => {
    const t = buildTypeTable('센텀파크', rows);
    expect(t.totalUnits).toBe(190);                       // 64+52+47+14+13 — 오염 2건 제외
    expect(t.excluded).toMatchObject({ retail: 1, malformed: 1, empty: 0 });
    expect(t.types.map((x) => x.label)).not.toContain('(근생)214');
    expect(t.types.map((x) => x.label)).not.toContain('102동2002호');
  });
  it('면적 오름차순으로 정렬된다', () => {
    const t = buildTypeTable('센텀파크', rows);
    expect(t.types.map((x) => x.label)).toEqual(['59', '70A', '70B', '84A', '84B']);
  });
  it('동 수를 센다', () => {
    expect(buildTypeTable('센텀파크', rows).dongs).toBe(3);
  });
  it('⚠️ 버린 것을 «센다» — 조용히 사라지면 표가 왜 안 맞는지 모른다', () => {
    const t = buildTypeTable('x', [ho('x', '1동', ''), ho('x', '1동', '(근생)1')]);
    expect(t.excluded.empty + t.excluded.retail).toBe(2);
    expect(t.totalUnits).toBe(0);
  });
});

describe('⚠️ 표기 두 체계가 섞이면 «표시한다»', () => {
  it('평형계열만이면 섞이지 않았다', () => {
    const t = buildTypeTable('a', [ho('a', '1', '84A'), ho('a', '1', '59')]);
    expect(t.mixedNotation).toBe(false);
  });
  it('평형(84A)과 면적(21.62C)이 함께 있으면 mixedNotation', () => {
    // ⛔ 섞이면 「21.62 < 59」라는 정렬이 나오는데, 그게 사실인지 사람이 봐야 한다.
    const t = buildTypeTable('a', [ho('a', '1', '84A'), ho('a', '1', '21.62C')]);
    expect(t.mixedNotation).toBe(true);
  });
});

describe('여러 건물 — 실측 3현장', () => {
  it('세대수 많은 순으로 준다', () => {
    const rows: HoRow[] = [
      ...Array.from({ length: 138 }, () => ho('야음동삼한아파트', '1동', '21.62C')),
      ...Array.from({ length: 88 }, () => ho('야음동삼한아파트', '2동', '30.59A')),
      ...Array.from({ length: 32 }, () => ho('하늘채 센트럴파크', '1동', '74')),
      ...Array.from({ length: 25 }, () => ho('하늘채 센트럴파크', '2동', '84A')),
    ];
    const tables = buildTypeTables(rows);
    expect(tables[0].building).toBe('야음동삼한아파트');
    expect(tables[0].totalUnits).toBe(226);
    expect(tables[1].totalUnits).toBe(57);
  });
});

describe('전유면적 — 세대수를 «세지 않는다»', () => {
  const areas = [
    { exposPubuseGbCdNm: '전유', mainAtchGbCdNm: '주건축물', purpsCdNm: '아파트', area: '84.09' },
    { exposPubuseGbCdNm: '전유', mainAtchGbCdNm: '주건축물', purpsCdNm: '아파트', area: '59.84' },
    { exposPubuseGbCdNm: '공용', mainAtchGbCdNm: '주건축물', purpsCdNm: '아파트', area: '30.00' },
    { exposPubuseGbCdNm: '전유', mainAtchGbCdNm: '부속건축물', purpsCdNm: '부대시설', area: '12.00' },
    { exposPubuseGbCdNm: '전유', mainAtchGbCdNm: '주건축물', purpsCdNm: '기타제2종근린생활시설', area: '40.00' },
  ];
  it('전유 + 주건축물 + 주거용도만 남긴다', () => {
    // ⚠️ 반환은 «후보» 다 — 면적 + (상대 소스가 주면) 접미. 실측상 접미는 오지 않는다.
    expect(exclusiveAreas(areas).map((c) => c.area)).toEqual([59.84, 84.09]);
    expect(exclusiveAreas(areas).every((c) => c.suffix === null)).toBe(true);
  });
  it('⚠️ purpsCdNm 은 실측에서 「아파트」다 — 「공동주택」을 지어내지 않는다', () => {
    expect(exclusiveAreas([{ exposPubuseGbCdNm: '전유', mainAtchGbCdNm: '주건축물', purpsCdNm: '아파트', area: 1 }])).toHaveLength(1);
  });

  const c = (area: number, suffix: string | null = null) => ({ area, suffix });

  it('계열 후보가 «유일하면» 단정한다 — 84A → 84.09㎡', () => {
    const m = matchArea({ label: '84A', units: 64, areaHint: 84, suffix: 'A' }, [c(59.84), c(84.09)]);
    expect(m.exact).toBe(84.09);
    expect(m.note).toContain('유일');
  });
  it('⛔ 못 맞추면 «지어내지 않는다»', () => {
    const m = matchArea({ label: '59', units: 1, areaHint: 59, suffix: null }, [c(84.09)]);
    expect(m.exact).toBeNull();
    expect(m.series).toEqual([]);
  });
  it('면적계열은 이미 면적이라 그대로 쓴다', () => {
    expect(matchArea({ label: '21.62C', units: 1, areaHint: 21.62, suffix: 'C' }, []).exact).toBe(21.62);
  });

  it('⭐ C′ ⑩ — 접미 근거가 «없으면» 개별 타입을 단정하지 않는다', () => {
    // 실측: 70A(47세대)·70B(14세대) 에 둘 다 70.17㎡ 가 붙었다. 다른 평면인데 같은 면적이 됐다.
    // 전유면적 응답에는 접미가 «없다» → 계열 관측만 남기고 단정하지 않는다.
    const areas = [c(69.98), c(70.17)];
    for (const t of [{ label: '70A', units: 47, areaHint: 70, suffix: 'A' },
                     { label: '70B', units: 14, areaHint: 70, suffix: 'B' }]) {
      const m = matchArea(t, areas);
      expect(m.exact).toBeNull();                    // ⛔ 단정하지 않는다
      expect(m.series).toEqual([69.98, 70.17]);      // 관측은 남긴다
      expect(m.note).toContain('접미 근거가 없어');
    }
  });
  it('⭐ C′ ⑩ — 상대에 접미가 «있으면» 2키로 단정한다', () => {
    const areas = [c(69.98, 'A'), c(70.17, 'B')];
    expect(matchArea({ label: '70A', units: 47, areaHint: 70, suffix: 'A' }, areas).exact).toBe(69.98);
    expect(matchArea({ label: '70B', units: 14, areaHint: 70, suffix: 'B' }, areas).exact).toBe(70.17);
  });
  it('⛔ 「약 70㎡」로 «뭉개지 않는다» — 아는 것을 버리지 않는다', () => {
    // 계열 후보가 하나면 그건 사실이므로 그대로 단정한다.
    const m = matchArea({ label: '70A', units: 47, areaHint: 70, suffix: 'A' }, [c(70.17)]);
    expect(m.exact).toBe(70.17);
  });
  it('2키에도 후보가 둘이면 단정하지 않는다', () => {
    const m = matchArea({ label: '84A', units: 1, areaHint: 84, suffix: 'A' }, [c(83.9, 'A'), c(84.4, 'A')]);
    expect(m.exact).toBeNull();
    expect(m.note).toContain('2키에도');
  });
});

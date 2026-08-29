/**
 * 공유 지역코드 모듈 불변식 (PV-1).
 *
 * 인허가 파이프라인은 이 표로 «전국을 한 바퀴» 돈다. 표가 조용히 줄면
 * 「돌았는데 0건」이 되고, 그건 로그만 봐서는 성공과 구분되지 않는다.
 * 그래서 줄어드는 것 자체를 여기서 깨뜨린다.
 */
import { describe, expect, it } from 'vitest';
import {
  LAWD_ENTRIES,
  LAWD_LABELS,
  SIDO_PREFIX,
  SIGUNGU_LAWD_CODES,
  labelOfLawdCode,
  lawdCodesOf,
  lawdEntriesForRegions,
  parseRegionSigungu,
} from '@/lib/region/lawd';
import { SIGUNGU_MAP } from '@/lib/regions';
import { BUULGYEONG_REGIONS } from '@/lib/region/buulgyeong';

describe('SIGUNGU_LAWD_CODES — 표 자체', () => {
  it('코드는 전부 5자리 숫자다', () => {
    const bad = LAWD_ENTRIES.filter(([, code]) => !/^\d{5}$/.test(code));
    expect(bad).toEqual([]);
  });

  it('한 코드가 두 라벨에 걸리지 않는다 — 걸리면 같은 지역을 두 번 호출한다', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [label, code] of LAWD_ENTRIES) {
      const prev = seen.get(code);
      if (prev) dupes.push(`${code}: ${prev} / ${label}`);
      else seen.set(code, label);
    }
    expect(dupes).toEqual([]);
  });

  it('한 시도의 코드 앞 2자리는 하나다 — SIDO_PREFIX 유도가 성립하는 근거', () => {
    const prefixes = new Map<string, Set<string>>();
    for (const [label, code] of LAWD_ENTRIES) {
      const { region } = parseRegionSigungu(label);
      (prefixes.get(region) ?? prefixes.set(region, new Set()).get(region)!).add(code.slice(0, 2));
    }
    const split = [...prefixes].filter(([, s]) => s.size > 1).map(([r, s]) => `${r}=${[...s]}`);
    expect(split).toEqual([]);
    expect(SIDO_PREFIX.get('부산')).toBe('26');
    // ⚠️ 강원·전북은 51·52 다(특별자치도 신 코드). 42·45 로 되돌리면 그 지역이 통째로 0건이 된다 — D5-4.
    expect(SIDO_PREFIX.get('강원')).toBe('51');
    expect(SIDO_PREFIX.get('전북')).toBe('52');
  });

  /**
   * 알려진 어긋남 «하나». 여기서는 «그것 말고는 없다» 만 지킨다.
   *   충남 연기군 — 세종 출범으로 폐지된 지역이 남아 있다(44830).
   *
   * ⚠️ 2026-08-29 정정 — 군위군은 «해결됐다».
   *    b85e9c6f 에서 경북 군위군(47720) → 대구 군위군(27720)으로 이관했고,
   *    47720 은 StanReginCd 에서 이미 0행이라 «긁을 게 없는 코드» 였다.
   *    이 단언이 낡은 채로 남아 있어 수리가 «실패» 로 보고되고 있었다 —
   *    §4-1 그대로다: 죽은 규칙이 걸리기를 기대하는 단언은 버그를 정상으로 고정시킨다.
   */
  it('regions.ts 의 시군구를 빠짐없이 덮는다 (알려진 1건 제외)', () => {
    const expected = Object.entries(SIGUNGU_MAP).flatMap(([sido, gus]) =>
      gus.map((g) => (sido === '세종' ? '세종시' : `${sido} ${g}`)),
    );
    const have = new Set(LAWD_LABELS);
    expect(expected.filter((label) => !have.has(label))).toEqual([]);
    expect(LAWD_LABELS.filter((label) => !expected.includes(label))).toEqual(['충남 연기군']);
  });

  it('일반구를 가진 시는 구를 «전부» 들고 있다 — 첫 구만 넣던 것이 D5-3 의 원인', () => {
    expect(lawdCodesOf('경남 창원시')).toEqual(['48121', '48123', '48125', '48127', '48129']);
    expect(lawdCodesOf('경기 수원시')).toHaveLength(4);
    expect(lawdCodesOf('경기 안산시')).toHaveLength(2);
  });
});

describe('수집 범위 — 줄어들면 깨진다', () => {
  it('라벨 230 · 코드 256 (호출 예산의 전제)', () => {
    expect(LAWD_LABELS).toHaveLength(230);
    // ⚠️ 251 → 256. 라벨은 그대로인데 «코드만» 늘었다 — 일반구를 첫 구만 넣고 있던
    //    시가 둘 더 있었다: 경기 화성시 +3(4구) · 경기 부천시 +2(3구). D5-3 과 같은 병.
    //    ⛔ 이 수를 «줄이는» 방향으로 고치지 않는다. 줄면 그 지역이 통째로 0건이 된다.
    expect(LAWD_ENTRIES).toHaveLength(256);
  });

  it('부울경은 39개 시군구 · 43개 코드다', () => {
    const bg = lawdEntriesForRegions([...BUULGYEONG_REGIONS]);
    expect(new Set(bg.map(([label]) => label)).size).toBe(39);
    expect(bg).toHaveLength(43);
  });

  it('부울경 39곳이 regions.ts 목록과 정확히 같다', () => {
    const fromLawd = [...new Set(lawdEntriesForRegions([...BUULGYEONG_REGIONS]).map(([l]) => l))]
      .map((l) => parseRegionSigungu(l).sigungu)
      .sort();
    const fromMap = BUULGYEONG_REGIONS.flatMap((r) => SIGUNGU_MAP[r]).sort();
    expect(fromLawd).toEqual(fromMap);
  });
});

describe('헬퍼', () => {
  it('코드 → 라벨 역인덱스', () => {
    expect(labelOfLawdCode('26350')).toBe('부산 해운대구');
    expect(labelOfLawdCode('48127')).toBe('경남 창원시'); // 마산회원구도 라벨은 창원시 하나다
    expect(labelOfLawdCode('99999')).toBeNull();
  });

  it('모르는 라벨은 빈 배열 — 「돌았는데 0건」과 구분되도록', () => {
    expect(lawdCodesOf('부산 없는구')).toEqual([]);
  });

  it('세종은 토큰이 하나여도 region 이 «세종» 이다 (apt_sites.region 표기)', () => {
    expect(parseRegionSigungu('세종시')).toEqual({ region: '세종', sigungu: '세종시' });
    expect(parseRegionSigungu('부산 해운대구')).toEqual({ region: '부산', sigungu: '해운대구' });
  });

  it('SIGUNGU_LAWD_CODES 와 LAWD_ENTRIES 는 같은 표다', () => {
    const flat = Object.values(SIGUNGU_LAWD_CODES).flat();
    expect(LAWD_ENTRIES.map(([, c]) => c)).toEqual(flat);
  });
});

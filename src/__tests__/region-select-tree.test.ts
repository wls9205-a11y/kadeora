// 지역 셀렉 트리 — «시안 하드코딩이 아니라 모듈에서 나온다» 를 잠근다.

import { describe, it, expect } from 'vitest';
import {
  REGION_TREE, searchRegions, serializeRegionSelection, parseRegionSelection, sigunguNodeOfCode,
} from '@/lib/region/select-tree';
import { LAWD_LABELS } from '@/lib/region/lawd';

describe('트리 구조', () => {
  it('시도는 «코드» 로 묶여 16칸이다 — 라벨로 묶으면 17칸이 된다', () => {
    expect(REGION_TREE).toHaveLength(16);
    expect(REGION_TREE.map((s) => s.code)).toEqual([...REGION_TREE.map((s) => s.code)].sort());
  });

  it('12 는 «광주·전남» 한 칸이고 시군구 27개다', () => {
    const merged = REGION_TREE.find((s) => s.code === '12')!;
    expect(merged.name).toBe('광주·전남');
    expect(merged.sigungus).toHaveLength(27);
    // ⚠️ 병합 칸에서는 칩이 라벨 전체를 쓴다 — 「동구」만 두면 어느 시인지 말하지 못한다.
    expect(merged.sigungus.every((n) => n.short === n.label)).toBe(true);
  });

  it('병합이 아닌 시도는 칩이 «짧은 이름» 이다', () => {
    const busan = REGION_TREE.find((s) => s.code === '26')!;
    expect(busan.name).toBe('부산');
    expect(busan.sigungus.find((n) => n.label === '부산 해운대구')!.short).toBe('해운대구');
  });

  it('라벨 230개가 «하나도 빠짐없이» 트리에 있다', () => {
    const inTree = REGION_TREE.flatMap((s) => s.sigungus.map((n) => n.label));
    expect(new Set(inTree).size).toBe(LAWD_LABELS.length);
  });

  it('한 칩이 코드 «여러 개» 를 들 수 있다 — 창원 5구', () => {
    const changwon = REGION_TREE.flatMap((s) => s.sigungus).find((n) => n.label === '경남 창원시')!;
    expect(changwon.codes).toHaveLength(5);
  });
});

describe('URL 직렬화 — 라벨이 아니라 «코드 배열»', () => {
  it('정렬·중복 제거를 항상 한다 — 같은 선택이 두 URL 이 되면 캐시가 갈린다', () => {
    expect(serializeRegionSelection(['26350', '11110', '26350'])).toBe('11110,26350');
  });

  it('⛔ 등재되지 않은 코드는 버린다 — 없는 코드는 조용한 0건을 만든다', () => {
    expect(serializeRegionSelection(['99999', '11110'])).toBe('11110');
    expect(parseRegionSelection('99999')).toEqual([]);
  });

  it('왕복한다', () => {
    const s = serializeRegionSelection(['48121', '11110']);
    expect(parseRegionSelection(s)).toEqual(['11110', '48121']);
  });

  it('빈 선택은 «전국» 이다 — 빈 값을 오류로 만들지 않는다', () => {
    expect(parseRegionSelection(null)).toEqual([]);
    expect(parseRegionSelection('')).toEqual([]);
    expect(serializeRegionSelection([])).toBe('');
  });

  it('코드로 칩을 되찾는다 — 창원 5코드가 전부 같은 칩을 가리킨다', () => {
    for (const c of ['48121', '48123', '48125', '48127', '48129']) {
      expect(sigunguNodeOfCode(c)!.label).toBe('경남 창원시');
    }
  });
});

describe('검색', () => {
  it('시군구 이름으로 찾는다', () => {
    const hits = searchRegions('해운대');
    expect(hits[0].node!.label).toBe('부산 해운대구');
  });

  it('시도 이름은 «시·도 전체» 결과가 된다', () => {
    expect(searchRegions('부산').some((h) => h.node === null && h.sidoName === '부산')).toBe(true);
  });

  it('⛔ 못 찾으면 빈 배열 — 「비슷한 것」을 지어내지 않는다', () => {
    expect(searchRegions('없는동네')).toEqual([]);
  });

  it('빈 질의는 아무것도 열지 않는다', () => {
    expect(searchRegions('   ')).toEqual([]);
  });
});

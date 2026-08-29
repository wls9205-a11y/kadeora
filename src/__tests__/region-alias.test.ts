// 지역 별칭 자물쇠 — 개편 «전» 이름으로 검색해도 닿아야 한다.
//
// ⚠️ 별칭의 값은 lawd.ts 에 «실재하는 라벨» 이어야 한다. 없는 라벨을 가리키면
//    「검색은 되는데 아무 데도 안 가는」 길이 된다 — 그게 이 파일이 막는 것이다.

import { describe, it, expect } from 'vitest';
import { resolveRegionAlias, isLegacyRegionName } from '@/lib/region/alias';
import { LAWD_LABELS } from '@/lib/region/lawd';

describe('시도 개편 — 이름만 바뀐 경우', () => {
  it('「강원도 춘천시」로 찾아도 닿는다', () => {
    expect(resolveRegionAlias('강원도 춘천시')).toBe('강원 춘천시');
  });

  it('「전라북도 전주시」도 닿는다', () => {
    const r = resolveRegionAlias('전라북도 전주시');
    expect(r).not.toBeNull();
    expect(LAWD_LABELS).toContain(r!);
  });
});

describe('시군구가 옮겨간 경우', () => {
  it('「경북 군위군」은 「대구 군위군」으로 간다 (2023 이관)', () => {
    expect(resolveRegionAlias('경북 군위군')).toBe('대구 군위군');
    expect(resolveRegionAlias('경북 군위')).toBe('대구 군위군');
  });
});

describe('안전장치', () => {
  it('현재 라벨은 그대로 통과한다', () => {
    expect(resolveRegionAlias('부산 해운대구')).toBe('부산 해운대구');
  });

  it('⛔ 모르는 입력에 «비슷한 것» 을 돌려주지 않는다', () => {
    for (const v of ['', '   ', '없는지역', '서울 없는구', '경기']) {
      expect(resolveRegionAlias(v)).toBeNull();
    }
  });

  it('⛔ 모든 별칭의 «값» 이 실재하는 라벨이다 — 아무 데도 안 가는 길을 만들지 않는다', () => {
    for (const legacy of ['강원도 춘천시', '전라북도 전주시', '경북 군위군']) {
      const r = resolveRegionAlias(legacy);
      expect(r, `${legacy} 의 별칭 대상`).not.toBeNull();
      expect(LAWD_LABELS, `${legacy} → ${r}`).toContain(r!);
    }
  });

  it('옛 이름 판정 — 현재 라벨은 «옛것이 아니다»', () => {
    expect(isLegacyRegionName('강원도 춘천시')).toBe(true);
    expect(isLegacyRegionName('강원 춘천시')).toBe(false);
    expect(isLegacyRegionName('없는지역')).toBe(false);
  });
});

// §4-1 본문 길이·분리 판단 자물쇠.
//
// ⚠️ 이 테스트가 없어서 too_thin 14건이 **배포 후에야** 드러났다.
//    refreshed 6 · created 1 · too_thin 14 — 크론이 조용히 아무것도 안 한 것에 가깝다.
//    픽스처는 get_district_redev_digest 실측 응답 그대로다.

import { describe, it, expect } from 'vitest';
import {
  buildBody,
  decideSplit,
  pickRepresentatives,
  stripTypeSuffix,
  MIN_SPLIT_ITEMS,
  type Digest,
  type DigestItem,
} from '@/lib/blog/district-body';
import fixtures from './fixtures/district-digests.json';

const MIN = 2000; // blog_publish_config.min_content_length 실측값
const YM = '2026년 8월';
const NONE = new Set<string>();

const 동구 = fixtures['동구'] as unknown as Digest;
const 해운대구 = fixtures['해운대구'] as unknown as Digest;

const len = (d: Digest, items: DigestItem[]) =>
  buildBody({ ...d, total: items.length }, items, NONE, YM).length;

describe('buildBody — 문턱을 넘는다', () => {
  it('동구 통합편 14곳 (실측 1,966자로 34자 부족했던 글)', () => {
    expect(len(동구, 동구.items)).toBeGreaterThanOrEqual(MIN);
  });

  it('해운대구 통합편 25곳', () => {
    expect(len(해운대구, 해운대구.items)).toBeGreaterThanOrEqual(MIN);
  });

  it('절차 문단이 유형별로 붙는다 — 없는 유형은 쓰지 않는다', () => {
    // 동구는 재건축 0곳이다. 재건축 절차 문단이 붙으면 그 구에 없는 이야기를 하는 것이다.
    const body = buildBody(동구, 동구.items, NONE, YM);
    expect(body).toContain('재개발 절차와 동구의 현재 위치');
    expect(body).not.toContain('재건축 절차와');
  });

  it('절차 문단이 구마다 다르다 — 통문장을 깔면 15편이 서로 중복 콘텐츠가 된다', () => {
    const a = buildBody(동구, 동구.items, NONE, YM);
    const b = buildBody(해운대구, 해운대구.items, NONE, YM);
    // 계산값(단계 분포·세대수 합계·가장 앞선 구역)이 구별로 갈리는지 본다.
    const pick = (s: string) => s.split('\n').filter((l) => l.includes('으로 나뉩니다'));
    expect(pick(a).length).toBeGreaterThan(0);
    expect(pick(b).length).toBeGreaterThan(0);
    expect(pick(a)[0]).not.toBe(pick(b)[0]);
  });

  it('행정동 커버리지가 절반 미만이면 그 문장을 쓰지 않는다', () => {
    // 동구는 14곳 중 1곳만 dong 값이 있다. 「초량동 1곳에 몰려 있습니다」라고 쓰면
    // 나머지 13곳이 다른 동인 것처럼 읽힌다 — 사실과 다른 인상이다.
    expect(buildBody(동구, 동구.items, NONE, YM)).not.toContain('행정동으로는');
  });

  it('커버리지가 충분하면 쓴다', () => {
    // 해운대구 재개발 6곳 중 3곳에 dong 값이 있다(전부 중동).
    const redev = 해운대구.items.filter((i) => i.project_type !== '재건축');
    const body = buildBody({ ...해운대구, total: redev.length }, redev, NONE, YM);
    expect(body).toContain('행정동으로는 중동 3곳입니다');
  });

  it('시공사 목록 뒤 조사가 받침을 따른다', () => {
    // 실제로 「한국토지주택공사이 참여하고」 가 나갔다.
    const body = buildBody(해운대구, 해운대구.items, NONE, YM);
    expect(body).toContain('한국토지주택공사가 참여하고');
    expect(body).not.toContain('공사이 참여');
  });

  it('시공사명으로 만든 변형을 앵커로 쓰지 않는다', () => {
    // 실제로 `- [동구 대우건설](/apt/부산-수정5-재개발)` 이 나갔다.
    expect(buildBody(동구, 동구.items, NONE, YM)).not.toContain('[동구 대우건설]');
  });

  it('연한을 숫자로 지어내지 않는다 — built_year 가 재건축 현장 전체에서 0건이다', () => {
    const body = buildBody(해운대구, 해운대구.items, NONE, YM);
    expect(body).toContain('대부분 30년입니다');
    // "평균 준공 1993년" 같은 구별 연도 주장이 있으면 안 된다.
    expect(body).not.toMatch(/평균\s*준공/);
  });
});

describe('decideSplit — 양쪽이 다 글이 될 때만 나눈다', () => {
  it('해운대구는 재건축 19곳이지만 나누지 않는다 — 본편에 6곳만 남아 얇아진다', () => {
    const dec = decideSplit(해운대구, 해운대구.items, YM, NONE, MIN);
    expect(dec.split).toBe(false);
    expect(dec.mainItems).toHaveLength(해운대구.items.length); // 통합편으로 되돌아간다
    expect(dec.rebuildItems).toHaveLength(0);
    expect(dec.revertedMessage).toBeTruthy();
  });

  it('되돌린 사유에 양쪽 실측 길이가 남는다 — 카운터만 보면 원인을 못 찾는다', () => {
    const dec = decideSplit(해운대구, 해운대구.items, YM, NONE, MIN);
    expect(dec.revertedMessage).toMatch(/main 6곳 \d+자/);
    expect(dec.revertedMessage).toMatch(/rebuild 19곳 \d+자/);
  });

  it('재건축이 하한 미만이면 애초에 재지 않는다', () => {
    const few: Digest = {
      ...해운대구,
      split_rebuild: true,
      items: 해운대구.items.filter((i) => i.project_type === '재건축').slice(0, MIN_SPLIT_ITEMS - 1),
    };
    expect(decideSplit(few, few.items, YM, NONE, MIN).split).toBe(false);
  });

  it('DB 가 split_rebuild=false 로 주면 나누지 않는다', () => {
    expect(decideSplit(동구, 동구.items, YM, NONE, MIN).split).toBe(false);
  });
});

describe('pickRepresentatives — 제목 대표 구역', () => {
  it('브랜드명 단독 행을 대표로 쓰지 않는다', () => {
    // 실측: 「부산진구 재개발 총정리 — 아크로 라로체, …」 — 구역명이 아니라 분양 브랜드다.
    const items = [
      { raw_name: '아크로 라로체', name: '부산진구 아크로 라로체' },
      { raw_name: '범천1-1 재개발', name: '부산 범천1-1 재개발' },
      { raw_name: '당감1 재건축', name: '부산 당감1 재건축' },
    ] as DigestItem[];
    const rep = pickRepresentatives(items, '부산', 3);
    expect(rep).not.toContain('아크로 라로체');
    expect(rep).toEqual(['범천1-1 재개발', '당감1 재건축']);
  });

  it('표기만 다른 같은 구역을 두 번 쓰지 않는다', () => {
    // 실측: 「범천1-1 재개발, 부산 범천1-1구역 재개발」이 나란히 올라왔다.
    const items = [
      { raw_name: '범천1-1 재개발', name: 'a' },
      { raw_name: '부산 범천1-1구역 재개발', name: 'b' },
      { raw_name: '당감1 재건축', name: 'c' },
    ] as DigestItem[];
    expect(pickRepresentatives(items, '부산', 3)).toEqual(['범천1-1 재개발', '당감1 재건축']);
  });

  it('후보가 하나도 없으면 필터를 푼다 — 제목은 반드시 만들어져야 한다', () => {
    const items = [{ raw_name: '해운대 마티안 디에디션', name: 'x' }] as DigestItem[];
    expect(pickRepresentatives(items, '부산', 2)).toEqual(['해운대 마티안 디에디션']);
  });

  it('분리편은 접미어를 뗀다 — 소규모까지 같이', () => {
    const items = [
      { raw_name: '신서면아파트 소규모재건축', name: 'a' },
      { raw_name: '양정산호아파트 소규모재건축', name: 'b' },
    ] as DigestItem[];
    expect(pickRepresentatives(items, '부산', 2, true)).toEqual(['신서면아파트', '양정산호아파트']);
  });
});

describe('stripTypeSuffix', () => {
  it('재건축·소규모재건축·재개발·가로주택정비를 뗀다', () => {
    expect(stripTypeSuffix('재송2 재건축')).toBe('재송2');
    expect(stripTypeSuffix('신서면아파트 소규모재건축')).toBe('신서면아파트');
    expect(stripTypeSuffix('일동파크맨션(소규모) 소규모재건축')).toBe('일동파크맨션(소규모)');
    expect(stripTypeSuffix('범천1-1 재개발')).toBe('범천1-1');
    expect(stripTypeSuffix('좌천2구역 가로주택정비')).toBe('좌천2구역');
  });

  it('이름이 접미어뿐이면 원본을 돌려준다 — 빈 문자열을 만들지 않는다', () => {
    expect(stripTypeSuffix('재건축')).toBe('재건축');
  });
});

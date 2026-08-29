/**
 * PV-5a 후검증 판정 (§6 · D4 · D6).
 *
 * 이 파일이 지키는 것: «독립 출처는 매체 수가 아니라 원출처 수다».
 * 같은 보도자료를 받아쓴 기사 12건을 12로 세면, 조합이 흘린 미확정 수치가
 * 하루 만에 verified 로 승격되고 §7-1 의 「확정 표기」를 얻는다.
 */
import { describe, expect, it } from 'vitest';
import {
  QUEUE_TIERS,
  autoApplicable,
  countIndependent,
  judgeField,
  queueStats,
  queueTier,
  type Claim,
} from '@/lib/verify/facts';

const press = (v: string | number, n = 1): Claim[] =>
  Array.from({ length: n }, (_, i) => ({ value: v, kind: 'press' as const, url: `https://news/${i}` }));

describe('⛔ 독립 출처는 «원출처» 수다', () => {
  it('언론 12건은 출처 «1» 이다 — 받아쓰기', () => {
    expect(countIndependent(press('HDC', 12))).toBe(1);
  });
  it('그래서 언론만 있으면 verified 가 «될 수 없다»', () => {
    const v = judgeField(press('1,901세대', 12));
    expect(v.confidence).toBe('rumor');
    expect(v.independentSources).toBe(1);
    expect(v.note).toContain('받아쓰기');
  });
  it('공시 + 언론이면 «2» 다 — 종류가 다르면 독립이다', () => {
    const v = judgeField([{ value: 'HDC', kind: 'disclosure', originKey: '2022-11' }, ...press('HDC', 5)]);
    expect(v.confidence).toBe('verified');
    expect(v.independentSources).toBe(2);
  });
  it('같은 종류라도 originKey 가 다르면 독립이다', () => {
    expect(countIndependent([
      { value: 'x', kind: 'union', originKey: '2025-총회' },
      { value: 'x', kind: 'union', originKey: '2026-공고' },
    ])).toBe(2);
  });
  it('originKey 가 없으면 같은 종류끼리 «접힌다» — 모르면 늘리지 않는다', () => {
    expect(countIndependent([
      { value: 'x', kind: 'builder' }, { value: 'x', kind: 'builder' }, { value: 'x', kind: 'builder' },
    ])).toBe(1);
  });
});

describe('필드 판정 (D6 5값)', () => {
  it('독립 2 이상 일치 → verified', () => {
    const v = judgeField([
      { value: 504, kind: 'disclosure', originKey: 'd1' },
      { value: 504, kind: 'announcement', originKey: 'a1' },
    ]);
    expect(v).toMatchObject({ confidence: 'verified', value: 504, independentSources: 2 });
  });
  it('단일 원출처 → estimated', () => {
    expect(judgeField([{ value: 504, kind: 'builder', originKey: 'b' }]).confidence).toBe('estimated');
  });
  it('근거 없음 → rumor · 값 null', () => {
    expect(judgeField([])).toMatchObject({ confidence: 'rumor', value: null, independentSources: 0 });
    expect(judgeField([{ value: null, kind: 'press' }]).confidence).toBe('rumor');
  });

  it('⛔ 값이 갈리면 conflicting 이고 «값을 고르지 않는다» — 다수결로 사실을 정하지 않는다', () => {
    // 구서3: 공식 361 vs 앱 415 (P0-4 conflicting 큐 1호)
    const v = judgeField([
      { value: 361, kind: 'announcement', originKey: 'a' },
      { value: 361, kind: 'disclosure', originKey: 'd' },
      { value: 415, kind: 'press' },
    ]);
    expect(v.confidence).toBe('conflicting');
    expect(v.value).toBeNull();                    // 2:1 이어도 고르지 않는다
    expect(v.disagreement).toHaveLength(2);
    expect(v.note).toContain('갈렸다');
  });

  it('공백·대소문자 차이는 «같은 값» 이다', () => {
    const v = judgeField([
      { value: '래미안 마크 더 스위트', kind: 'disclosure', originKey: 'd' },
      { value: '래미안마크더스위트', kind: 'builder', originKey: 'b' },
    ]);
    expect(v.confidence).toBe('verified');
  });
});

describe('⛔ D4 자동 반영 경계', () => {
  const verified = judgeField([
    { value: 'x', kind: 'disclosure', originKey: 'd' },
    { value: 'x', kind: 'union', originKey: 'u' },
  ]);
  it('이름·변형·시공사만 자동이다', () => {
    for (const f of ['display_name', 'name_variants', 'builder']) expect(autoApplicable(f, verified)).toBe(true);
  });
  it('세대수·가격·stage·slug 는 verified 여도 «검수 큐» 다', () => {
    for (const f of ['total_units', 'price_min', 'lifecycle_stage', 'slug']) {
      expect(autoApplicable(f, verified)).toBe(false);
    }
  });
  it('verified 가 아니면 이름도 자동이 아니다', () => {
    expect(autoApplicable('display_name', judgeField(press('x', 9)))).toBe(false);
  });
});

describe('큐 우선순위 (§6)', () => {
  it('6층 순서를 고정한다', () => {
    expect(QUEUE_TIERS).toEqual(['ad_landing', 'curated', 'pre_ann_urgent', 'pre_ann', 'lead', 'rest']);
  });
  it('파워링크 착지가 최상위 — 돈이 나가는 자리부터', () => {
    expect(queueTier({ slug: 'a', adLanding: true, lifecycleStage: 'pre_announcement' })).toBe('ad_landing');
  });
  it('seed:web · source_ids 빈 것이 pre_announcement 안에서 «1순위»', () => {
    expect(queueTier({ slug: 'a', lifecycleStage: 'pre_announcement', stageSource: 'seed:web-2026-08-24' })).toBe('pre_ann_urgent');
    expect(queueTier({ slug: 'b', lifecycleStage: 'pre_announcement', noSourceIds: true })).toBe('pre_ann_urgent');
    expect(queueTier({ slug: 'c', lifecycleStage: 'pre_announcement', stageSource: 'permit' })).toBe('pre_ann');
  });

  it('⚠️ 앞 층이 두꺼우면 뒤 층이 «굶는다» — 그 사실을 숫자로 낸다', () => {
    // 2026-08-29 실측 규모: 파워링크 착지 578 · 큐레이션 5 · 분양예정 27
    const sites = [
      ...Array.from({ length: 578 }, (_, i) => ({ slug: `ad${i}`, adLanding: true })),
      ...Array.from({ length: 5 }, (_, i) => ({ slug: `cu${i}`, curated: true })),
      ...Array.from({ length: 15 }, (_, i) => ({ slug: `pu${i}`, lifecycleStage: 'pre_announcement', noSourceIds: true })),
    ];
    const stats = queueStats(sites, 20);
    const urgent = stats.find((s) => s.tier === 'pre_ann_urgent')!;
    expect(urgent.count).toBe(15);
    // 앞의 583건을 다 본 뒤에야 닿는다 — 하루 20건이면 30일이다.
    expect(urgent.daysToReach).toBe(30);
  });
});

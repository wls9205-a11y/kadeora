// DS2 §7① — 단계 톤 매핑 잠금.
//
// 여기서 잠그는 것은 «색» 이 아니라 두 가지 규율이다:
//   ① 실제 DB 에 있는 stage 가 하나도 색 없이 남지 않는다
//   ② 라벨을 뭉개지 않는다 — 설계서 §1 이 4개 정비 단계를 「공고 전」 하나로 접자고 했고
//      그러면 관리처분인가 같은 실무 분기가 화면에서 사라진다. 그 되돌림을 막는다.
import { describe, it, expect } from 'vitest';
import { TONE, STAGE_TONE, stageToneOf, isUnmappedStage, type Tone } from '@/components/ds/tone';
import { LIFECYCLE_LABEL, lifecycleLabel } from '@/lib/apt/lifecycle-label';

/** 2026-09-09 실측: apt_sites.lifecycle_stage 의 실재 값 15종(NULL 포함). */
const LIVE_STAGES = [
  'post_move_in', 'construction', 'site_planning', 'unsold_active', 'union_established',
  'move_in_started', 'landmark_active', 'plan_approved', 'pre_announcement',
  'mgmt_approved', 'award_announced', 'subscription_open', 'award_pending', 'constructor_selected',
];

describe('단계 톤 매핑', () => {
  it('실재하는 stage 는 «전부» 색을 갖는다 — 미확인으로 떨어지지 않는다', () => {
    const orphan = LIVE_STAGES.filter((s) => stageToneOf(s) === 'stageUnknown');
    expect(orphan).toEqual([]);
  });

  it('라벨 원본의 모든 키가 매핑돼 있다 — 어휘가 늘면 여기서 먼저 깨진다', () => {
    const unmapped = Object.keys(LIFECYCLE_LABEL).filter((s) => !(s in STAGE_TONE));
    expect(unmapped).toEqual([]);
  });

  it('NULL 과 미매핑은 «화면상» 같은 칸이다', () => {
    expect(stageToneOf(null)).toBe('stageUnknown');
    expect(stageToneOf(undefined)).toBe('stageUnknown');
    expect(stageToneOf('무슨_새로운_단계')).toBe('stageUnknown');
  });

  it('그러나 로그에서는 갈린다 — NULL 은 «미매핑» 이 아니다', () => {
    expect(isUnmappedStage(null)).toBe(false);
    expect(isUnmappedStage('무슨_새로운_단계')).toBe(true);
    expect(isUnmappedStage('construction')).toBe(false);
  });

  // ⛔ 이 검사가 설계서 §1 의 라벨 뭉개기를 막는다.
  it('색은 묶여도 라벨은 «갈린 채로» 남는다', () => {
    const planned = ['union_established', 'plan_approved', 'mgmt_approved', 'site_planning'];
    // 색은 하나로 묶인다 — 스캔축을 얻는 부분.
    expect(new Set(planned.map(stageToneOf))).toEqual(new Set(['stagePlanned']));
    // 그러나 글자는 넷이 다 다르다 — 정보를 안 버리는 부분.
    const labels = planned.map((s) => lifecycleLabel(s));
    expect(new Set(labels).size).toBe(4);
    expect(labels).toContain('관리처분인가');
  });

  it('접수 마감 전후를 한 칸으로 뭉치지 않는다', () => {
    // 색은 같아도(둘 다 발표 라인) 라벨이 «지원할 수 있다» 로 읽히면 안 된다.
    expect(lifecycleLabel('award_pending')).toBe('당첨자 발표 대기');
    expect(lifecycleLabel('award_announced')).toBe('당첨자 발표');
  });
});

describe('감사 커버리지', () => {
  it('선언된 모든 톤이 TONE 표에 있다 — 표에 없으면 대비 감사가 못 본다', () => {
    const declared: Tone[] = [
      'neutral', 'brand', 'success', 'warning', 'error', 'info',
      'stagePlanned', 'stagePreSale', 'stageOpen', 'stageAward',
      'stageBuild', 'stageMoveIn', 'stageClosed', 'stageTerminated', 'stageUnknown',
    ];
    for (const t of declared) expect(TONE[t], t).toBeTruthy();
    expect(Object.keys(TONE).length).toBe(declared.length);
  });

  it('모든 톤이 «무엇 위에 얹히는지» 를 말한다 — on 없이는 대비를 잴 수 없다', () => {
    for (const [name, t] of Object.entries(TONE)) {
      expect(t.on, name).toBeTruthy();
      expect(t.fg, name).toBeTruthy();
      expect(t.bg, name).toBeTruthy();
    }
  });
});

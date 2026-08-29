/**
 * PV-3b 수명 판정 (§6 좀비 방지).
 *
 * 이 파일이 지키는 것: «모르는 것을 지연으로 세지 않는다».
 * 착공예정일은 arch 트랙에서 6자리로 오거나 아예 비어 있다. 그걸 「지났다」로
 * 읽으면 멀쩡한 현장이 조용히 목록에서 내려간다 — 오늘 하루 종일 잡은 그 형태다.
 */
import { describe, expect, it } from 'vitest';
import {
  EXISTING_STAGE,
  HOLD_STAGE,
  PRE_ANNOUNCEMENT,
  STALE_DAYS,
  judgeLifecycle,
  summarize,
  type LifecycleFacts,
} from '@/lib/permits/lifecycle';

const NOW = new Date('2026-08-29T00:00:00Z');
const base: LifecycleFacts = {
  stage: PRE_ANNOUNCEMENT,
  stageSource: 'permit',
  constructStartExpected: '2026-01-01',   // +180일 = 2026-06-30 → 이미 지났다
  stageUpdatedAt: '2026-01-05',
};

describe('강등 — 착공예정 +180일 무변화', () => {
  it('기간이 지나고 그 뒤로 안 움직였으면 강등 대상이다', () => {
    const v = judgeLifecycle(base, NOW);
    expect(v.action).toBe('demote_hold');
    expect(v.reason).toContain(String(STALE_DAYS));
    expect(v.daysToStale).toBeLessThan(0);
  });

  it('기간 전이면 유지하고 «남은 일수» 를 준다', () => {
    const v = judgeLifecycle({ ...base, constructStartExpected: '2026-08-01' }, NOW);
    expect(v.action).toBe('hold');
    expect(v.daysToStale).toBeGreaterThan(0);
  });

  it('⚠️ 기간이 지났어도 «그 사이 움직였으면» 살아 있다', () => {
    const v = judgeLifecycle({ ...base, stageUpdatedAt: '2026-08-20' }, NOW);
    expect(v.action).toBe('hold');
    expect(v.reason).toContain('갱신됨');
  });

  it('⛔ 착공예정일을 «모르면» 강등하지 않는다 — 모르는 것과 지연은 다르다', () => {
    for (const bad of [null, undefined, '']) {
      const v = judgeLifecycle({ ...base, constructStartExpected: bad }, NOW);
      expect(v.action).toBe('hold');
      expect(v.reason).toContain('모르는 것을 지연으로 세지 않는다');
    }
  });

  it('YYYYMMDD 원문 형태도 읽는다 (permit 원문이 그렇게 온다)', () => {
    expect(judgeLifecycle({ ...base, constructStartExpected: '20260101' }, NOW).action).toBe('demote_hold');
  });
});

describe('승격 — 사용승인이 지연 추정보다 «강하다»', () => {
  it('사용승인이 잡히면 기간과 무관하게 기축 축으로', () => {
    const v = judgeLifecycle({ ...base, useApproval: '2026-07-01' }, NOW);
    expect(v.action).toBe('promote_existing');
    expect(EXISTING_STAGE).toBe('post_move_in');
  });
  it('미래 날짜의 «사용승인 예정» 은 아직 승격이 아니다', () => {
    expect(judgeLifecycle({ ...base, useApproval: '2027-01-01' }, NOW).action).toBe('demote_hold');
  });
});

describe('⛔ 남의 값을 되돌리지 않는다 (H7-2 · D3)', () => {
  it('사람이 잠근 현장은 판정하지 않는다', () => {
    const v = judgeLifecycle({ ...base, stageLocked: true }, NOW);
    expect(v.action).toBe('hold');
    expect(v.reason).toContain('사람이 잠갔다');
  });
  it('permit 유래가 «아니면» 강등하지 않는다', () => {
    for (const src of ['manual:urgent-20260829', 'seed:web-2026-08-24', null]) {
      expect(judgeLifecycle({ ...base, stageSource: src }, NOW).action).toBe('hold');
    }
  });
  it('분양 축 시작점이 아니면 건드리지 않는다', () => {
    for (const st of ['construction', 'post_move_in', 'mgmt_approved', null]) {
      expect(judgeLifecycle({ ...base, stage: st }, NOW).action).toBe('hold');
    }
  });
  it('잠금이 사용승인보다 «먼저» 다 — 사람이 정한 것이 최우선', () => {
    const v = judgeLifecycle({ ...base, stageLocked: true, useApproval: '2026-07-01' }, NOW);
    expect(v.action).toBe('hold');
  });
});

describe('큐 요약 — 모집단을 함께 낸다', () => {
  it('강등·승격·유지·미상을 갈라 센다', () => {
    const s = summarize([
      base,                                             // demote
      { ...base, useApproval: '2026-07-01' },            // promote
      { ...base, constructStartExpected: null },         // hold(미상)
      { ...base, stageLocked: true },                    // hold(잠금)
      { ...base, constructStartExpected: '2026-08-01' }, // hold(기간 전)
    ], NOW);
    expect(s).toMatchObject({ total: 5, demote: 1, promote: 1, hold: 3, locked: 1, unknown_start: 1 });
  });
});

describe('어휘', () => {
  it('⚠️ 「보류」는 아직 실제 어휘에 «없다» — 신설 여부가 안건이다', () => {
    // 2026-08-29 실측: lifecycle_stage 는 text 13종이고 on_hold 가 없다.
    // 상수는 두되, 이 판정부는 «목표 값을 쓰지 않는다»(호출자가 정한다).
    expect(HOLD_STAGE).toBe('on_hold');
    expect(judgeLifecycle(base, NOW).action).toBe('demote_hold'); // 값이 아니라 «행동» 을 낸다
  });
});

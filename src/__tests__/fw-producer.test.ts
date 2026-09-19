// FW 생산자 — 스위치 off 면 적재 0, 훅은 backfill 을 거른다.
import { describe, it, expect } from 'vitest';
import { fwSwitch, stageHook, enqueue } from '@/lib/fw/producer';
import { reviewHoldOf, isReviewHoldReason, SCAN2_NAMESPACES } from '@/lib/content/review-hold';

/** 호출 기록만 남기는 체이너블 목. */
function mockSb(tables: Record<string, any[]>, log: any[] = []) {
  return {
    log,
    from(t: string) {
      const q: any = { t, ops: [] as any[] };
      const chain = new Proxy(q, {
        get(target, k: string) {
          if (k === 'then') return (res: any) => res({ data: tables[t] ?? [], error: null });
          if (k === 'maybeSingle') return async () => ({ data: (tables[t] ?? [])[0] ?? null, error: null });
          if (k === 'insert') return (rows: any[]) => { log.push({ t, insert: rows }); return { select: async () => ({ data: rows, error: null }) }; };
          return (...a: any[]) => { target.ops.push([k, ...a]); log.push({ t, op: k, a }); return chain; };
        },
      });
      return chain;
    },
  };
}

describe('fw 스위치', () => {
  it('정확히 true 만 켜짐', async () => {
    expect(await fwSwitch(mockSb({ app_config: [] }), 'producer_enabled')).toBe(false);
    expect(await fwSwitch(mockSb({ app_config: [{ value: 'true' }] }), 'producer_enabled')).toBe(false);
    expect(await fwSwitch(mockSb({ app_config: [{ value: true }] }), 'producer_enabled')).toBe(true);
  });
});

describe('stageHook', () => {
  it('backfill 필터를 건다', async () => {
    const sb = mockSb({ apt_site_events: [] });
    expect(await stageHook(sb, '2026-09-19T00:00:00Z')).toEqual([]);
    expect(sb.log.some((l: any) => l.op === 'not' && l.a[0] === 'source' && l.a[2] === 'backfill:%')).toBe(true);
  });
});

describe('enqueue 규격', () => {
  it('fw_hub · site_compact · 출처 비움 · 표기명 앞쪽', async () => {
    const sb = mockSb({});
    await enqueue(sb, [{ id: 'u1', slug: 's1', name: '광안5구역', display_name: '광안 리버뷰 — 광안5구역', region: '부산', sigungu: '수영구' }], 'redev', 'rotation');
    const row = sb.log.find((l: any) => l.insert).insert[0];
    expect(row).toMatchObject({ source_type: 'fw_hub', source_urls: [], apt_site_id: 'u1', title: '광안 리버뷰 사업 단계·일정 정리' });
    expect(row.raw_data.template).toBe('site_compact');
  });
});

describe('review-hold fw', () => {
  it('fw_hub 는 hold:fw_review 도장 · 스캔2 레일', () => {
    expect(reviewHoldOf({ source_type: 'fw_hub' })).toEqual({ namespace: 'fw', reason: 'hold:fw_review', stampReason: true });
    expect(isReviewHoldReason('hold:fw_review:scan2')).toBe(true);
    expect(SCAN2_NAMESPACES.has('fw') && SCAN2_NAMESPACES.has('bn') && !SCAN2_NAMESPACES.has('bp')).toBe(true);
  });
});

import { kstDayStartIso } from '@/lib/fw/producer';
describe('FW 일 캡', () => {
  it('KST 자정 경계', () => {
    expect(kstDayStartIso(new Date('2026-09-19T07:30:00Z'))).toBe('2026-09-18T15:00:00.000Z');
    expect(kstDayStartIso(new Date('2026-09-19T15:01:00Z'))).toBe('2026-09-19T15:00:00.000Z');
  });
});

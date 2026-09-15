/** AB-1 — 단지 개요 정의문·불릿 (AI 무호출). */
import { describe, expect, it } from 'vitest';
import { buildSiteOverview } from '@/lib/apt/site-overview';
import type { ScheduleRow } from '@/lib/apt/schedule';

const row = (p: Partial<ScheduleRow>): ScheduleRow => ({
  key: 'expected', label: '분양예정 시기', text: '2026년 10월 분양예정', state: 'future', dday: null,
  source: '언론 보도', asof: '2026-09-10', confidence: 'estimated', ...p,
} as ScheduleRow);

describe('AB-1 단지 개요', () => {
  it('전 필드 — 정의문 두 문장 + 기준일 병기', () => {
    const o = buildSiteOverview({
      name: '거제 옥포 공동주택', region: '경남', sigungu: '거제시', dong: '옥포동', builder: '현대엔지니어링',
      siteType: 'subscription', stageLabel: '분양 예고', units: 1963, maxFloor: 36, schedule: [row({})],
      priceText: null,
    });
    expect(o.lead).toBe('거제 옥포 공동주택은(는) 경남 거제시 옥포동에 들어서는 현대엔지니어링의 분양 단지입니다. 1,963세대·최고 36층 규모로, 분양예정 시기 2026년 10월 분양예정(언론 보도 · 2026-09-10 기준)입니다.');
    expect(o.bullets.map((b) => b.label)).toEqual(['위치', '규모', '시공사', '진행 단계', '일정']);
  });

  it('NULL 필드는 문장·불릿에서 탈락 — 자리표시 없음', () => {
    const o = buildSiteOverview({ name: 'SKY.V 센텀', region: '부산', sigungu: '해운대구' });
    expect(o.lead).toBe('SKY.V 센텀은(는) 부산 해운대구에 들어서는 아파트 단지입니다.');
    expect(o.lead).not.toMatch(/미정|null|undefined|-세대/);
    expect(o.bullets).toEqual([{ label: '위치', value: '부산 해운대구' }]);
  });

  it('「부산」·「부산진구」 겹침을 지우지 않는다', () => {
    expect(buildSiteOverview({ name: 'X', region: '부산', sigungu: '부산진구', dong: '범전동' }).bullets[0].value).toBe('부산 부산진구 범전동');
  });

  it('일정이 없으면 단계로, 준공 단지는 「위치한」', () => {
    const o = buildSiteOverview({ name: '가야역 롯데캐슬 스카이엘', region: '부산', sigungu: '부산진구', builder: '롯데건설', siteType: 'subscription', stageLabel: '입주 후', units: 725, built: true });
    expect(o.lead).toBe('가야역 롯데캐슬 스카이엘은(는) 부산 부산진구에 위치한 롯데건설의 분양 단지입니다. 725세대 규모로, 현재 입주 후 단계입니다.');
  });

  it('가격은 넘겨받은 것만 — 호출부가 합성가를 비우면 불릿이 없다', () => {
    expect(buildSiteOverview({ name: 'X', priceText: null }).bullets.find((b) => b.label === '분양가')).toBeUndefined();
    expect(buildSiteOverview({ name: 'X', priceText: '4.9억~14.6억' }).bullets.find((b) => b.label === '분양가')?.value).toBe('4.9억~14.6억');
  });
});

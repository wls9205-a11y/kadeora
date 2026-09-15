/** E-7·E-11 — 지역 허브 분양예정 목록·질문형 FAQ 판정. */
import { describe, expect, it } from 'vitest';
import { periodWindow, upcomingFaqs, upcomingItems } from '@/lib/apt/upcoming-sales';

const rows = [
  { slug: 'a', name: '연제 갤러리 자이', sigungu: '연제구', period: '2026-10' },
  { slug: 'b', name: '초량 호반써밋 센트럴베이', sigungu: '동구', period: '2026Q3' },
  { slug: 'c', name: '트리븐 센텀', sigungu: '해운대구', period: '2026' },
  { slug: 'd', name: '부산명지 A-5BL', sigungu: '강서구', period: '2026-01' },   // 지나감
  { slug: 'e', name: '가야1', sigungu: '부산진구', period: '2027' },
  { slug: 'f', name: '깨진 값', period: '26년 하반기' },
];

describe('periodWindow', () => {
  it('정밀도별 구간', () => {
    expect(periodWindow('2026-10')).toEqual({ start: '2026-10', end: '2026-10' });
    expect(periodWindow('2026Q3')).toEqual({ start: '2026-07', end: '2026-09' });
    expect(periodWindow('2026H2')).toEqual({ start: '2026-07', end: '2026-12' });
    expect(periodWindow('2026')).toEqual({ start: '2026-01', end: '2026-12' });
    expect(periodWindow('26년')).toBeNull();
  });
});

describe('upcomingItems', () => {
  it('지나간 시기·못 읽는 값은 빼고, 구간이 먼저 끝나는 순(연도만 아는 값이 앞서지 않는다)', () => {
    const items = upcomingItems(rows, '2026-09');
    expect(items.map((i) => i.slug)).toEqual(['b', 'a', 'c', 'e']);
  });
});

describe('upcomingFaqs', () => {
  it('하반기 질문에는 연도만 아는 현장을 넣지 않는다', () => {
    const faqs = upcomingFaqs('부산', upcomingItems(rows, '2026-09'), '2026-09');
    expect(faqs[0].q).toBe('2026년 하반기 부산 분양 예정 단지는 어디인가요?');
    expect(faqs[0].a).toContain('2곳');
    expect(faqs[0].a).toContain('연제 갤러리 자이(연제구 · 2026년 10월 분양예정)');
    expect(faqs[0].a).not.toContain('트리븐 센텀');
    expect(faqs[1].q).toBe('부산에서 곧 분양하는 아파트는 어디인가요?');
  });
  it('데이터가 없으면 질문을 만들지 않는다', () => {
    expect(upcomingFaqs('제주', [], '2026-09')).toEqual([]);
  });
});

/**
 * LB-4 L1 — 미래지향 우선순위 정렬 (2026-09-08). AI·DB 무호출.
 */
import { describe, expect, it } from 'vitest';
import {
  isPriorityRegion,
  priorityOf,
  sortForGeneration,
  type TopicRow,
} from '@/lib/content/realestate-priority';

const row = (o: Partial<TopicRow>): TopicRow => ({ category: 'apt', ...o });

describe('LB-4 — P순위', () => {
  it('P1 = CV-N 이 잡은 이름 사건(win·name_confirm)', () => {
    expect(priorityOf(row({ source_type: 'cvn_name_event', sub_category: 'win' }))).toBe(1);
    expect(priorityOf(row({ source_type: 'cvn_name_event', sub_category: 'name_confirm' }))).toBe(1);
  });

  it('개명·해지는 P1 이 아니라 P3 — 정정·현황 글감이다', () => {
    expect(priorityOf(row({ source_type: 'cvn_name_event', sub_category: 'cancel' }))).toBe(3);
    expect(priorityOf(row({ source_type: 'cvn_name_event', sub_category: 'rename' }))).toBe(3);
  });

  it('P2 = 분양예정·모집공고 전', () => {
    expect(priorityOf(row({ title: '해운대 중동5 분양예정 일정' }))).toBe(2);
    expect(priorityOf(row({ title: '문현1 입주자 모집공고 임박' }))).toBe(2);
  });

  it('P3 = 정비사업 단계 변화', () => {
    expect(priorityOf(row({ title: '가야1 관리처분 인가' }))).toBe(3);
    expect(priorityOf(row({ title: '우동1 재건축 시공사 재선정 추진' }))).toBe(3);
  });

  it('P4 = 청약 임박', () => {
    expect(priorityOf(row({ source_type: 'apt_subscription', title: '청약 접수 시작' }))).toBe(4);
  });

  it('⚠️ 분양예정과 청약이 한 문장에 있으면 «앞선 단계» 로 본다', () => {
    expect(priorityOf(row({ source_type: 'apt_subscription', title: '분양예정 단지 청약 일정' }))).toBe(2);
  });

  it('P5 = 그 밖의 부동산(기축 시세 등)', () => {
    expect(priorityOf(row({ title: '해운대 아파트 시세 동향' }))).toBe(5);
  });

  it('부동산이 아니면 9 — 기존 순서를 흔들지 않는다', () => {
    expect(priorityOf(row({ category: 'stock', title: '삼성전자 실적' }))).toBe(9);
    expect(priorityOf(row({ category: 'finance', title: 'ETF 비교' }))).toBe(9);
  });
});

describe('LB-4 — 지역 가중', () => {
  it('시·도가 있으면 그것을 먼저 본다', () => {
    expect(isPriorityRegion({ region_sido: '부산', region_sigungu: '남구' })).toBe(true);
    expect(isPriorityRegion({ region_sido: '경남', region_sigungu: '창원시' })).toBe(true);
  });

  it('⚠️ 「남구」는 다른 시·도에도 있다 — 시·도가 다르면 가중하지 않는다', () => {
    expect(isPriorityRegion({ region_sido: '광주', region_sigungu: '남구' })).toBe(false);
    expect(isPriorityRegion({ region_sido: '서울', region_sigungu: '동작구' })).toBe(false);
  });

  it('지역을 모르면 가중하지 않는다', () => {
    expect(isPriorityRegion({})).toBe(false);
  });
});

describe('LB-4 — 정렬', () => {
  it('P순위가 점수를 이긴다 — 고득점 주식글보다 CV-N 이름 사건이 먼저다', () => {
    const out = sortForGeneration([
      row({ category: 'stock', title: '고득점 주식', final_score: 99 }),
      row({ source_type: 'cvn_name_event', sub_category: 'win', title: '이름 확정', final_score: 45 }),
    ]);
    expect(out[0].row.title).toBe('이름 확정');
    expect(out[0].priority).toBe(1);
  });

  it('같은 P 안에서는 지역 가중이 앞선다', () => {
    const out = sortForGeneration([
      row({ title: '서울 분양예정', region_sido: '서울', final_score: 50 }),
      row({ title: '부산 분양예정', region_sido: '부산', final_score: 50 }),
    ]);
    expect(out[0].row.title).toBe('부산 분양예정');
  });

  it('⚠️ 점수를 버리지 않는다 — 같은 P·같은 지역이면 고득점이 먼저다', () => {
    const out = sortForGeneration([
      row({ title: '저품질', region_sido: '부산', final_score: 30 }),
      row({ title: '고품질', region_sido: '부산', final_score: 80 }),
    ]);
    expect(out[0].row.title).toBe('고품질');
  });

  it('점수까지 같으면 신선한 것이 먼저다', () => {
    const out = sortForGeneration([
      row({ title: '어제', region_sido: '부산', final_score: 50, detected_at: '2026-09-07T00:00:00Z' }),
      row({ title: '오늘', region_sido: '부산', final_score: 50, detected_at: '2026-09-08T00:00:00Z' }),
    ]);
    expect(out[0].row.title).toBe('오늘');
  });

  it('전부 같으면 원래 순서를 유지한다(안정 정렬)', () => {
    const rows = [row({ title: 'a' }), row({ title: 'b' }), row({ title: 'c' })];
    expect(sortForGeneration(rows).map((x) => x.row.title)).toEqual(['a', 'b', 'c']);
  });

  it('지역 글감이 마르면 전국이 자연히 올라온다 — 하드 쿼터가 아니다', () => {
    const out = sortForGeneration([
      row({ title: '서울 이름확정', source_type: 'cvn_name_event', sub_category: 'win', region_sido: '서울' }),
      row({ title: '부산 시세', region_sido: '부산', final_score: 90 }),
    ]);
    expect(out[0].row.title).toBe('서울 이름확정');
  });
});

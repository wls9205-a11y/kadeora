// 카운트가 «조용히 어긋나지 않는다» 를 잠근다.

import { describe, it, expect } from 'vitest';
import { buildRegionCounts, tallyText, type RegionCountRow } from '@/lib/region/select-counts';

const rows: RegionCountRow[] = [
  { region: '부산', sigungu: '해운대구', upcoming: 10, open_now: 2 },
  { region: '부산', sigungu: '사상구', upcoming: 5, open_now: 0 },
  { region: '부산', sigungu: '', upcoming: 3, open_now: 1 },          // 시군구 미상
  { region: '부산', sigungu: '없는구', upcoming: 2, open_now: 0 },     // 라벨에 없음
  { region: '광주', sigungu: '동구', upcoming: 4, open_now: 1 },       // 병합 칸(12)
  { region: '전남', sigungu: '목포시', upcoming: 6, open_now: 3 },     // 같은 칸
  { region: '세종', sigungu: '세종시', upcoming: 1, open_now: 1 },
  // ⚠️ 실측에 있는 «안 맞는» 표기들. 지어내서 붙이지 않고 「그 외」로 센다.
  { region: '세종', sigungu: '세종특별자치시', upcoming: 2, open_now: 0 },
  { region: '제주', sigungu: '표선면', upcoming: 0, open_now: 1 },
  { region: '없는도', sigungu: '어딘가', upcoming: 7, open_now: 7 },   // 시도조차 없음
];

describe('시도 집계', () => {
  const c = buildRegionCounts(rows);

  it('시도 칸의 수 = 칩 합 + 「그 외」 — 어긋나지 않는다', () => {
    const busan = c.bySidoCode.get('26')!;
    expect(busan.matched).toEqual({ upcoming: 15, open: 2 });
    expect(busan.other).toEqual({ upcoming: 5, open: 1 });   // 미상 3+1 · 라벨없음 2+0
    expect(busan.total).toEqual({ upcoming: 20, open: 3 });
  });

  it('⛔ 「그 외」를 버리지 않는다 — 버리면 합이 말없이 줄어든다', () => {
    const busan = c.bySidoCode.get('26')!;
    expect(busan.other.upcoming + busan.matched.upcoming).toBe(busan.total.upcoming);
  });

  it('광주·전남은 «한 칸(12)» 으로 합쳐진다', () => {
    const merged = c.bySidoCode.get('12')!;
    expect(merged.total).toEqual({ upcoming: 10, open: 4 });
    expect(c.bySigunguLabel.get('광주 동구')).toEqual({ upcoming: 4, open: 1 });
    expect(c.bySigunguLabel.get('전남 목포시')).toEqual({ upcoming: 6, open: 3 });
  });

  it('세종은 라벨이 곧 시군구다 — 「세종 세종시」를 만들지 않는다', () => {
    expect(c.bySigunguLabel.get('세종시')).toEqual({ upcoming: 1, open: 1 });
  });

  it('⛔ 「세종특별자치시」를 «추측으로» 세종시에 붙이지 않는다 — 「그 외」다', () => {
    const sejong = c.bySidoCode.get('36')!;
    expect(sejong.matched).toEqual({ upcoming: 1, open: 1 });
    expect(sejong.other).toEqual({ upcoming: 2, open: 0 });
  });

  it('읍면(제주 표선면)은 시군구가 아니다 — 「그 외」로 센다', () => {
    const jeju = c.bySidoCode.get('50')!;
    expect(jeju.matched).toEqual({ upcoming: 0, open: 0 });
    expect(jeju.other).toEqual({ upcoming: 0, open: 1 });
  });

  it('시도조차 없는 행은 orphan 으로 «센다»', () => {
    expect(c.orphan).toEqual({ upcoming: 7, open: 7 });
  });

  it('전국 합은 모든 행의 합이다 — orphan 도 포함한다', () => {
    expect(c.nationwide).toEqual({ upcoming: 40, open: 16 });
  });
});

describe('문구', () => {
  it('0 을 숨기지 않는다 — 0 은 0 이다', () => {
    expect(tallyText({ upcoming: 0, open: 0 })).toBe('분양예정 0 · 분양중 0');
    expect(tallyText(undefined)).toBe('분양예정 0 · 분양중 0');
  });
});

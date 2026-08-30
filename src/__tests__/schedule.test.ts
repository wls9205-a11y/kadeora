// 「일정」 판정 자물쇠 — 일대기가 «지워지지도, 지어내지도» 않게.

import { describe, it, expect } from 'vitest';
import { buildSchedule, normDate, ymText, daysBetween } from '@/lib/apt/schedule';

const sub = {
  announcement_date: '20260810',
  spsply_rcept_bgnde: '20260901', spsply_rcept_endde: '20260901',
  rcept_bgnde: '20260902', rcept_endde: '20260904',
  przwner_presnatn_de: '20260911',
  cntrct_cncls_bgnde: '20260921', cntrct_cncls_endde: '20260923',
  mvn_prearnge_ym: '202812',
};
const site = {
  expected_sale_period: '2026-09', expected_sale_source: 'news',
  expected_sale_period_asof: '2026-08-10', confidence: 'verified',
  move_in_date: '2028년 12월',
};

describe('행 만들기', () => {
  it('절차 전체가 «위→아래» 로 온다', () => {
    const rows = buildSchedule({ site, sub, today: '2026-08-30' });
    expect(rows.map((r) => r.key)).toEqual([
      'expected', 'announcement', 'special', 'apply', 'winner', 'contract', 'move_in',
    ]);
  });

  it('⛔ 값 없는 행은 «아예 없다» — 빈 자리를 만들지 않는다', () => {
    const rows = buildSchedule({ site: null, sub: { rcept_bgnde: '20260902' }, today: '2026-08-30' });
    expect(rows.map((r) => r.key)).toEqual(['apply']);
  });

  it('모델하우스는 실측 0건이라 «지금은» 안 뜬다 — 값이 생기면 저절로 뜬다', () => {
    expect(buildSchedule({ site, sub, today: '2026-08-30' }).some((r) => r.key === 'model_house')).toBe(false);
    const withMh = buildSchedule({
      site: { ...site, model_house_open_date: '2026-08-28', model_house_close_date: '2026-09-06' },
      sub, today: '2026-08-30',
    });
    expect(withMh.find((r) => r.key === 'model_house')!.text).toBe('2026.08.28 ~ 2026.09.06');
  });
});

describe('지났는가 · 다음은 어디인가', () => {
  const rows = buildSchedule({ site, sub, today: '2026-08-30' });
  const by = (k: string) => rows.find((r) => r.key === k)!;

  it('⛔ 지난 행을 «지우지 않는다» — 완료로 표시할 뿐이다(지우면 일대기가 아니다)', () => {
    expect(by('announcement').state).toBe('past');   // 08-10 은 지났다
    expect(by('announcement').text).toBe('2026.08.10');
  });

  it('D-day 는 «도래 전 최근접 한 곳» 에만 붙는다', () => {
    const withDday = rows.filter((r) => r.dday !== null);
    expect(withDday).toHaveLength(1);
    expect(withDday[0].key).toBe('special');          // 09-01 이 가장 가깝다
    expect(withDday[0].dday).toBe(2);
  });

  it('당일이면 current 다 — 「지났다」도 「남았다」도 아니다', () => {
    const r = buildSchedule({ site, sub, today: '2026-09-02' });
    expect(r.find((x) => x.key === 'apply')!.state).toBe('current');
  });

  it('전부 지난 현장은 D-day 가 «없다» — 붙일 미래가 없다', () => {
    const r = buildSchedule({ site, sub, today: '2029-01-01' });
    expect(r.every((x) => x.dday === null)).toBe(true);
    expect(r.every((x) => x.state === 'past' || x.key === 'expected' || x.key === 'move_in')).toBe(true);
  });
});

describe('출처·기준일 동행', () => {
  const rows = buildSchedule({ site, sub, today: '2026-08-30' });

  it('청약홈 행은 «공고일» 이 기준일이다', () => {
    const r = rows.find((x) => x.key === 'apply')!;
    expect(r.source).toBe('청약홈 모집공고');
    expect(r.asof).toBe('2026-08-10');
    expect(r.confidence).toBe('verified');
  });

  it('분양예정 시기는 D-2 의 4요소를 그대로 탄다 — 하나라도 빠지면 행이 없다', () => {
    expect(rows.find((x) => x.key === 'expected')!.asof).toBe('2026-08-10');
    const noAsof = buildSchedule({ site: { ...site, expected_sale_period_asof: null }, sub, today: '2026-08-30' });
    expect(noAsof.some((x) => x.key === 'expected')).toBe(false);
  });
});

describe('형식 읽기', () => {
  it('YYYYMMDD 와 YYYY-MM-DD 를 같게 읽는다', () => {
    expect(normDate('20260901')).toBe('2026-09-01');
    expect(normDate('2026-09-01T00:00:00Z')).toBe('2026-09-01');
    expect(normDate('2026-9-1')).toBeNull();   // ⛔ 애매한 값은 «안 읽는다»
    expect(normDate(null)).toBeNull();
  });

  it('입주예정은 «월 정밀도» 다 — 일까지 아는 척하지 않는다', () => {
    expect(ymText('202812')).toBe('2028년 12월');
    expect(ymText('20281201')).toBeNull();
  });

  it('일수는 UTC 자정 기준이라 시간대에 안 흔들린다', () => {
    expect(daysBetween('2026-08-30', '2026-09-01')).toBe(2);
    expect(daysBetween('2026-09-01', '2026-08-30')).toBe(-2);
  });
});

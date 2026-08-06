import { describe, it, expect } from 'vitest';
import {
  getSubscriptionStatus,
  getStatusWeight,
  getStatusDday,
  compareBySubscriptionStatus,
  formatComplexName,
  toDateKey,
  addDays,
  daysBetween,
  todayKST,
  STATUS_WEIGHT,
  type SubscriptionLike,
} from '@/lib/apt/subscription-status';

// 모든 테스트의 고정 기준일. 실행 시각에 따라 결과가 흔들리지 않게 today 를 명시 주입한다.
const TODAY = '2026-08-06';

/** apt_subscriptions 한 행을 흉내내는 헬퍼. */
function row(over: Partial<SubscriptionLike> = {}): SubscriptionLike {
  return {
    rcept_bgnde: null,
    rcept_endde: null,
    spsply_rcept_bgnde: null,
    przwner_presnatn_de: null,
    cntrct_cncls_bgnde: null,
    cntrct_cncls_endde: null,
    house_nm: '테스트 단지',
    status: null,
    ...over,
  };
}

describe('date helpers', () => {
  it('toDateKey 는 date / ISO timestamp / Date 를 YYYY-MM-DD 로 정규화한다', () => {
    expect(toDateKey('2026-08-10')).toBe('2026-08-10');
    expect(toDateKey('2026-08-10T00:00:00+09:00')).toBe('2026-08-10');
    expect(toDateKey('2026-08-10 12:30:00+00')).toBe('2026-08-10');
    expect(toDateKey(new Date(Date.UTC(2026, 7, 10, 12)))).toBe('2026-08-10');
  });

  it('toDateKey 는 빈 값과 깨진 값을 null 로 준다', () => {
    expect(toDateKey(null)).toBeNull();
    expect(toDateKey(undefined)).toBeNull();
    expect(toDateKey('')).toBeNull();
    expect(toDateKey('   ')).toBeNull();
    expect(toDateKey('알 수 없음')).toBeNull();
    expect(toDateKey(new Date('nope'))).toBeNull();
  });

  it('addDays 는 월/연 경계를 넘는다', () => {
    expect(addDays('2026-08-06', 7)).toBe('2026-08-13');
    expect(addDays('2026-08-28', 7)).toBe('2026-09-04');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2026-08-06', -6)).toBe('2026-07-31');
  });

  it('daysBetween 은 과거를 음수로 준다', () => {
    expect(daysBetween('2026-08-06', '2026-08-06')).toBe(0);
    expect(daysBetween('2026-08-06', '2026-08-12')).toBe(6);
    expect(daysBetween('2026-08-06', '2026-08-01')).toBe(-5);
  });

  it('todayKST 는 UTC 기준 늦은 밤에도 한국 날짜(+1일)를 준다', () => {
    // 2026-08-05 16:00Z = 2026-08-06 01:00 KST
    expect(todayKST(new Date('2026-08-05T16:00:00Z'))).toBe('2026-08-06');
    // 2026-08-05 14:00Z = 2026-08-05 23:00 KST
    expect(todayKST(new Date('2026-08-05T14:00:00Z'))).toBe('2026-08-05');
  });
});

describe('getSubscriptionStatus', () => {
  it('접수 시작 <= 오늘 <= 마감 이면 open', () => {
    const r = row({ rcept_bgnde: '2026-08-03', rcept_endde: '2026-08-08' });
    expect(getSubscriptionStatus(r, TODAY)).toBe('open');
  });

  it('접수 시작일 당일도 open', () => {
    const r = row({ rcept_bgnde: TODAY, rcept_endde: '2026-08-08' });
    expect(getSubscriptionStatus(r, TODAY)).toBe('open');
  });

  it('마감일 당일도 open (마감일까지 접수 가능)', () => {
    const r = row({ rcept_bgnde: '2026-08-03', rcept_endde: TODAY });
    expect(getSubscriptionStatus(r, TODAY)).toBe('open');
  });

  it('접수 시작이 7일 이내면 upcoming', () => {
    const r = row({ rcept_bgnde: '2026-08-10', rcept_endde: '2026-08-12' });
    expect(getSubscriptionStatus(r, TODAY)).toBe('upcoming');
  });

  it('접수 시작이 정확히 7일 뒤면 upcoming (경계 포함)', () => {
    const r = row({ rcept_bgnde: addDays(TODAY, 7), rcept_endde: addDays(TODAY, 9) });
    expect(getSubscriptionStatus(r, TODAY)).toBe('upcoming');
  });

  it('접수 시작이 8일 뒤면 scheduled (경계 밖)', () => {
    const r = row({ rcept_bgnde: addDays(TODAY, 8), rcept_endde: addDays(TODAY, 10) });
    expect(getSubscriptionStatus(r, TODAY)).toBe('scheduled');
  });

  it('특별공급이 1순위보다 먼저 열리면 그 날짜로 open 을 판정한다', () => {
    // 1순위만 보면 upcoming 이지만 특공이 이미 시작 → 실질 접수중
    const r = row({
      spsply_rcept_bgnde: '2026-08-05',
      rcept_bgnde: '2026-08-10',
      rcept_endde: '2026-08-12',
    });
    expect(getSubscriptionStatus(r, TODAY)).toBe('open');
  });

  it('접수 마감 후 당첨자 발표 전이면 announced_wait', () => {
    const r = row({
      rcept_bgnde: '2026-08-03',
      rcept_endde: '2026-08-05',
      przwner_presnatn_de: '2026-08-11',
      cntrct_cncls_endde: '2026-08-26',
    });
    expect(getSubscriptionStatus(r, TODAY)).toBe('announced_wait');
  });

  it('당첨자 발표 당일은 아직 announced_wait', () => {
    const r = row({
      rcept_endde: '2026-08-01',
      przwner_presnatn_de: TODAY,
      cntrct_cncls_endde: '2026-08-26',
    });
    expect(getSubscriptionStatus(r, TODAY)).toBe('announced_wait');
  });

  it('발표 후 계약 종료 전이면 contract', () => {
    const r = row({
      rcept_bgnde: '2026-07-20',
      rcept_endde: '2026-07-22',
      przwner_presnatn_de: '2026-07-29',
      cntrct_cncls_bgnde: '2026-08-10',
      cntrct_cncls_endde: '2026-08-12',
    });
    expect(getSubscriptionStatus(r, TODAY)).toBe('contract');
  });

  it('계약까지 전부 지나면 closed', () => {
    const r = row({
      rcept_bgnde: '2026-06-01',
      rcept_endde: '2026-06-03',
      przwner_presnatn_de: '2026-06-10',
      cntrct_cncls_endde: '2026-06-25',
    });
    expect(getSubscriptionStatus(r, TODAY)).toBe('closed');
  });

  it('공고명에 무순위/잔여세대가 있으면 날짜와 무관하게 leftover', () => {
    expect(getSubscriptionStatus(row({ house_nm: '○○아파트 무순위 공급', rcept_bgnde: '2026-08-03', rcept_endde: '2026-08-08' }), TODAY)).toBe('leftover');
    expect(getSubscriptionStatus(row({ house_nm: '△△ 잔여세대 공급' }), TODAY)).toBe('leftover');
    expect(getSubscriptionStatus(row({ house_nm: '□□ 선착순 분양' }), TODAY)).toBe('leftover');
  });

  it('status 컬럼의 명시 플래그가 공고명보다 우선한다', () => {
    expect(getSubscriptionStatus(row({ status: 'leftover' }), TODAY)).toBe('leftover');
  });

  it('날짜가 전부 비어 있으면 closed 로 떨어진다 (크래시 없음)', () => {
    expect(getSubscriptionStatus(row(), TODAY)).toBe('closed');
  });

  it('시작일 누락 + 마감일만 있는 공고도 open 으로 잡는다', () => {
    const r = row({ rcept_bgnde: null, rcept_endde: '2026-08-08' });
    expect(getSubscriptionStatus(r, TODAY)).toBe('open');
  });
});

describe('정렬 가중치', () => {
  it('작업지시서 명시 가중치와 정확히 일치한다', () => {
    expect(STATUS_WEIGHT.open).toBe(0);
    expect(STATUS_WEIGHT.upcoming).toBe(1);
    expect(STATUS_WEIGHT.announced_wait).toBe(2);
    expect(STATUS_WEIGHT.contract).toBe(3);
    expect(STATUS_WEIGHT.scheduled).toBe(4);
  });

  it('getStatusWeight 는 open < upcoming < announced_wait < contract < scheduled 순서를 만든다', () => {
    const order = ['open', 'upcoming', 'announced_wait', 'contract', 'scheduled'] as const;
    const weights = order.map(getStatusWeight);
    expect(weights).toEqual([...weights].sort((a, b) => a - b));
    expect(new Set(weights).size).toBe(order.length);
  });

  it('leftover/closed 는 명시 5종보다 뒤에 온다', () => {
    expect(getStatusWeight('leftover')).toBeGreaterThan(getStatusWeight('scheduled'));
    expect(getStatusWeight('closed')).toBeGreaterThan(getStatusWeight('leftover'));
  });
});

describe('getStatusDday', () => {
  it('open 은 마감까지 센다', () => {
    const r = row({ rcept_bgnde: '2026-08-03', rcept_endde: '2026-08-08' });
    expect(getStatusDday(r, 'open', TODAY)).toBe(2);
  });

  it('upcoming 은 접수 시작까지 센다', () => {
    const r = row({ rcept_bgnde: '2026-08-10', rcept_endde: '2026-08-12' });
    expect(getStatusDday(r, 'upcoming', TODAY)).toBe(4);
  });

  it('announced_wait 은 발표일까지 센다', () => {
    const r = row({ rcept_endde: '2026-08-05', przwner_presnatn_de: '2026-08-11' });
    expect(getStatusDday(r, 'announced_wait', TODAY)).toBe(5);
  });

  it('contract 는 계약 종료까지 센다', () => {
    const r = row({ cntrct_cncls_endde: '2026-08-12' });
    expect(getStatusDday(r, 'contract', TODAY)).toBe(6);
  });

  it('closed/leftover 는 null', () => {
    expect(getStatusDday(row({ rcept_endde: '2026-06-01' }), 'closed', TODAY)).toBeNull();
    expect(getStatusDday(row({ house_nm: '무순위' }), 'leftover', TODAY)).toBeNull();
  });

  it('status 를 생략하면 스스로 판정해서 센다', () => {
    const r = row({ rcept_bgnde: '2026-08-10', rcept_endde: '2026-08-12' });
    expect(getStatusDday(r, undefined, TODAY)).toBe(4);
  });
});

describe('compareBySubscriptionStatus', () => {
  it('상태 가중치 → D-day 순으로 정렬한다', () => {
    const openLate    = row({ house_nm: 'open-late',   rcept_bgnde: '2026-08-01', rcept_endde: '2026-08-20' });
    const openSoon    = row({ house_nm: 'open-soon',   rcept_bgnde: '2026-08-01', rcept_endde: '2026-08-07' });
    const upcoming    = row({ house_nm: 'upcoming',    rcept_bgnde: '2026-08-10', rcept_endde: '2026-08-12' });
    const scheduled   = row({ house_nm: 'scheduled',   rcept_bgnde: '2026-09-01', rcept_endde: '2026-09-03' });
    const announced   = row({ house_nm: 'announced',   rcept_endde: '2026-08-05', przwner_presnatn_de: '2026-08-11' });
    const contract    = row({ house_nm: 'contract',    rcept_endde: '2026-07-22', przwner_presnatn_de: '2026-07-29', cntrct_cncls_endde: '2026-08-12' });

    const sorted = [scheduled, contract, upcoming, openLate, announced, openSoon]
      .sort((a, b) => compareBySubscriptionStatus(a, b, TODAY))
      .map((r) => r.house_nm);

    expect(sorted).toEqual([
      'open-soon',   // open, D-1
      'open-late',   // open, D-14
      'upcoming',
      'announced',
      'contract',
      'scheduled',
    ]);
  });

  it('D-day 가 없는 항목은 같은 상태 안에서 뒤로 간다', () => {
    const withDday = row({ house_nm: 'has', rcept_endde: '2026-06-01' });
    const noDday   = row({ house_nm: 'none' });
    // 둘 다 closed → D-day 는 양쪽 다 null 이라 순서 유지
    expect(compareBySubscriptionStatus(withDday, noDday, TODAY)).toBe(0);
  });

  it('같은 상태·같은 D-day 면 0 을 반환한다 (안정 정렬 유지)', () => {
    const a = row({ house_nm: 'a', rcept_bgnde: '2026-08-01', rcept_endde: '2026-08-08' });
    const b = row({ house_nm: 'b', rcept_bgnde: '2026-08-02', rcept_endde: '2026-08-08' });
    expect(compareBySubscriptionStatus(a, b, TODAY)).toBe(0);
  });
});

describe('formatComplexName — 지역 prefix 중복 제거', () => {
  it('단지명이 지역명으로 시작하면 prefix 를 붙이지 않는다 ("세종 세종 우미린" 버그)', () => {
    expect(formatComplexName('세종', '세종 우미 린 센터파크')).toBe('세종 우미 린 센터파크');
  });

  it('겹치지 않으면 지역 prefix 를 붙인다', () => {
    expect(formatComplexName('부산', '두산위브더제니스 대연')).toBe('부산 두산위브더제니스 대연');
  });

  it('지역명이 풀네임이고 단지명이 축약형으로 시작해도 잡는다', () => {
    expect(formatComplexName('세종특별자치시', '세종 우미 린')).toBe('세종 우미 린');
    expect(formatComplexName('서울특별시', '서울숲 아이파크')).toBe('서울숲 아이파크');
    // '경상남도' 의 축약은 '경상' 이 아니라 '경남'
    expect(formatComplexName('경상남도', '경남 어떤단지')).toBe('경남 어떤단지');
    expect(formatComplexName('충청남도', '충남 아산테크노밸리')).toBe('충남 아산테크노밸리');
  });

  it('축약형 지역에 풀네임으로 시작하는 단지명이 와도 잡는다 (역방향)', () => {
    expect(formatComplexName('경남', '경상남도 어떤단지')).toBe('경상남도 어떤단지');
    expect(formatComplexName('세종', '세종특별자치시 우미린')).toBe('세종특별자치시 우미린');
  });

  it('지역 축약형이 겹치지 않으면 그대로 prefix 를 붙인다', () => {
    // '경남' 과 '경기' 는 다른 지역 — 잘못 삼키면 안 됨
    expect(formatComplexName('경남', '경기 어떤단지')).toBe('경남 경기 어떤단지');
  });

  it('지역이 비면 단지명만, 단지명이 비면 지역만 준다', () => {
    expect(formatComplexName(null, '우미 린')).toBe('우미 린');
    expect(formatComplexName('', '우미 린')).toBe('우미 린');
    expect(formatComplexName('세종', null)).toBe('세종');
    expect(formatComplexName('세종', '  ')).toBe('세종');
  });

  it('앞뒤 공백을 정리한다', () => {
    expect(formatComplexName('  부산  ', '  더샵 트리센트  ')).toBe('부산 더샵 트리센트');
  });
});

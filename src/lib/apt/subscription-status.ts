// src/lib/apt/subscription-status.ts — s273 청약 퍼스트
// 청약 단지의 생애주기 상태 판정 + 정렬 가중치.
//
// 날짜 비교는 전부 'YYYY-MM-DD' 문자열 사전순으로 수행한다.
// Date 객체를 쓰면 Vercel(UTC) / 로컬(KST) 환경차로 하루가 밀린다.
// apt_subscriptions 의 접수일 컬럼은 전부 postgres `date` 타입이라
// 타임존 개념 자체가 없으므로 문자열 비교가 정확하다.

export type SubscriptionStatus =
  | 'open'            // 접수중
  | 'upcoming'        // 접수 임박 (7일 이내 시작)
  | 'scheduled'       // 접수 예정 (7일 초과)
  | 'announced_wait'  // 접수 마감, 당첨자 발표 대기
  | 'contract'        // 당첨자 발표 완료, 계약 기간
  | 'leftover'        // 무순위 / 잔여세대
  | 'closed';         // 종료

/**
 * 정렬 가중치 — 낮을수록 위.
 * open(0) → upcoming(1) → announced_wait(2) → contract(3) → scheduled(4)
 * 는 작업지시서 명시값. leftover/closed 는 명시가 없어 그 뒤에 이어 붙인다.
 */
export const STATUS_WEIGHT: Record<SubscriptionStatus, number> = {
  open: 0,
  upcoming: 1,
  announced_wait: 2,
  contract: 3,
  scheduled: 4,
  leftover: 5,
  closed: 6,
};

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  open: '접수중',
  upcoming: '접수임박',
  scheduled: '접수예정',
  announced_wait: '발표대기',
  contract: '계약중',
  leftover: '무순위',
  closed: '마감',
};

/** 배지 톤 — 컴포넌트가 hex 를 직접 들고 있지 않도록 (Architecture Rule #83). */
export const STATUS_TONE: Record<SubscriptionStatus, 'red' | 'amber' | 'blue' | 'green' | 'purple' | 'gray'> = {
  open: 'red',
  upcoming: 'amber',
  scheduled: 'blue',
  announced_wait: 'purple',
  contract: 'green',
  leftover: 'amber',
  closed: 'gray',
};

/** 접수 임박(upcoming) 판정 창 — 접수 시작 N일 전부터. */
export const UPCOMING_WINDOW_DAYS = 7;

/** getSubscriptionStatus 가 읽는 최소 필드. apt_subscriptions 컬럼명 그대로. */
export interface SubscriptionLike {
  rcept_bgnde?: string | null;          // 1순위 접수 시작
  rcept_endde?: string | null;          // 접수 마감
  spsply_rcept_bgnde?: string | null;   // 특별공급 접수 시작 (있으면 실질 접수 개시일)
  przwner_presnatn_de?: string | null;  // 당첨자 발표일
  cntrct_cncls_bgnde?: string | null;   // 계약 시작
  cntrct_cncls_endde?: string | null;   // 계약 종료
  house_nm?: string | null;             // 무순위/잔여세대 판정 보조
  status?: string | null;               // 명시 상태 플래그가 있으면 우선
}

/** 무순위/잔여세대를 나타내는 공고명 토큰. 국토부 공고명 표기 그대로. */
const LEFTOVER_TOKENS = ['무순위', '잔여세대', '선착순', '임의공급'];

/** 'YYYY-MM-DD' 로 정규화. Date/ISO timestamp/null 모두 수용. */
export function toDateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  // '2026-08-10' / '2026-08-10T00:00:00+09:00' / '2026-08-10 00:00:00+00' 모두 앞 10자
  const head = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

/** 오늘(KST) 을 'YYYY-MM-DD' 로. 서버가 UTC 여도 한국 날짜를 준다. */
export function todayKST(now: Date = new Date()): string {
  // en-CA 로케일이 'YYYY-MM-DD' 를 준다.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** dateKey 에 days 를 더한 dateKey. UTC 정오 기준이라 DST/타임존 영향이 없다. */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** from → to 까지 남은 일수. 같은 날이면 0, 지났으면 음수. */
export function daysBetween(from: string, to: string): number {
  const p = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(to) - p(from)) / 86_400_000);
}

function isLeftover(row: SubscriptionLike): boolean {
  const explicit = (row.status ?? '').toLowerCase();
  if (explicit === 'leftover' || explicit === 'unranked') return true;
  const name = row.house_nm ?? '';
  return LEFTOVER_TOKENS.some((t) => name.includes(t));
}

/**
 * 단지의 현재 청약 상태를 판정한다.
 *
 * 판정 순서 (앞이 우선):
 *  1. leftover  — 무순위/잔여세대 공고
 *  2. open      — 접수 시작 <= 오늘 <= 접수 마감
 *  3. upcoming  — 접수 시작이 오늘 이후 7일 이내
 *  4. scheduled — 접수 시작이 7일 초과 이후
 *  5. announced_wait — 접수 마감했고 당첨자 발표일이 아직 안 지남
 *  6. contract  — 당첨자 발표 지났고 계약 종료일이 아직 안 지남
 *  7. closed    — 그 외 전부
 *
 * 접수 개시일은 특별공급 시작일(spsply_rcept_bgnde)이 더 이르면 그쪽을 쓴다.
 * 실제로 특별공급이 1순위보다 하루~이틀 먼저 열리는 단지가 많아,
 * 1순위 기준만 보면 이미 접수가 시작된 단지가 'upcoming' 으로 잘못 뜬다.
 */
export function getSubscriptionStatus(
  row: SubscriptionLike,
  today: string = todayKST(),
): SubscriptionStatus {
  if (isLeftover(row)) return 'leftover';

  const rcept1 = toDateKey(row.rcept_bgnde);
  const special = toDateKey(row.spsply_rcept_bgnde);
  const start = rcept1 && special ? (special < rcept1 ? special : rcept1) : (rcept1 ?? special);
  const end = toDateKey(row.rcept_endde);
  const announce = toDateKey(row.przwner_presnatn_de);
  const contractEnd = toDateKey(row.cntrct_cncls_endde);

  // 접수중 — 시작일이 없으면 마감일만으로도 판정 (시작일 누락 공고 존재)
  if (end && end >= today && (!start || start <= today)) return 'open';

  // 접수 전
  if (start && start > today) {
    return daysBetween(today, start) <= UPCOMING_WINDOW_DAYS ? 'upcoming' : 'scheduled';
  }

  // 접수 후
  if (announce && announce >= today) return 'announced_wait';
  if (contractEnd && contractEnd >= today) return 'contract';

  return 'closed';
}

/** 정렬 가중치. 낮을수록 앞. */
export function getStatusWeight(status: SubscriptionStatus): number {
  return STATUS_WEIGHT[status];
}

/**
 * 상태 기준 D-day. 상태마다 세는 대상이 다르다.
 *  - open            → 마감까지
 *  - upcoming/scheduled → 접수 시작까지
 *  - announced_wait  → 당첨자 발표까지
 *  - contract        → 계약 종료까지
 *  - leftover/closed → null
 */
export function getStatusDday(
  row: SubscriptionLike,
  status: SubscriptionStatus = getSubscriptionStatus(row),
  today: string = todayKST(),
): number | null {
  const target = (() => {
    switch (status) {
      case 'open':
        return toDateKey(row.rcept_endde);
      case 'upcoming':
      case 'scheduled': {
        const r = toDateKey(row.rcept_bgnde);
        const s = toDateKey(row.spsply_rcept_bgnde);
        return r && s ? (s < r ? s : r) : (r ?? s);
      }
      case 'announced_wait':
        return toDateKey(row.przwner_presnatn_de);
      case 'contract':
        return toDateKey(row.cntrct_cncls_endde);
      default:
        return null;
    }
  })();
  if (!target) return null;
  return daysBetween(today, target);
}

/**
 * 정렬 비교자 — 상태 가중치 우선, 같으면 D-day 오름차순(임박 우선).
 * D-day 가 없는 건 뒤로.
 */
export function compareBySubscriptionStatus(
  a: SubscriptionLike,
  b: SubscriptionLike,
  today: string = todayKST(),
): number {
  const sa = getSubscriptionStatus(a, today);
  const sb = getSubscriptionStatus(b, today);
  const w = STATUS_WEIGHT[sa] - STATUS_WEIGHT[sb];
  if (w !== 0) return w;

  const da = getStatusDday(a, sa, today);
  const db = getStatusDday(b, sb, today);
  if (da === null && db === null) return 0;
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

/**
 * 광역시/도 풀네임 → 통용 축약형.
 * '경상남도' 의 축약은 '경상' 이 아니라 '경남' 이라 규칙적인 접미사 제거로는 안 나온다.
 * apt_subscriptions.region_nm 은 이미 축약형('경남')으로 들어오지만,
 * apt_sites 등 다른 소스가 풀네임을 주는 경우가 있어 양방향으로 매칭한다.
 */
const REGION_ALIASES: Record<string, string[]> = {
  서울특별시: ['서울'],
  부산광역시: ['부산'],
  대구광역시: ['대구'],
  인천광역시: ['인천'],
  광주광역시: ['광주'],
  대전광역시: ['대전'],
  울산광역시: ['울산'],
  세종특별자치시: ['세종'],
  경기도: ['경기'],
  강원특별자치도: ['강원'],
  강원도: ['강원'],
  충청북도: ['충북'],
  충청남도: ['충남'],
  전북특별자치도: ['전북'],
  전라북도: ['전북'],
  전라남도: ['전남'],
  경상북도: ['경북'],
  경상남도: ['경남'],
  제주특별자치도: ['제주'],
};

/**
 * 표시용 짧은 지역명. card-format 의 formatRegionShort 는 빈 값에 '-' 를 주는데,
 * 카드 우측 지역 라벨에서는 '-' 가 보이는 것보다 아무것도 안 보이는 편이 낫다.
 */
export function formatRegionShortSafe(region: string | null | undefined): string {
  const rg = (region ?? '').trim();
  if (!rg) return '';
  return (
    REGION_ALIASES[rg]?.[0] ??
    rg
      .replace('특별자치시', '')
      .replace('특별자치도', '')
      .replace('특별시', '')
      .replace('광역시', '')
      .trim()
  );
}

/**
 * 지역 prefix 중복 제거.
 * region_nm='세종', house_nm='세종 우미 린 …' 을 "세종 세종 우미 린" 으로 찍던 버그 수정.
 *
 * 단지명 선두가 지역명(또는 그 축약형)과 겹치면 prefix 를 붙이지 않는다.
 */
export function formatComplexName(
  region: string | null | undefined,
  name: string | null | undefined,
): string {
  const nm = (name ?? '').trim();
  if (!nm) return (region ?? '').trim();

  const rg = (region ?? '').trim();
  if (!rg) return nm;

  const candidates = new Set<string>([rg, ...(REGION_ALIASES[rg] ?? [])]);

  // 축약형이 들어온 경우('경남')의 역방향 — 풀네임('경상남도')으로 시작하는 단지명도 잡는다
  for (const [full, shorts] of Object.entries(REGION_ALIASES)) {
    if (shorts.includes(rg)) candidates.add(full);
  }

  for (const c of candidates) {
    if (c && nm.startsWith(c)) return nm;
  }
  return `${rg} ${nm}`;
}

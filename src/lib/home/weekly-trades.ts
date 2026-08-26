// H4-2 — 홈 「이번 주」 실거래 스트립의 데이터와 «라벨 판정».
//
// ── 왜 라벨을 여기서 만드는가 ──
// 화면 문구를 컴포넌트에 하드코딩하면, 경남 수집이 복구됐을 때 코드를 다시 고쳐야 한다.
// 그건 이 기능의 실패 조건이다. 라벨은 «RPC 가 실제로 센 지역» 에서 조립한다.
//
// ⚠️ `prev_deals` 를 숫자로 화면에 띄우지 말 것. **비교 전용 값이다.**
//    신고 지연 꼬리가 길어서(부산·울산 누적 4일 58% · 7일 72% · 14일 86%)
//    최근 창을 «직전 완숙 창» 과 그냥 빼면 최근 쪽이 늘 덜 여물어 항상 감소로 나온다.
//      456 vs 직전 완숙 507  →  −10% (착시)
//      456 vs 같은 성숙도 275 →  +66% (사실)
//    부호가 뒤집힌다. RPC 가 후자를 주므로 증감 계산에만 쓰고, 275 를 「지난주 275건」처럼
//    적지 않는다 — 275 는 지난주 실제 거래 수가 «아니다».

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { BUGYEONG, BUGYEONG_REGIONS } from '@/lib/apt/pipeline';

export interface WeeklyRegion { region: string; deals: number }
export interface StaleRegion { region: string; last_seen: string }

export interface WeeklyTrades {
  /** 완성 구간 거래 수. 0이면 호출부가 섹션을 통째로 미렌더한다. */
  deals: number;
  /** ⚠️ 화면에 숫자로 내보내지 말 것 (파일 상단 주석). 증감 계산 전용. */
  prevDeals: number;
  /** 집계 상한. 신고 지연 때문에 오늘이 아니다. */
  cutoff: string;
  /** 원본 최신 신고일. 화면에 «기준» 으로 노출한다. */
  latestDealDate: string;
  lagDays: number;
  byRegion: WeeklyRegion[];
  /** 수집이 끊긴 지역. 비어 있지 않으면 그 지역은 집계에 «없다». */
  staleRegions: StaleRegion[];
}

/**
 * 라벨에 쓸 지역 이름.
 *
 * ⚠️ 「부울경」을 조건 없이 쓰지 않는다. 지금 경남이 3개월째 결측이라 집계에 없고,
 *    그런데도 부울경이라 적으면 화면이 거짓말을 한다.
 * ⚠️ 순서를 «건수로» 정하지 않는다. 울산이 부산을 앞지르는 주에 라벨이
 *    「울산·부산」으로 뒤집혀 같은 화면이 매번 달라 보인다. 정본 순서로 고정한다.
 *    (홈 지역 칩이 HOME_REGIONS 순서를 고정한 것과 같은 이유다.)
 *
 * 세 지역이 «모두» 들어오면 자동으로 「부울경」이 된다 — D5-5 복구가 끝나면
 * 코드를 고치지 않아도 라벨이 따라온다. 그게 이 함수의 존재 이유다.
 */
export function tradeRegionLabel(byRegion: { region: string }[]): string {
  const seen = new Set(byRegion.map((r) => (r.region ?? '').trim()).filter(Boolean));
  if (seen.size === 0) return '';
  const canon = BUGYEONG_REGIONS.filter((r) => seen.has(r));
  if (canon.length === BUGYEONG_REGIONS.length) return BUGYEONG;
  // 정본에 없는 지역이 섞여 들어와도 버리지 않는다 — 센 걸 안 적으면 그것도 거짓이다.
  const extra = [...seen].filter((r) => !(BUGYEONG_REGIONS as readonly string[]).includes(r)).sort();
  return [...canon, ...extra].join('·');
}

/**
 * 증감률(%). 표시할 수 없으면 null.
 *
 * ⚠️ prevDeals 가 0이면 «표시하지 않는다». 0으로 나누지 말 것이고,
 *    「+∞%」나 「신규」 같은 말로 때우지도 않는다.
 */
export function tradeDeltaPct(deals: number, prevDeals: number): number | null {
  if (!Number.isFinite(deals) || !Number.isFinite(prevDeals)) return null;
  if (prevDeals <= 0) return null;
  return Math.round(((deals - prevDeals) / prevDeals) * 100);
}

/** `2026-08-24` → `8/24`. 연도는 적지 않는다 — 「이번 주」 옆이라 군더더기다. */
export function shortDate(iso: string | null | undefined): string {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${Number(m[2])}/${Number(m[3])}`;
}

/**
 * RPC 한 번. **인자를 넘기지 않는다** — `p_days`·`p_settle_days` 기본값이 정본이고,
 * 프런트가 창을 바꾸면 화면 숫자와 RPC 가 말하는 성숙도 보정이 어긋난다.
 *
 * ⚠️ 실패를 조용히 삼키지 않는다. null 을 내되 `console.error` 는 반드시 남긴다.
 * ⚠️ 홈 본체 fetch 뭉치에 «합치지 않는다» (Rule #49 — /apt/[id] 의 allSettled 8개가
 *    504를 낸 전례). 호출부가 분리해 돌린다.
 */
export async function fetchWeeklyTrades(): Promise<WeeklyTrades | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await (sb as any).rpc('get_bugyeong_weekly_trades');
    if (error) throw error;

    // RETURNS TABLE(...) 이라 PostgREST 가 «행 배열» 로 준다. 첫 행이 전부다.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    const deals = Number(row.deals ?? 0);
    if (!Number.isFinite(deals) || deals <= 0) return null;   // 0건이면 섹션을 만들지 않는다

    const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    return {
      deals,
      prevDeals: Number(row.prev_deals ?? 0),
      cutoff: String(row.cutoff ?? ''),
      latestDealDate: String(row.latest_deal_date ?? ''),
      lagDays: Number(row.lag_days ?? 0),
      byRegion: asArray<WeeklyRegion>(row.by_region)
        .map((r) => ({ region: String(r.region ?? '').trim(), deals: Number(r.deals ?? 0) }))
        .filter((r) => r.region && r.deals > 0),
      staleRegions: asArray<StaleRegion>(row.stale_regions)
        .map((r) => ({ region: String(r.region ?? '').trim(), last_seen: String(r.last_seen ?? '') }))
        .filter((r) => r.region),
    };
  } catch (e) {
    console.error('[home] weekly trades failed:', e);
    return null;   // 실패해도 홈 나머지는 그대로 뜬다
  }
}

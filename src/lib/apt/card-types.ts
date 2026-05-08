// src/lib/apt/card-types.ts — s259
// 5개 카드 view 의 공통 컬럼을 단일 타입으로 추상화

export type AptCardCategory =
  | "subscription"  // 청약
  | "imminent"      // 마감 임박
  | "redev"         // 재개발
  | "unsold"        // 미분양
  | "complex";      // 단지

export type AptCardStatus =
  | "ongoing"       // 청약 진행 중
  | "upcoming"      // 청약 시작 전
  | "closed"        // 청약 마감
  | "unsold"        // 미분양
  | "redev"         // 재개발
  | "existing"      // 기존 단지
  | "unknown";

export type AptCardTag =
  | "new"            // 7일 내 신규 등록
  | "imminent"       // 마감 D-3 이내
  | "ongoing"        // 청약 진행 중
  | "regulated"      // 조정대상지역
  | "speculative"    // 투기과열지구
  | "price_limit"    // 분양가상한제
  | "station"        // 지하철역 인근
  | "redev"          // 재개발 분류
  | "unsold"         // 미분양 분류
  | "complex"        // 단지 분류
  | "milestone_soon" // 재개발 단계 변경 임박
  | "stage_change"   // 재개발 단계 최근 변경
  | "large_unsold"   // 대규모 미분양
  | "recent_unsold"  // 최근 등재 미분양
  | "discount"       // 할인 분양
  | "active_market"  // 거래 활발
  | "reviewed"       // 리뷰 5+
  | "rising"         // 가격 상승
  | "falling"        // 가격 하락
  | "recent_trade"   // 최근 거래 발생
  | string;          // (tag 값이 stage 등 문자열로 동적 들어올 수 있음)

export type AptCard = {
  id: number | string;
  slug_id: string;
  name: string;
  region: string;
  builder: string;
  date_start: string | null;     // ISO date
  date_end: string | null;
  dday_end: number | null;       // 음수 = 지남, 0 = 오늘, 양수 = 남음
  status: AptCardStatus;
  price_per_pyeong: number | null;
  supply_min: number | null;     // 만원 단위
  supply_max: number | null;
  households: number | null;
  area_lineup: number[] | null;  // [52, 64, 70, 75, 85] 형태
  cover_image_url: string | null;
  tags: AptCardTag[] | null;
  nearest_station: string | null;
  station_distance: string | null;
  created_at: string;
  updated_at: string;
};

export type AptSortKey =
  | "newest"     // created_at DESC (신규 등록순) ⭐ 사용자 요청 기본값
  | "deadline"   // date_end ASC (마감 임박순)
  | "ongoing"    // status=ongoing 우선 + date_end ASC
  | "name"       // name ASC (가나다순)
  | "price_asc"  // price_per_pyeong ASC
  | "price_desc";

export type AptCardListProps = {
  category: AptCardCategory;
  initialSort?: AptSortKey;
  initialLimit?: number;
};

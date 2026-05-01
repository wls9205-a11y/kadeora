/**
 * v5 메인 페이지 9섹션 공유 타입.
 * RPC `get_main_page_data(p_region text)` 의 반환 JSON 형상.
 * 컴포넌트들이 이 타입을 통해 props 받음 — RPC 변경 시 타입 1곳에서 동기화.
 */

export type MainRegion = 'busan' | 'seoul' | 'gyeonggi' | 'incheon' | 'daegu' | 'gwangju' | 'daejeon' | 'ulsan' | 'sejong' | 'gangwon' | 'chungbuk' | 'chungnam' | 'jeonbuk' | 'jeonnam' | 'gyeongbuk' | 'gyeongnam' | 'jeju' | 'all';

export interface MainSubscription {
  id: number;
  apt_id: string | null;            // apt_sites.id (uuid) — watchlist 매핑용
  slug: string | null;              // apt_sites.slug
  name: string;                     // house_nm
  region: string | null;            // region_nm
  sigungu: string | null;           // RPC 반환 보존, 렌더 X (s221 — 사용자 요구: 군/구 표현 X)
  builder: string | null;           // constructor_nm
  total_units: number | null;       // tot_supply_hshld_co (세대수)
  price_min: number | null;
  price_max: number | null;
  rcept_bgnde: string | null;       // 청약 시작
  rcept_endde: string | null;       // 청약 종료
  dday: number;                     // 종료일 - 오늘 (0 = 오늘 마감)
  og_image_url: string | null;
  expected_competition: number | null; // 예상 경쟁률 (cron backfill 대기, 없으면 null)
  feature_tags: string[];           // 특징 태그 (조망/역세권/학군 등 — cron backfill 대기, 없으면 [])
  move_in_ym: string | null;        // 입주예정 YYYYMM (mvn_prearnge_ym)
  sizes: string[];                  // 평형 옵션 (house_type_info 파싱 — 예: ['74','84','108'])
}

export interface MainListing {
  id: string;                       // apt_sites.id (uuid)
  slug: string;
  name: string;
  region: string | null;
  sigungu: string | null;           // RPC 반환 보존, 렌더 X (s221 — 사용자 요구: 군/구 표현 X)
  builder: string | null;
  total_units: number | null;
  remaining_units: number | null;   // 분양중 잔여 (cron backfill 대기, 없으면 null)
  price_min: number | null;
  price_max: number | null;
  status: 'active' | 'unsold' | 'closed' | string | null;
  og_image_url: string | null;
  content_score: number | null;
  discount_pct: number | null;      // 미분양 할인율 (cron backfill 대기, 없으면 null)
  move_in_ym: string | null;        // 입주예정 (move_in_date YYYYMM)
  sizes: string[];                  // 평형 옵션 (현재 [], 후속 cron backfill)
}

export interface MainTransaction {
  apt_name: string;
  region: string | null;
  sigungu: string | null;
  deal_date: string;                // YYYY-MM-DD
  deal_amount: number;
  exclusive_area: number | null;
  floor: number | null;
}

export interface MainUnsold {
  id: number;
  house_nm: string;
  region: string | null;
  sigungu: string | null;
  builder: string | null;
  total: number | null;
  remaining: number | null;
  discount_pct: number | null;
}

export interface MainRedev {
  id: number;
  district_name: string;
  region: string | null;
  sigungu: string | null;
  stage: number | null;             // 1~6
  total_households: number | null;
  constructor: string | null;
  next_milestone_date: string | null;
}

export interface MainBigEvent {
  type: 'BIG_EVENT' | 'NEWS' | 'EXPIRING';
  id: string | number;
  slug: string | null;
  title: string;
  subtitle: string;
  region: string | null;
  cta_label: string;
  cta_href: string;
  image_url: string | null;
}

export interface MainMarketSignal {
  avg_price_6m: number[];           // 12 datapoints (월 단위 또는 격주)
  weekly_volume: number;
  weekly_volume_pct: number;
  weekly_avg_price: number;         // 만원 단위
  weekly_avg_price_pct: number;
  nationwide_subs: number;          // 전국 청약중 단지수
  nationwide_subs_pct: number;
}

export interface MainConstructionStock {
  symbol: string;
  name: string;                     // 시공사명
  change_pct: number;
  sparkline: number[];              // 최근 7일 가격 배열
  related_apts: Array<{ id: string; name: string; slug: string }>;
}

export interface MainBrief {
  type: 'AI' | 'HOT' | 'INSIGHT';
  title: string;
  summary: string;
  href: string;                     // /blog/{slug} 또는 /feed/{id}
  source_section: 'blog' | 'community';
  view_count: number | null;
}

export interface MainPageData {
  subscriptions: MainSubscription[];
  hot_listings: MainListing[];
  transactions: MainTransaction[];
  unsold: MainUnsold[];
  redev: MainRedev[];
  big_event: MainBigEvent | null;
  market_signal: MainMarketSignal;
  construction_stocks: MainConstructionStock[];
  briefs: MainBrief[];
}

export interface WatchlistItem {
  apt: { id: string; name: string; slug: string };
  current_price: number | null;
  change_pct_30d: number | null;
  sparkline_30d: number[];
}

export const MAIN_REGION_LABELS: Record<MainRegion, string> = {
  all: '전국', busan: '부산', seoul: '서울', gyeonggi: '경기', incheon: '인천',
  daegu: '대구', gwangju: '광주', daejeon: '대전', ulsan: '울산', sejong: '세종',
  gangwon: '강원', chungbuk: '충북', chungnam: '충남', jeonbuk: '전북',
  jeonnam: '전남', gyeongbuk: '경북', gyeongnam: '경남', jeju: '제주',
};

export const MAIN_REGION_LIST: MainRegion[] = [
  'busan', 'seoul', 'gyeonggi', 'incheon', 'daegu', 'gwangju', 'daejeon',
  'ulsan', 'sejong', 'gangwon', 'chungbuk', 'chungnam', 'jeonbuk', 'jeonnam',
  'gyeongbuk', 'gyeongnam', 'jeju', 'all',
];

// region key → DB region_nm 한글 매핑 (RPC 인자 변환용)
export const MAIN_REGION_TO_KO: Record<MainRegion, string | null> = {
  all: null,
  busan: '부산', seoul: '서울', gyeonggi: '경기', incheon: '인천',
  daegu: '대구', gwangju: '광주', daejeon: '대전', ulsan: '울산', sejong: '세종',
  gangwon: '강원', chungbuk: '충북', chungnam: '충남', jeonbuk: '전북',
  jeonnam: '전남', gyeongbuk: '경북', gyeongnam: '경남', jeju: '제주',
};

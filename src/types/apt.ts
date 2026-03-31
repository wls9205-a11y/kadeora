/** 부동산 탭 데이터 타입 */

/** 분양중/미분양 통합 (OngoingTab) */
export interface OngoingApt {
  id: number;
  house_nm: string;
  region_nm: string;
  address: string | null;
  constructor_nm: string | null;
  total_supply: number | null;
  sale_price_min: number | null;
  sale_price_max: number | null;
  rcept_bgnde: string | null;
  rcept_endde: string | null;
  cntrct_cncls_bgnde: string | null;
  cntrct_cncls_endde: string | null;
  przwner_presnatn_de: string | null;
  mvn_prearnge_ym: string | null;
  competition_rate: number | null;
  unsold_count: number | null;
  nearby_avg_price: number | null;
  pblanc_url: string | null;
  link_id: string | null;
  source: 'subscription' | 'unsold';
  daysToMove: number | null;
}

/** 미분양 (UnsoldTab) */
export interface UnsoldApt {
  id: number;
  house_nm: string;
  region_nm: string;
  sigungu_nm: string | null;
  tot_supply_hshld_co: number | null;
  tot_unsold_hshld_co: number | null;
  after_completion_unsold: number | null;
  sale_price_min: number | null;
  sale_price_max: number | null;
  completion_ym: string | null;
  pblanc_url: string | null;
  source: string | null;
  constructor_nm: string | null;
  developer_nm: string | null;
  nearest_station: string | null;
  discount_info: string | null;
  price_per_pyeong: number | null;
}

/** 재개발 (RedevTab) */
export interface RedevProject {
  id: number;
  name: string;
  district_name: string;
  region: string;
  sigungu: string | null;
  address: string | null;
  project_type: string;
  stage: string | null;
  total_households: number | null;
  land_area: number | null;
  floor_area_ratio: number | null;
  building_coverage: number | null;
  max_floor: number;
  estimated_move_in: string | null;
  expected_completion: string | null;
  developer: string | null;
  constructor: string | null;
  nearest_station: string | null;
  nearest_school: string | null;
  key_features: string | null;
  ai_summary: string | null;
  notes: string | null;
}

/** 실거래 (TransactionTab) */
export interface AptTransaction {
  id: number;
  apt_name: string;
  region_nm: string;
  sigungu: string | null;
  dong: string | null;
  exclusive_area: number;
  deal_amount: number;
  deal_date: string;
  floor: number;
  built_year: number | null;
  trade_type: string | null;
}

/** 프리미엄 리스팅 */
export interface PremiumListing {
  id: number;
  listing_id: string;
  listing_type: string;
  badge_text: string | null;
  badge_color: string | null;
  consultant_name: string;
  consultant_company: string | null;
  consultant?: { name: string; company: string | null; phone: string | null; is_verified: boolean } | null;
  cta_phone: string | null;
  description: string | null;
}

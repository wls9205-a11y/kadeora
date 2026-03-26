/** 부동산 탭 데이터 타입 */

/** 분양중/미분양 통합 (OngoingTab) */
export interface OngoingApt {
  id: number;
  house_nm: string;
  region_nm: string;
  address?: string;
  constructor_nm?: string;
  total_supply?: number;
  sale_price_min?: number;
  sale_price_max?: number;
  rcept_bgnde?: string;
  rcept_endde?: string;
  cntrct_cncls_bgnde?: string;
  cntrct_cncls_endde?: string;
  przwner_presnatn_de?: string;
  mvn_prearnge_ym?: string;
  competition_rate?: number;
  unsold_count?: number;
  nearby_avg_price?: number;
  pblanc_url?: string;
  link_id?: string;
  source: 'subscription' | 'unsold';
  daysToMove?: number;
}

/** 미분양 (UnsoldTab) */
export interface UnsoldApt {
  id: number;
  house_nm: string;
  region_nm: string;
  sigungu_nm?: string;
  tot_supply_hshld_co?: number;
  tot_unsold_hshld_co?: number;
  after_completion_unsold?: number;
  sale_price_min?: number;
  sale_price_max?: number;
  completion_ym?: string;
  pblanc_url?: string;
  source?: string;
}

/** 재개발 (RedevTab) */
export interface RedevProject {
  id: number;
  name: string;
  district_name: string;
  region: string;
  sigungu?: string;
  address?: string;
  project_type: string;
  stage?: string;
  total_households?: number;
  land_area?: number;
  floor_area_ratio?: number;
  building_coverage?: number;
  max_floor?: number;
  estimated_move_in?: string;
  expected_completion?: string;
  developer?: string;
  constructor?: string;
  nearest_station?: string;
  nearest_school?: string;
  key_features?: string;
  ai_summary?: string;
  notes?: string;
}

/** 실거래 (TransactionTab) */
export interface AptTransaction {
  id: number;
  apt_name: string;
  region_nm: string;
  sigungu?: string;
  dong?: string;
  exclusive_area: number;
  deal_amount: number;
  deal_date: string;
  floor: number;
  built_year?: number;
  trade_type?: string;
}

/** 프리미엄 리스팅 */
export interface PremiumListing {
  id: number;
  listing_id: string;
  listing_type: string;
  badge_text?: string;
  badge_color?: string;
  consultant_name?: string;
  consultant_company?: string;
  consultant?: { name?: string; company?: string; phone?: string; is_verified?: boolean };
  cta_phone?: string;
  description?: string;
}

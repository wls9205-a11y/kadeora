/** apt_sites 시스템 타입 선언 — supabase gen types 전까지 임시 사용 */

/** 분양예정시기의 출처. DB 의 apt_sites_expected_sale_source_chk 와 «같은 목록» 을 유지할 것. */
export type ExpectedSaleSource = 'permit' | 'news' | 'builder' | 'announcement' | 'admin';

export interface AptSite {
  /**
   * 분양예정시기 — 원문이 «말한 정밀도 그대로».
   *   '2026' 연도만 · '2026H2' 반기 · '2026Q3' 분기 · '2026-09' 월 · null 미정
   * ⛔ 상향 추정 금지(§7-1). 연도만 아는 현장에 반기를 지어내지 않는다.
   * ⚠️ 표시할 때 이 문자열을 «가공하지 말 것» — 형식이 곧 우리가 아는 만큼이다.
   */
  expected_sale_period: string | null;
  /** 시기의 출처. 시기가 있으면 «반드시» 있다(DB 제약). 근거·기준일은 confidence_note 에. */
  expected_sale_source: ExpectedSaleSource | null;
  /** 정렬 전용 파생값(버킷 시작 월, DB 생성 컬럼). ⛔ 화면에 쓰지 말 것. */
  expected_sale_sort: string | null;
  id: string;
  slug: string;
  name: string;
  name_variants: string[];
  site_type: 'subscription' | 'redevelopment' | 'unsold' | 'landmark' | 'complex';
  region: string | null;
  sigungu: string | null;
  dong: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  builder: string | null;
  developer: string | null;
  total_units: number | null;
  built_year: number | null;
  move_in_date: string | null;
  status: 'upcoming' | 'open' | 'closed' | 'active' | 'completed';
  price_min: number | null;
  price_max: number | null;
  nearby_station: string | null;
  school_district: string | null;
  description: string | null;
  key_features: string[];
  source_ids: Record<string, string>;
  interest_count: number;
  page_views: number;
  content_score: number;
  seo_title: string | null;
  seo_description: string | null;
  faq_items: { q: string; a: string }[];
  images: { url: string; thumbnail?: string; source: string; caption: string; collected_at?: string }[];
  og_image_url: string | null;
  satellite_image_url: string | null;
  nearby_facilities: Record<string, number>;
  transit_score: number | null;
  price_comparison: Record<string, any>;
  search_trend: Record<string, any>;
  is_active: boolean;
  sitemap_wave: number;
  created_at: string;
  updated_at: string;
}

export interface AptSiteInterest {
  id: number;
  site_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_phone_hash: string | null;
  guest_phone_last4: string | null;
  guest_birth_date: string | null;
  guest_city: string | null;
  guest_district: string | null;
  source: string;
  consent_id: number | null;
  is_member: boolean;
  notification_enabled: boolean;
  created_at: string;
}

export interface PrivacyConsent {
  id: number;
  user_id: string | null;
  guest_identifier: string | null;
  consent_type: 'interest_collection' | 'marketing' | 'third_party';
  consent_version: string;
  is_agreed: boolean;
  consent_text: string | null;
  ip_address: string | null;
  user_agent: string | null;
  collected_items: string[];
  purpose: string | null;
  retention_period: string | null;
  consented_at: string;
  withdrawn_at: string | null;
  created_at: string;
}

/** apt_sites 시스템 타입 선언 — supabase gen types 전까지 임시 사용 */

export interface AptSite {
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

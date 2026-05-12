// lib/apt-subscription-meta.ts
import type { Metadata } from 'next';

export type AptSiteData = {
  id: string;
  slug: string;
  name: string;
  name_variants?: string[];
  region?: string | null;
  sigungu?: string | null;
  dong?: string | null;
  address?: string | null;
  builder?: string | null;
  developer?: string | null;
  total_units?: number | null;
  move_in_date?: string | null;
  status?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  description?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  cover_image_url?: string | null;
  og_image_url?: string | null;
  satellite_image_url?: string | null;
  popularity_score?: number | null;
  data_quality_score?: number | null;
  lifecycle_stage?: string | null;
  site_type?: string | null;
  keyword_targets?: string[] | null;
  faqs?: Array<{ q: string; a: string }> | null;
  faq_items?: Array<{ q: string; a: string }> | null;
  estimated_safe_margin?: number | null;
  vr_url?: string | null;
  model_house_lat?: number | null;
  model_house_lng?: number | null;
  managed_by_agent?: string | null;
  agent_kakao_url?: string | null;
  comparable_site_slugs?: string[] | null;
  updated_at?: string;
  created_at?: string;
  [key: string]: unknown;
};

export type AptSubscriptionRaw = {
  id: number;
  house_manage_no: string;
  house_nm: string;
  rcept_bgnde?: string | null;
  rcept_endde?: string | null;
  spsply_rcept_bgnde?: string | null;
  spsply_rcept_endde?: string | null;
  przwner_presnatn_de?: string | null;
  cntrct_cncls_bgnde?: string | null;
  cntrct_cncls_endde?: string | null;
  mvn_prearnge_ym?: string | null;
  pblanc_url?: string | null;
  total_households?: number | null;
  tot_supply_hshld_co?: number | null;
  general_supply_total?: number | null;
  special_supply_total?: number | null;
  competition_rate_1st?: number | null;
  expected_competition?: number | null;
  is_price_limit?: boolean | null;
  is_regulated_area?: boolean | null;
  price_per_pyeong_avg?: number | null;
  price_per_pyeong_min?: number | null;
  price_per_pyeong_max?: number | null;
  supply_price_info?: unknown;
  house_type_info?: unknown;
  supply_breakdown?: unknown;
  payment_schedule?: unknown;
  ai_summary?: string | null;
  announcement_pdf_url?: string | null;
  announcement_parsed_at?: string | null;
  fetched_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type AptSitePageData = {
  site: AptSiteData;
  subscription?: AptSubscriptionRaw | null;
  reviews_count: number;
  reviews_avg_rating: number;
  recent_views_7d: number;
  related_blogs: Array<{ post_id: number; anchor_text: string; position?: string }>;
  agent_info?: { kakao_url: string } | null;
};

const KO_NUM = (n: number | null | undefined): string => {
  if (n == null) return '';
  const eok = Math.floor(n / 10000);
  const man = n % 10000;
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString('ko')}만`;
  if (eok > 0) return `${eok}억`;
  return `${n.toLocaleString('ko')}만`;
};

export function formatPriceRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return '';
  if (min && max && min !== max) return `${KO_NUM(min)}~${KO_NUM(max)}`;
  return KO_NUM(min ?? max);
}

export function calculateDday(date: string | null | undefined): number | null {
  if (!date) return null;
  const target = new Date(date).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today.getTime()) / 86400000);
  return diff;
}

const STAGE_LABEL: Record<string, string> = {
  pre_announcement: '공고 예정',
  subscription_open: '청약 진행중',
  subscription_imminent: '청약 임박',
  award_announced: '당첨자 발표',
  contract_period: '계약 기간',
  occupied: '입주 완료',
};

export function generateAptSubMeta(s: AptSiteData, sub?: AptSubscriptionRaw | null): Metadata {
  const dDay = calculateDday(sub?.rcept_bgnde);
  const priceRange = formatPriceRange(s.price_min, s.price_max);
  const competition = sub?.expected_competition ?? sub?.competition_rate_1st;
  const stageLabel = s.lifecycle_stage ? STAGE_LABEL[s.lifecycle_stage] : '';

  const titleParts = [
    s.name,
    priceRange && `분양가 ${priceRange}`,
    dDay !== null && dDay >= 0 && dDay <= 30 && `D-${dDay}`,
    competition && `경쟁률 ${competition}:1 예상`,
  ].filter(Boolean);

  const title = `${s.seo_title || titleParts.join(' · ')} | 카더라`;

  const description =
    s.seo_description ||
    [
      s.name,
      [s.region, s.sigungu, s.dong].filter(Boolean).join(' '),
      s.total_units && `총 ${s.total_units}세대`,
      priceRange && `분양가 ${priceRange}`,
      stageLabel,
      '평면도·청약일정·모델하우스 위치를 카더라에서.',
    ]
      .filter(Boolean)
      .join(' · ');

  const ogTitle = encodeURIComponent(s.name);
  const ogSubtitle = encodeURIComponent(
    [priceRange, dDay !== null && dDay >= 0 ? `D-${dDay}` : null].filter(Boolean).join(' · '),
  );
  const ogImageUrl =
    s.og_image_url ||
    `https://kadeora.app/api/og-apt?slug=${encodeURIComponent(s.slug)}&card=1&v=1`;
  const ogSquareUrl = `https://kadeora.app/api/og-square?title=${ogTitle}&category=apt&subtitle=${ogSubtitle}`;

  const keywords = [
    s.name,
    ...(s.name_variants || []),
    ...(s.keyword_targets || []),
    s.builder,
    s.region,
    s.sigungu,
    '분양가',
    '평면도',
    '청약일정',
    '모델하우스',
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join(',');

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      images: [
        { url: ogImageUrl, width: 1200, height: 630, alt: s.name },
        { url: ogSquareUrl, width: 630, height: 630, alt: s.name },
      ],
      type: 'article',
      publishedTime: s.created_at,
      modifiedTime: s.updated_at,
      siteName: '카더라',
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
      creator: '@kadeora_app',
      site: '@kadeora_app',
    },
    alternates: {
      canonical: `https://kadeora.app/apt/${encodeURIComponent(s.slug)}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
    other: {
      'naver:imagesearch': 'true',
      'naver:author': '카더라',
      'article:section': '분양',
      'article:tag': [s.name, ...(s.name_variants || []), s.builder, s.sigungu]
        .filter((v): v is string => typeof v === 'string' && v.length > 0)
        .join(','),
      'article:published_time': s.created_at || '',
      'article:modified_time': s.updated_at || '',
    },
  };
}

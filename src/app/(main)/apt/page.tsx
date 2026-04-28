import { SITE_URL } from '@/lib/constants';
import type { Metadata } from 'next';
import Disclaimer from '@/components/Disclaimer';
import AdBanner from '@/components/AdBanner';

import { detectDefaultRegion } from '@/lib/region-detection';
import {
  fetchHeroSite, fetchSiteList, fetchPriceTrend, fetchAIAnalysis,
  fetchBuilders, fetchCategoryCounts,
  type AptCategory, type AptFilters,
} from '@/lib/apt-fetcher';

import RegionHero from '@/components/apt/RegionHero';
import RegionHeader from '@/components/apt/RegionHeader';
import AptHeroSearch from '@/components/apt/AptHeroSearch';
import AptCategoryTabs from '@/components/apt/AptCategoryTabs';
import AptQuickFilters from '@/components/apt/AptQuickFilters';
import AptHeroCard from '@/components/apt/AptHeroCard';
import AptSiteList from '@/components/apt/AptSiteList';
import AptLocalPriceCard from '@/components/apt/AptLocalPriceCard';
import AptAIAnalysisCard from '@/components/apt/AptAIAnalysisCard';
import AptBuildersSection from '@/components/apt/AptBuildersSection';
import AptOtherRegions from '@/components/apt/AptOtherRegions';
import AptMapCTA from '@/components/apt/AptMapCTA';

export const revalidate = 60;
export const maxDuration = 30;

const APT_SECTION_META: Record<string, { title: string; desc: string }> = {
  'apt-region':       { title: '전국 부동산 현황', desc: '지역별 청약·분양·미분양·재개발 현황을 한눈에' },
  'apt-calendar':     { title: '이번 달 청약 캘린더', desc: '접수중·예정 청약 일정 모아보기' },
  'apt-subscription': { title: '전국 청약 현황', desc: '접수중·예정·마감 전국 아파트 청약 정보' },
};

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ section?: string; region?: string; sigungu?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  const s = sp.section ? APT_SECTION_META[sp.section] : null;
  const regionLabel = sp.region ? (sp.sigungu ? `${sp.region} ${sp.sigungu}` : sp.region) : null;
  const baseTitle = s?.title || (regionLabel ? `${regionLabel} 부동산 — 청약·분양·미분양·재개발` : '아파트 청약 일정 · 분양중 · 미분양 · 재개발');
  const baseDesc = s?.desc || (regionLabel
    ? `${regionLabel}의 청약 일정, 분양중·미분양·재개발 단지를 한눈에. 실거래가, 시공사별 분석까지 카더라에서.`
    : '2026년 전국 아파트 청약 일정, 현재 분양중인 아파트, 미분양 현황, 재개발·재건축 진행 현황을 한눈에 확인하세요.');
  const ogImg = sp.section
    ? `${SITE_URL}/api/og?section=${sp.section}&design=2`
    : `${SITE_URL}/api/og?title=${encodeURIComponent('아파트 청약·분양·재개발')}&subtitle=${encodeURIComponent(regionLabel || '전국 실시간 현황')}`;

  return {
    title: baseTitle, description: baseDesc,
    alternates: { canonical: SITE_URL + '/apt' },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: {
      title: baseTitle, description: baseDesc,
      url: SITE_URL + '/apt', siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [
        { url: ogImg, width: 1200, height: 630, alt: `카더라 ${baseTitle}` },
        { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('부동산')}&category=apt`, width: 630, height: 630, alt: `카더라 ${baseTitle}` },
      ],
    },
    twitter: { card: 'summary_large_image', title: baseTitle, description: baseDesc, images: [ogImg] },
    other: {
      'article:section': '부동산',
      'article:tag': '부동산,청약,분양,미분양,재개발,실거래가,아파트',
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString(),
      'naver:author': '카더라',
      'og:updated_time': new Date().toISOString(),
      'dg:plink': SITE_URL + '/apt',
    },
  };
}

const VALID_CATEGORIES: AptCategory[] = ['all', 'subscription', 'imminent_d7', 'unsold', 'redev', 'trade'];

export default async function AptPage({
  searchParams,
}: {
  searchParams?: Promise<{
    region?: string; sigungu?: string; category?: string;
    price?: string; size?: string; builder?: string;
    section?: string;
  }>;
}) {
  const sp = (await searchParams) || {};
  const region = sp.region?.trim() || null;
  const sigungu = sp.sigungu?.trim() || null;

  // 지역 미설정 → RegionHero (IP geolocation default 만 server-side, 나머지는 client)
  if (!region) {
    const defaultRegion = await detectDefaultRegion();
    return (
      <>
        <RegionHero defaultRegion={defaultRegion} />
        <Disclaimer type="apt" />
      </>
    );
  }

  // ─── region 설정됨 → 큐레이션 server fetch ───
  const rawCat = (sp.category as AptCategory | undefined) || 'all';
  const category: AptCategory = VALID_CATEGORIES.includes(rawCat) ? rawCat : 'all';
  const filters: AptFilters = {
    region, sigungu, category,
    price: sp.price?.trim() || undefined,
    size: sp.size?.trim() || undefined,
    builder: sp.builder?.trim() || undefined,
  };

  const [heroSite, siteList, priceTrend, aiAnalysis, builders, categoryCounts] = await Promise.all([
    fetchHeroSite(filters),
    fetchSiteList(filters, 6),
    fetchPriceTrend(region, sigungu),
    fetchAIAnalysis(region),
    fetchBuilders(region, 5),
    fetchCategoryCounts(region, sigungu),
  ]);

  const regionLabel = sigungu ? `${region} ${sigungu}` : region;

  return (
    <>
      {/* SEO JSON-LD — region 컨텍스트 적용 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
              { '@type': 'ListItem', position: 3, name: regionLabel, item: `${SITE_URL}/apt?region=${encodeURIComponent(region)}${sigungu ? `&sigungu=${encodeURIComponent(sigungu)}` : ''}` },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `${regionLabel} 부동산 — 청약·분양·미분양·재개발`,
            description: `${regionLabel}의 청약·분양중·미분양·재개발 단지 ${(categoryCounts.all ?? 0).toLocaleString()}건`,
            url: `${SITE_URL}/apt?region=${encodeURIComponent(region)}${sigungu ? `&sigungu=${encodeURIComponent(sigungu)}` : ''}`,
            isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${regionLabel} 부동산`,
            speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.region-summary'] },
          }),
        }}
      />

      <h1 className="sr-only">{regionLabel} 부동산 — 청약·분양·미분양·재개발</h1>
      <p className="sr-only region-summary">
        {regionLabel}의 청약·분양·미분양·재개발 단지 {(categoryCounts.all ?? 0).toLocaleString()}건을 한눈에. 분양 진행 {categoryCounts.subscription ?? 0}건, 청약 임박 {categoryCounts.imminent_d7 ?? 0}건, 미분양 {categoryCounts.unsold ?? 0}건, 재개발 {categoryCounts.redev ?? 0}건, 실거래 {categoryCounts.trade ?? 0}건.
      </p>

      {/* sticky chrome — RegionHeader → AptCategoryTabs */}
      <RegionHeader region={region} sigungu={sigungu} />
      <AptHeroSearch region={region} sigungu={sigungu} />
      <AptCategoryTabs current={category} region={region} sigungu={sigungu} countByCategory={categoryCounts} />
      <AptQuickFilters filters={filters} topBuilders={builders} />

      {heroSite && <AptHeroCard site={heroSite} region={region} sigungu={sigungu} />}
      <AptSiteList sites={siteList} category={category} region={region} sigungu={sigungu} />

      {priceTrend && <AptLocalPriceCard data={priceTrend} region={region} sigungu={sigungu} />}
      {aiAnalysis && <AptAIAnalysisCard post={aiAnalysis} region={region} />}
      <AptBuildersSection builders={builders} region={region} />

      <AptOtherRegions current={region} />
      <AptMapCTA disabled />

      <AdBanner />
      <Disclaimer type="apt" />
    </>
  );
}

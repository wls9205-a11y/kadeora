import { SITE_URL } from '@/lib/constants';
import type { Metadata } from 'next';
import Disclaimer from '@/components/Disclaimer';
import AdBanner from '@/components/AdBanner';

import { detectDefaultRegion } from '@/lib/region-detection';
import {
  fetchHeroSite, fetchSiteList, fetchAIAnalysis, fetchCategoryCounts,
  fetchStatsKPI, fetchImminentTop3, fetchSigunguTrends, fetchPriceBands,
  fetchBuildersHub, fetchRecentTrades, fetchBlogList,
  type AptCategory, type AptFilters, type AptSortKey,
} from '@/lib/apt-fetcher';

import RegionHero from '@/components/apt/RegionHero';
import RegionHeader from '@/components/apt/RegionHeader';
import AptHeroSearch from '@/components/apt/AptHeroSearch';
import AptCategoryTabs from '@/components/apt/AptCategoryTabs';
import AptQuickFilters from '@/components/apt/AptQuickFilters';
import AptStatsKPI from '@/components/apt/AptStatsKPI';
import AptHeroLarge from '@/components/apt/AptHeroLarge';
import AptImminentBar from '@/components/apt/AptImminentBar';
import AptMainGrid from '@/components/apt/AptMainGrid';
import AptPriceTrendUnified from '@/components/apt/AptPriceTrendUnified';
import AptBuilderHub from '@/components/apt/AptBuilderHub';
import AptRecentTradeList from '@/components/apt/AptRecentTradeList';
import AptInsightsUnified from '@/components/apt/AptInsightsUnified';
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
const VALID_SORTS: AptSortKey[] = ['popularity', 'price', 'units', 'move_in'];

export default async function AptPage({
  searchParams,
}: {
  searchParams?: Promise<{
    region?: string; sigungu?: string; category?: string;
    price?: string; size?: string; builder?: string;
    sort?: string; page?: string;
    section?: string;
  }>;
}) {
  const sp = (await searchParams) || {};
  const region = sp.region?.trim() || null;
  const sigungu = sp.sigungu?.trim() || null;

  // 지역 미설정 → RegionHero (IP geolocation default)
  if (!region) {
    const defaultRegion = await detectDefaultRegion();
    return (
      <>
        <RegionHero defaultRegion={defaultRegion} />
        <Disclaimer type="apt" />
      </>
    );
  }

  // ─── region 설정됨 → 8섹션 server fetch ───
  const rawCat = (sp.category as AptCategory | undefined) || 'all';
  const category: AptCategory = VALID_CATEGORIES.includes(rawCat) ? rawCat : 'all';
  const rawSort = (sp.sort as AptSortKey | undefined) || 'popularity';
  const sort: AptSortKey = VALID_SORTS.includes(rawSort) ? rawSort : 'popularity';
  const pageNum = Math.max(1, Math.min(5, Number(sp.page) || 1));

  const filters: AptFilters = {
    region, sigungu, category,
    price: sp.price?.trim() || undefined,
    size: sp.size?.trim() || undefined,
    builder: sp.builder?.trim() || undefined,
    sort, page: pageNum,
  };

  const [
    heroSite, mainGridSites, kpis, imminentTop3,
    sigunguTrends, priceBands, builders,
    recentTrades, aiPost, blogList, categoryCounts,
  ] = await Promise.all([
    fetchHeroSite(filters),
    fetchSiteList(filters, 12),
    fetchStatsKPI(region, sigungu),
    fetchImminentTop3(region, sigungu),
    fetchSigunguTrends(region, sigungu, 12),
    fetchPriceBands(region, sigungu),
    fetchBuildersHub(region, 6),
    fetchRecentTrades(region, sigungu, 10),
    fetchAIAnalysis(region),
    fetchBlogList(region, 3),
    fetchCategoryCounts(region, sigungu),
  ]);

  const regionLabel = sigungu ? `${region} ${sigungu}` : region;

  return (
    <>
      {/* SEO JSON-LD — region 컨텍스트 */}
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
        {regionLabel}의 청약·분양·미분양·재개발 단지 {(categoryCounts.all ?? 0).toLocaleString()}건. 분양중 {kpis.active_sub}, 미분양 {kpis.unsold}, 재개발 {kpis.redev}, 7일 실거래 {kpis.trade_7d}건.
      </p>

      {/* Chrome — sticky */}
      <RegionHeader region={region} sigungu={sigungu} />
      <AptHeroSearch region={region} sigungu={sigungu} />
      <AptCategoryTabs current={category} region={region} sigungu={sigungu} countByCategory={categoryCounts} />
      <AptQuickFilters filters={filters} topBuilders={builders.map(b => ({ builder: b.builder, count: b.site_count }))} />

      {/* 8 섹션 */}
      {/* 1. KPI */}
      <AptStatsKPI region={region} sigungu={sigungu} kpis={kpis} />

      {/* 2. Hero (큰 사진) */}
      {heroSite && <AptHeroLarge site={heroSite} region={region} sigungu={sigungu} />}

      {/* 3. 임박 D-7 */}
      <AptImminentBar sites={imminentTop3} />

      {/* 4. 메인 grid (정렬 + 더보기) */}
      <AptMainGrid
        sites={mainGridSites}
        category={category}
        region={region} sigungu={sigungu}
        sort={sort} page={pageNum} perPage={12}
        price={filters.price} size={filters.size} builder={filters.builder}
      />

      {/* 5. 시세 + 가격대 */}
      <AptPriceTrendUnified
        region={region} sigungu={sigungu}
        trends={sigunguTrends} priceBands={priceBands}
        activePrice={filters.price}
        category={category} builder={filters.builder}
      />

      {/* 6. 시공사 hub */}
      <AptBuilderHub
        region={region} sigungu={sigungu}
        builders={builders}
        activeBuilder={filters.builder}
        category={category} price={filters.price}
      />

      {/* 7. 최근 실거래 */}
      <AptRecentTradeList region={region} sigungu={sigungu} trades={recentTrades} />

      {/* 8. AI + 블로그 */}
      <AptInsightsUnified region={region} aiPost={aiPost} blogList={blogList} />

      {/* footer chrome */}
      <AptOtherRegions current={region} />
      <AptMapCTA disabled />

      <AdBanner />
      <Disclaimer type="apt" />
    </>
  );
}

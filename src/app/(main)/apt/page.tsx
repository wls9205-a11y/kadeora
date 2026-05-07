import { SITE_URL } from '@/lib/constants';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import Disclaimer from '@/components/Disclaimer';
import AdBanner from '@/components/AdBanner';
import RegionAutoSelect from '@/components/apt/RegionAutoSelect';
import AptHeaderV5 from '@/components/apt/AptHeaderV5';
import AptCardGridV5 from '@/components/apt/AptCardGridV5';
import AptHomeSections from '@/components/apt/AptHomeSections';
import AptInsightsUnified from '@/components/apt/AptInsightsUnified';
import AptHomeHero from '@/components/apt/home/AptHomeHero';
import AptImminentCarousel from '@/components/apt/home/AptImminentCarousel';
import AptCategoryGrid from '@/components/apt/home/AptCategoryGrid';
import AptRealtimeRanking from '@/components/apt/home/AptRealtimeRanking';
import AptRegionalPriceGrid from '@/components/apt/home/AptRegionalPriceGrid';
import {
  fetchStatsKPI,
  fetchImminentTop3,
  fetchCategoryCounts,
  fetchSiteList,
  fetchSigunguTrends,
  fetchAIAnalysis,
  fetchBlogList,
} from '@/lib/apt-fetcher';
import type { AptFilters, AptCategory } from '@/lib/apt-fetcher';

export const dynamic = 'force-dynamic';
export const revalidate = 600; // s239 W5: 10분 ISR (cold start ↓ + 봇 캐시 hit ↑)
export const maxDuration = 30;

function tabToCategory(tab: string | undefined): AptCategory {
  switch (tab) {
    case 'ongoing': return 'subscription';
    case 'imminent': return 'imminent_d7';
    case 'unsold': return 'unsold';
    case 'redev': return 'redev';
    case 'trade': return 'trade';
    default: return 'all';
  }
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ region?: string; tab?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  const regionLabel = sp.region ?? '전국';
  const baseTitle = sp.region ? `${regionLabel} 부동산 — 청약·분양·미분양·재개발` : '아파트 청약 일정 · 분양중 · 미분양 · 재개발';
  const baseDesc = sp.region
    ? `${regionLabel}의 청약 일정, 분양중·미분양·재개발 단지를 한눈에. 실거래가, 시공사별 분석까지 카더라에서.`
    : '2026년 전국 아파트 청약 일정, 현재 분양중인 아파트, 미분양 현황, 재개발·재건축 진행 현황을 한눈에 확인하세요.';
  const ogSquareImg = `${SITE_URL}/api/og-square?title=${encodeURIComponent(regionLabel)}&category=apt`;
  const canonicalUrl = sp.region ? `${SITE_URL}/apt?region=${encodeURIComponent(sp.region)}` : `${SITE_URL}/apt`;
  const titleEnc = encodeURIComponent(baseTitle);
  const ogImages = [
    { url: `${SITE_URL}/api/og?card=hero&category=apt&title=${titleEnc}`, width: 1200, height: 630, alt: `카더라 ${baseTitle}` },
    { url: `${SITE_URL}/api/og?card=stats&category=apt&title=${titleEnc}`, width: 1200, height: 630, alt: `${baseTitle} 통계` },
    { url: `${SITE_URL}/api/og?card=imminent&category=apt&title=${titleEnc}`, width: 1200, height: 630, alt: `${baseTitle} 임박/추천` },
    { url: `${SITE_URL}/api/og?card=ranking&category=apt&title=${titleEnc}`, width: 1200, height: 630, alt: `${baseTitle} 랭킹` },
    { url: `${SITE_URL}/api/og?card=region&category=apt&title=${titleEnc}`, width: 1200, height: 630, alt: `${baseTitle} 지역` },
    { url: ogSquareImg, width: 630, height: 630, alt: `카더라 ${baseTitle}` },
  ];

  return {
    title: baseTitle,
    description: baseDesc,
    alternates: { canonical: canonicalUrl },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: {
      title: baseTitle, description: baseDesc,
      url: canonicalUrl, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: ogImages,
    },
    twitter: { card: 'summary_large_image', title: baseTitle, description: baseDesc, images: ogImages },
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

interface SummaryPayload {
  cat: { total: number; ongoing: number; unsold: number; redev: number; trade: number };
  imminent: number;
  sido: Array<{ name: string; count: number }>;
}

export default async function AptPage({
  searchParams,
}: {
  searchParams?: Promise<{ region?: string; tab?: string; page?: string }>;
}) {
  const sp = (await searchParams) || {};
  const region = sp.region?.trim()
    || (await headers()).get('x-kd-region')
    || '전국';
  const isAutoRegion = !sp.region;
  const activeTab = sp.tab ?? 'all';
  const category = tabToCategory(sp.tab);
  const pageNum = Math.max(1, Math.min(10, Number(sp.page) || 1));

  const sb = getSupabaseAdmin();
  const { data: summary } = await (sb as any).rpc('get_apt_v5_summary', { p_region: region });
  const s = (summary ?? { cat: { total: 0, ongoing: 0, unsold: 0, redev: 0, trade: 0 }, imminent: 0, sido: [] }) as SummaryPayload;

  const sigungu: string | null = null;
  const filters: AptFilters = { region, sigungu, category, sort: 'popularity', page: pageNum };
  const isHome = activeTab === 'all' && pageNum === 1;

  const [kpisRaw, imminentTop3, categoryCountsRaw, mainGridSites, sigunguTrends, aiPost, blogList] = isHome
    ? await Promise.all([
        fetchStatsKPI(region, sigungu),
        fetchImminentTop3(region, sigungu),
        fetchCategoryCounts(region, sigungu),
        fetchSiteList({ ...filters, page: 1 }, 5),
        fetchSigunguTrends(region, sigungu, 24),
        fetchAIAnalysis(region),
        fetchBlogList(region, 3),
      ])
    : [null, [], {}, [], [], null, []] as const;

  const kpis: any = {
    ...(kpisRaw || {}),
    imminent_d7: s.imminent ?? (kpisRaw as any)?.imminent_d7 ?? 0,
  };

  const categoryCounts = {
    active_subscription: (categoryCountsRaw as any)?.subscription ?? 0,
    unsold: (categoryCountsRaw as any)?.unsold ?? 0,
    redev: (categoryCountsRaw as any)?.redev ?? 0,
    trade: (categoryCountsRaw as any)?.trade ?? 0,
  };

  const moreParams = new URLSearchParams();
  if (sp.region) moreParams.set('region', sp.region);
  if (sp.tab) moreParams.set('tab', sp.tab);
  moreParams.set('page', String(pageNum + 1));
  const moreHref = `/apt?${moreParams.toString()}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
              { '@type': 'ListItem', position: 3, name: region, item: `${SITE_URL}/apt?region=${encodeURIComponent(region)}` },
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
            name: `${region} 부동산 — 청약·분양·미분양·재개발`,
            description: `${region}의 청약·분양중·미분양·재개발 단지 ${s.cat.total.toLocaleString()}건`,
            url: `${SITE_URL}/apt?region=${encodeURIComponent(region)}`,
            isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL },
          }),
        }}
      />

      <h1 className="sr-only">{region} 부동산 — 청약·분양·미분양·재개발</h1>
      <p className="sr-only region-summary">
        {region}의 청약·분양·미분양·재개발 단지 {s.cat.total.toLocaleString()}건. 분양중 {s.cat.ongoing}, 미분양 {s.cat.unsold}, 재개발 {s.cat.redev}, 실거래 {s.cat.trade}건.
      </p>

      {isAutoRegion && <RegionAutoSelect />}

      {isHome ? (
        <>
          <AptHomeHero region={region} sigungu={sigungu} kpis={kpis} />
          <AptImminentCarousel sites={imminentTop3 as any[]} />
          <AptCategoryGrid counts={categoryCounts} />
          <AptRealtimeRanking sites={(mainGridSites as any[]).slice(0, 5)} />
          <AptRegionalPriceGrid region={region} sigunguTrends={sigunguTrends as any[]} />
          <AptInsightsUnified region={region} aiPost={aiPost} blogList={blogList as any} />
          <AptHomeSections />
        </>
      ) : (
        <>
          <AptHeaderV5
            region={region}
            totalCount={s.cat.total}
            imminentCount={s.imminent}
            cat={s.cat}
            sido={s.sido}
            activeTab={activeTab}
          />
          <AptCardGridV5 filters={filters} moreHref={moreHref} perPage={12} />
        </>
      )}

      <AdBanner />
      <Disclaimer type="apt" />
    </>
  );
}

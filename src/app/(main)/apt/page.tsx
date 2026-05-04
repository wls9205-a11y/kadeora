import { SITE_URL } from '@/lib/constants';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import Disclaimer from '@/components/Disclaimer';
import AdBanner from '@/components/AdBanner';
import RegionAutoSelect from '@/components/apt/RegionAutoSelect';
import AptHeaderV5 from '@/components/apt/AptHeaderV5';
import AptCardGridV5 from '@/components/apt/AptCardGridV5';
import type { AptFilters, AptCategory } from '@/lib/apt-fetcher';

export const dynamic = 'force-dynamic';
export const revalidate = 60;
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
  const ogWideImg = `${SITE_URL}/api/og?title=${encodeURIComponent('아파트 청약·분양·재개발')}&subtitle=${encodeURIComponent(regionLabel)}`;
  const canonicalUrl = sp.region ? `${SITE_URL}/apt?region=${encodeURIComponent(sp.region)}` : `${SITE_URL}/apt`;

  return {
    title: baseTitle,
    description: baseDesc,
    alternates: { canonical: canonicalUrl },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: {
      title: baseTitle, description: baseDesc,
      url: canonicalUrl, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [
        { url: ogSquareImg, width: 630, height: 630, alt: `카더라 ${baseTitle}` },
        { url: ogWideImg, width: 1200, height: 630, alt: `카더라 ${baseTitle}` },
      ],
    },
    twitter: { card: 'summary_large_image', title: baseTitle, description: baseDesc, images: [ogSquareImg] },
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
  searchParams?: Promise<{ region?: string; tab?: string }>;
}) {
  const sp = (await searchParams) || {};
  const region = sp.region?.trim()
    || (await headers()).get('x-kd-region')
    || '전국';
  const isAutoRegion = !sp.region;
  const activeTab = sp.tab ?? 'all';
  const category = tabToCategory(sp.tab);

  const sb = getSupabaseAdmin();
  const { data: summary } = await (sb as any).rpc('get_apt_v5_summary', { p_region: region });
  const s = (summary ?? { cat: { total: 0, ongoing: 0, unsold: 0, redev: 0, trade: 0 }, imminent: 0, sido: [] }) as SummaryPayload;

  const filters: AptFilters = { region, sigungu: null, category, sort: 'popularity', page: 1 };

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

      <AptHeaderV5
        region={region}
        totalCount={s.cat.total}
        imminentCount={s.imminent}
        cat={s.cat}
        sido={s.sido}
        activeTab={activeTab}
      />

      <AptCardGridV5 filters={filters} />

      <AdBanner />
      <Disclaimer type="apt" />
    </>
  );
}

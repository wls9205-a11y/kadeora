import { createSupabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';
import { fmtAmount } from '@/lib/format';
import ComplexClient from './ComplexClient';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '단지백과 — 전국 34,000+ 아파트 연차별 실거래가·전세·월세 비교 | 카더라',
  description: '전국 34,000여 아파트를 입주 연차별로 비교하세요. 신축부터 30년+ 구축까지, 매매·전세·월세 실거래가와 전세가율, 평당가 추이를 한눈에 확인. 지역별·연차별 필터와 검색 기능 제공.',
  keywords: '단지백과,아파트 비교,실거래가,전세가율,아파트 시세,연차별,신축 아파트,구축 아파트,아파트 검색,전세,월세,매매,카더라',
  alternates: { canonical: `${SITE_URL}/apt/complex` },
  openGraph: {
    title: '단지백과 — 전국 아파트 연차별 비교 | 카더라',
    description: '34,000+ 아파트 매매·전세·월세 실거래 데이터 기반 비교 분석',
    url: `${SITE_URL}/apt/complex`,
    siteName: '카더라', locale: 'ko_KR', type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('단지백과')}&category=apt&design=2&subtitle=${encodeURIComponent('전국 34,000+ 아파트 연차별 비교')}&author=${encodeURIComponent('카더라 부동산팀')}`, width: 1200, height: 630 },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('단지백과')}&category=apt&subtitle=${encodeURIComponent('연차별 아파트 비교')}`, width: 630, height: 630 },
    ],
  },
  twitter: { card: 'summary_large_image', title: '단지백과 | 카더라', description: '전국 아파트 연차별 실거래가·전세·월세 비교' },
  other: {
    'naver:author': '카더라 부동산팀',
    'naver:site_name': '카더라',
    'og:updated_time': new Date().toISOString(),
    'article:section': '부동산',
    'article:tag': '단지백과,아파트,실거래가,전세,월세,시세,비교,연차별,카더라',
  },
};

const AGE_GROUPS = ['신축', '5년차', '10년차', '15년차', '20년차', '25년차', '30년+'];
const REGIONS = ['서울', '경기', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

export default async function ComplexPage() {
  const sb = await createSupabaseServer();

  // apt_complex_profiles에서 직접 조회 (34,000+ 프로필)
  const { data: profiles } = await (sb as any).from('apt_complex_profiles')
    .select('apt_name, sigungu, region_nm, age_group, latest_sale_price, latest_jeonse_price, latest_monthly_deposit, latest_monthly_rent, jeonse_ratio, sale_count_1y, rent_count_1y, built_year')
    .not('age_group', 'is', null)
    .order('sale_count_1y', { ascending: false })
    .limit(5000);

  const allProfiles: any[] = profiles || [];

  // 연차별 통계 (DB 뷰 — 전체 34,000+ 프로필 기반)
  const { data: ageRows } = await (sb as any).from('v_complex_age_stats').select('*');
  const ageMap = new Map<string, any>();
  for (const r of (ageRows || [])) ageMap.set(r.age_group, r);

  const ageChartData = AGE_GROUPS.map(g => {
    const s = ageMap.get(g);
    return { group: g, avg: s?.avg_sale_price || 0, count: s?.profile_count || 0 };
  });

  // 지역별 통계 (DB 뷰 — 전체 프로필 기반)
  const { data: regionRows } = await (sb as any).from('v_complex_region_stats').select('*');
  const regionData = REGIONS
    .map(r => {
      const row = (regionRows || []).find((x: any) => x.region_nm === r);
      return { region: r, count: row?.profile_count || 0 };
    })
    .filter(r => r.count > 0);

  const totalProfiles = (regionRows || []).reduce((s: number, r: any) => s + (r.profile_count || 0), 0);

  // TOP 단지 (거래 많은 순, 100개 — Supabase 1,000 limit 내)
  const topComplexes = allProfiles.slice(0, 100).map((p: any) => ({
    aptName: p.apt_name,
    sigungu: p.sigungu,
    region: p.region_nm,
    builtYear: p.built_year || 0,
    saleCount: p.sale_count_1y || 0,
    lastPrice: p.latest_sale_price || 0,
    jeonse: p.latest_jeonse_price || 0,
    monthly: p.latest_monthly_deposit || 0,
    monthlyRent: p.latest_monthly_rent || 0,
    ageGroup: p.age_group || '',
    jeonseRatio: p.jeonse_ratio || null,
  }));


  return (
    <article style={{ maxWidth: 960, margin: '0 auto', padding: '0 14px 80px' }}>
      {/* JSON-LD: CollectionPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: '단지백과 — 전국 아파트 연차별 비교',
        description: `전국 ${totalProfiles.toLocaleString()}개 아파트를 입주 연차별로 비교하는 종합 가이드`,
        url: `${SITE_URL}/apt/complex`,
        isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL },
        numberOfItems: totalProfiles,
        provider: { '@type': 'Organization', name: '카더라', url: SITE_URL },
      })}} />
      {/* JSON-LD: Dataset */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Dataset',
        name: '전국 아파트 실거래가 데이터셋',
        description: `전국 ${totalProfiles.toLocaleString()}개 아파트 단지의 매매·전세·월세 실거래 데이터`,
        url: `${SITE_URL}/apt/complex`,
        creator: { '@type': 'Organization', name: '카더라', url: SITE_URL },
        keywords: ['아파트', '실거래가', '전세', '월세', '시세', '전세가율'],
        spatialCoverage: { '@type': 'Place', name: '대한민국' },
        temporalCoverage: '2023/2026',
        dateModified: new Date().toISOString(),
      })}} />
      {/* JSON-LD: BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
          { '@type': 'ListItem', position: 3, name: '단지백과' },
        ],
      })}} />
      {/* JSON-LD: FAQPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: '단지백과란 무엇인가요?', acceptedAnswer: { '@type': 'Answer', text: `카더라 단지백과는 전국 ${totalProfiles.toLocaleString()}개 아파트 단지의 매매·전세·월세 시세를 입주 연차별로 비교할 수 있는 서비스입니다. 신축부터 30년+ 구축까지 7개 연차 그룹으로 분류합니다.` } },
          { '@type': 'Question', name: '아파트 전세가율이란?', acceptedAnswer: { '@type': 'Answer', text: '전세가율은 아파트 매매가 대비 전세가의 비율입니다. 전세가율이 높을수록 갭투자 리스크가 높고, 낮을수록 매매 대비 전세가 저렴합니다. 일반적으로 50~70%가 안정적인 수준으로 봅니다.' } },
          { '@type': 'Question', name: '입주 연차별 시세 차이는?', acceptedAnswer: { '@type': 'Answer', text: '일반적으로 15~20년차 아파트가 리모델링 기대감으로 시세가 높은 경우가 많고, 신축은 프리미엄이 붙어 높은 편입니다. 30년+ 구축은 재건축 기대감에 따라 시세가 크게 달라집니다.' } },
        ],
      })}} />

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <nav style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8, display: 'flex', gap: 4 }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>홈</Link><span>›</span>
          <Link href="/apt" style={{ color: 'inherit', textDecoration: 'none' }}>부동산</Link><span>›</span>
          <span style={{ color: 'var(--text-primary)' }}>단지백과</span>
        </nav>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>🏢 단지백과</h1>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          전국 아파트 연차별 종합 가이드 — {totalProfiles.toLocaleString()}개 단지 · {regionData.length}개 지역
        </p>
      </div>

      {/* 연차별 시세 비교 */}
      <div className="kd-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📊 연차별 평균 매매가</div>
        {ageChartData.map(d => {
          const maxAvg = Math.max(...ageChartData.map(x => x.avg));
          const pct = maxAvg > 0 ? (d.avg / maxAvg) * 100 : 0;
          return (
            <div key={d.group} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minWidth: 48 }}>{d.group}</span>
              <div style={{ flex: 1, height: 22, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: d.group === '신축' ? 'var(--brand)' : d.group.includes('30') ? 'var(--accent-red)' : 'var(--accent-blue)', transition: 'width 0.3s' }} />
                {d.avg > 0 && (
                  <span style={{ position: 'absolute', right: 8, top: 3, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fmtAmount(d.avg)}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 60, textAlign: 'right' }}>{d.count.toLocaleString()}개</span>
            </div>
          );
        })}
      </div>

      {/* 지역별 현황 */}
      <div className="kd-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🗺️ 지역별 현황</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {regionData.map(r => (
            <Link key={r.region} href={`/apt/complex?region=${r.region}`} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {r.region}
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{r.count.toLocaleString()}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 클라이언트 필터 + 카드 그리드 */}
      <ComplexClient complexes={topComplexes} ageGroups={AGE_GROUPS} regions={regionData.map(r => r.region)} />
    </article>
  );
}

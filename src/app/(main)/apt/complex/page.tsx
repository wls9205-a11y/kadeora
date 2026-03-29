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

      {/* ═══ 히어로 섹션 — 그라데이션 배경 ═══ */}
      <div style={{
        borderRadius: 16, padding: '28px 24px 20px', marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(15,27,62,0.95) 0%, rgba(37,99,235,0.85) 100%)',
        border: '1px solid rgba(59,123,246,0.2)', position: 'relative', overflow: 'hidden',
      }}>
        {/* 데코 원형 */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(59,123,246,0.15)' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(59,123,246,0.1)' }} />

        <nav style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12, display: 'flex', gap: 4, position: 'relative' }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>홈</Link><span>›</span>
          <Link href="/apt" style={{ color: 'inherit', textDecoration: 'none' }}>부동산</Link><span>›</span>
          <span style={{ color: 'rgba(255,255,255,0.9)' }}>단지백과</span>
        </nav>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.5px', position: 'relative' }}>
          🏢 단지백과
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 20px', position: 'relative' }}>
          전국 아파트 연차별 종합 가이드 — 매매·전세·월세 실거래 데이터 기반
        </p>

        {/* 핵심 수치 카운터 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, position: 'relative' }}>
          {[
            { label: '분석 단지', value: totalProfiles.toLocaleString(), unit: '개', icon: '🏘️' },
            { label: '커버 지역', value: String(regionData.length), unit: '개', icon: '📍' },
            { label: '연차 그룹', value: '7', unit: '개', icon: '📊' },
            { label: '데이터 기간', value: '4', unit: '년', icon: '📅' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 8px', textAlign: 'center',
              backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
                {s.value}<span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>{s.unit}</span>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ 지역별 현황 — 카드 그리드 (지역 셀렉 우선) ═══ */}
      <div style={{
        borderRadius: 14, padding: '18px 20px', marginBottom: 16,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>🗺️ 지역별 현황</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
          {regionData.map((r, i) => {
            const isTop = i < 3;
            return (
              <Link key={r.region} href={`/apt/complex?region=${r.region}`} style={{
                padding: '10px 8px', borderRadius: 10, textDecoration: 'none', textAlign: 'center',
                background: isTop ? 'rgba(59,123,246,0.08)' : 'var(--bg-hover)',
                border: isTop ? '1px solid rgba(59,123,246,0.2)' : '1px solid var(--border)',
                transition: 'transform 0.12s ease',
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: isTop ? 'var(--brand)' : 'var(--text-primary)' }}>{r.region}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{r.count.toLocaleString()}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>단지</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ═══ 연차별 시세 비교 — 향상된 차트 ═══ */}
      <div style={{
        borderRadius: 14, padding: '18px 20px', marginBottom: 20,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>📊 연차별 평균 매매가</div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>만원 기준</span>
        </div>
        {ageChartData.map((d, i) => {
          const maxAvg = Math.max(...ageChartData.map(x => x.avg));
          const pct = maxAvg > 0 ? (d.avg / maxAvg) * 100 : 0;
          const colors: Record<string, [string, string]> = {
            '신축': ['#3b7bf6', '#60a5fa'], '5년차': ['#06b6d4', '#22d3ee'],
            '10년차': ['#8b5cf6', '#a78bfa'], '15년차': ['#f59e0b', '#fbbf24'],
            '20년차': ['#f97316', '#fb923c'], '25년차': ['#ef4444', '#f87171'],
            '30년+': ['#dc2626', '#ef4444'],
          };
          const [c1, c2] = colors[d.group] || ['#666', '#888'];
          return (
            <div key={d.group} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: c1, minWidth: 48, textAlign: 'right' }}>{d.group}</span>
              <div style={{ flex: 1, height: 28, borderRadius: 8, background: 'var(--bg-hover)', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%', width: `${pct}%`, borderRadius: 8,
                  background: `linear-gradient(90deg, ${c1}, ${c2})`,
                  transition: 'width 0.6s ease',
                  boxShadow: `0 2px 8px ${c1}30`,
                }} />
                {d.avg > 0 && (
                  <span style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 12, fontWeight: 800, color: pct > 50 ? '#fff' : 'var(--text-primary)',
                    textShadow: pct > 50 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                  }}>
                    {fmtAmount(d.avg)}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, minWidth: 56, textAlign: 'right',
                color: 'var(--text-tertiary)',
              }}>{d.count.toLocaleString()}개</span>
            </div>
          );
        })}
      </div>

      {/* ═══ 클라이언트 필터 + 카드 그리드 ═══ */}
      <ComplexClient complexes={topComplexes} ageGroups={AGE_GROUPS} regions={regionData.map(r => r.region)} />
    </article>
  );
}

import { createSupabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';
import { fmtAmount } from '@/lib/format';
import ComplexClient from './ComplexClient';

export const revalidate = 3600;

const AGE_GROUPS = ['신축', '5년차', '10년차', '15년차', '20년차', '25년차', '30년+'];
const REGIONS = ['서울', '경기', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ region?: string }> }): Promise<Metadata> {
  const { region } = await searchParams;
  const r = region || '';
  const title = r ? `${r} 아파트 단지백과 — 연차별 실거래가·전세·월세 비교 | 카더라` : '단지백과 — 전국 34,000+ 아파트 연차별 실거래가·전세·월세 비교 | 카더라';
  const desc = r ? `${r} 지역 아파트를 입주 연차별로 비교. 매매·전세·월세 실거래가와 전세가율 한눈에.` : '전국 34,000여 아파트를 입주 연차별로 비교. 매매·전세·월세 실거래가와 전세가율, 평당가 추이를 한눈에.';
  return {
    title, description: desc,
    keywords: `단지백과,${r || '전국'} 아파트,실거래가,전세가율,연차별,카더라`,
    alternates: { canonical: `${SITE_URL}/apt/complex${r ? `?region=${encodeURIComponent(r)}` : ''}` },
    openGraph: { title: `${r || '전국'} 단지백과 | 카더라`, description: desc, url: `${SITE_URL}/apt/complex`, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent((r || '전국') + ' 단지백과')}&category=apt&design=2&subtitle=${encodeURIComponent('연차별 아파트 비교')}&author=${encodeURIComponent('카더라 부동산팀')}`, width: 1200, height: 630 }] },
    other: { 'naver:author': '카더라 부동산팀', 'og:updated_time': new Date().toISOString(), 'article:section': '부동산' },
  };
}

export default async function ComplexPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { region: selectedRegion } = await searchParams;
  const sb = await createSupabaseServer();

  // 지역별 통계
  const { data: regionRows } = await (sb as any).from('v_complex_region_stats').select('*');
  const regionData = REGIONS
    .map(r => { const row = (regionRows || []).find((x: any) => x.region_nm === r); return { region: r, count: row?.profile_count || 0, avgPrice: row?.avg_sale_price || 0 }; })
    .filter(r => r.count > 0);
  const totalProfiles = (regionRows || []).reduce((s: number, r: any) => s + (r.profile_count || 0), 0);

  // 프로필 조회 (지역 필터 적용)
  let pq = (sb as any).from('apt_complex_profiles')
    .select('apt_name, sigungu, region_nm, dong, age_group, latest_sale_price, latest_jeonse_price, latest_monthly_deposit, latest_monthly_rent, jeonse_ratio, sale_count_1y, rent_count_1y, built_year, avg_sale_price_pyeong, latitude, longitude')
    .not('age_group', 'is', null)
    .order('sale_count_1y', { ascending: false });
  if (selectedRegion && REGIONS.includes(selectedRegion)) pq = pq.eq('region_nm', selectedRegion);
  const { data: profiles } = await pq.limit(1000);
  const allProfiles: any[] = profiles || [];

  // 연차별 통계 (현재 데이터 기준)
  const ageStats = new Map<string, { cnt: number; totalPrice: number }>();
  AGE_GROUPS.forEach(g => ageStats.set(g, { cnt: 0, totalPrice: 0 }));
  for (const p of allProfiles) {
    if (p.age_group && p.latest_sale_price > 0) {
      const s = ageStats.get(p.age_group);
      if (s) { s.cnt++; s.totalPrice += Number(p.latest_sale_price); }
    }
  }
  const ageChartData = AGE_GROUPS.map(g => { const s = ageStats.get(g)!; return { group: g, avg: s.cnt > 0 ? Math.round(s.totalPrice / s.cnt) : 0, count: s.cnt }; });

  const topComplexes = allProfiles.slice(0, 100).map((p: any) => ({
    aptName: p.apt_name, sigungu: p.sigungu, region: p.region_nm, dong: p.dong || '',
    builtYear: p.built_year || 0, saleCount: p.sale_count_1y || 0, rentCount: p.rent_count_1y || 0,
    lastPrice: p.latest_sale_price || 0, jeonse: p.latest_jeonse_price || 0,
    monthly: p.latest_monthly_deposit || 0, monthlyRent: p.latest_monthly_rent || 0,
    ageGroup: p.age_group || '', jeonseRatio: p.jeonse_ratio || null,
    pyeongPrice: p.avg_sale_price_pyeong || 0,
    hasCoords: !!(p.latitude && p.longitude),
  }));

  const displayCount = selectedRegion ? regionData.find(r => r.region === selectedRegion)?.count || allProfiles.length : totalProfiles;

  return (
    <article style={{ maxWidth: 960, margin: '0 auto', padding: '0 14px 80px' }}>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: selectedRegion ? `${selectedRegion} 단지백과` : '단지백과',
        description: `${selectedRegion || '전국'} ${displayCount.toLocaleString()}개 아파트 입주 연차별 비교`,
        url: `${SITE_URL}/apt/complex`, numberOfItems: displayCount,
        isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL },
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
          { '@type': 'ListItem', position: 3, name: '단지백과', item: `${SITE_URL}/apt/complex` },
          ...(selectedRegion ? [{ '@type': 'ListItem', position: 4, name: selectedRegion }] : []),
        ],
      })}} />

      {/* ═══ 콤팩트 헤더 (1줄) ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <nav style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, display: 'flex', gap: 4 }}>
            <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>홈</Link><span>›</span>
            <Link href="/apt" style={{ color: 'inherit', textDecoration: 'none' }}>부동산</Link><span>›</span>
            {selectedRegion ? (<><Link href="/apt/complex" style={{ color: 'inherit', textDecoration: 'none' }}>단지백과</Link><span>›</span><span style={{ color: 'var(--text-primary)' }}>{selectedRegion}</span></>) : (<span style={{ color: 'var(--text-primary)' }}>단지백과</span>)}
          </nav>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
            🏢 {selectedRegion ? `${selectedRegion} 단지백과` : '단지백과'}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)', marginLeft: 8 }}>{displayCount.toLocaleString()}개 단지</span>
          </h1>
        </div>
        {selectedRegion && (
          <Link href="/apt/complex" style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none', background: 'rgba(59,123,246,0.1)', padding: '5px 12px', borderRadius: 8 }}>
            ✕ 전체 보기
          </Link>
        )}
      </div>

      {/* ═══ 지역 필 바 — 수평 스크롤 ═══ */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: 2 }}>
        <Link href="/apt/complex" style={{
          padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
          background: !selectedRegion ? 'var(--brand)' : 'var(--bg-surface)', color: !selectedRegion ? '#fff' : 'var(--text-secondary)',
          border: !selectedRegion ? 'none' : '1px solid var(--border)',
          boxShadow: !selectedRegion ? '0 2px 8px rgba(59,123,246,0.3)' : 'none',
        }}>전체</Link>
        {regionData.map(r => {
          const active = selectedRegion === r.region;
          return (
            <Link key={r.region} href={active ? '/apt/complex' : `/apt/complex?region=${encodeURIComponent(r.region)}`} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              background: active ? 'var(--brand)' : 'var(--bg-surface)', color: active ? '#fff' : 'var(--text-secondary)',
              border: active ? 'none' : '1px solid var(--border)',
              boxShadow: active ? '0 2px 8px rgba(59,123,246,0.3)' : 'none',
            }}>{r.region} <span style={{ fontSize: 10, opacity: 0.7 }}>{r.count.toLocaleString()}</span></Link>
          );
        })}
      </div>

      {/* ═══ 연차별 미니 바 — 1줄 인라인 ═══ */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', paddingBottom: 2,
      }}>
        {ageChartData.map(d => {
          const maxAvg = Math.max(...ageChartData.map(x => x.avg));
          const pct = maxAvg > 0 ? Math.round((d.avg / maxAvg) * 100) : 0;
          const colors: Record<string, string> = { '신축': '#3b7bf6', '5년차': '#06b6d4', '10년차': '#8b5cf6', '15년차': '#f59e0b', '20년차': '#f97316', '25년차': '#ef4444', '30년+': '#dc2626' };
          const c = colors[d.group] || '#666';
          return (
            <div key={d.group} style={{
              flex: '1 1 0', minWidth: 70, background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 6px', textAlign: 'center', flexShrink: 0,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c, marginBottom: 4 }}>{d.group}</div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: c }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>{d.avg > 0 ? fmtAmount(d.avg) : '—'}</div>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{d.count.toLocaleString()}개</div>
            </div>
          );
        })}
      </div>

      {/* ═══ 카드 그리드 ═══ */}
      <ComplexClient
        complexes={topComplexes}
        ageGroups={AGE_GROUPS}
        regions={regionData.map(r => r.region)}
        initialRegion={selectedRegion || null}
      />
    </article>
  );
}

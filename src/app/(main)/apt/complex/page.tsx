import { createSupabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';
import { fmtAmount } from '@/lib/format';
import ShareButtons from '@/components/ShareButtons';
import ComplexClient from './ComplexClient';

export const revalidate = 3600;

const AGE_GROUPS = ['신축', '5년차', '10년차', '15년차', '20년차', '25년차', '30년+'];
const REGIONS = ['서울', '경기', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ region?: string }> }): Promise<Metadata> {
  const { region } = await searchParams;
  const r = region || '';
  const title = r ? `${r} 아파트 단지백과 — 연차별 실거래가·전세·월세 비교` : '단지백과 — 전국 34,000+ 아파트 연차별 실거래가·전세·월세 비교';
  const desc = r ? `${r} 지역 아파트를 입주 연차별로 비교. 매매·전세·월세 실거래가와 전세가율 한눈에.` : '전국 34,000여 아파트를 입주 연차별로 비교. 매매·전세·월세 실거래가와 전세가율, 평당가 추이를 한눈에.';
  return {
    title, description: desc,
    keywords: `단지백과,${r || '전국'} 아파트,실거래가,전세가율,연차별,카더라`,
    alternates: { canonical: `${SITE_URL}/apt/complex` },
    robots: { index: true, follow: true, 'max-snippet': -1 as const, 'max-image-preview': 'large' as const },
    openGraph: { title: `${r || '전국'} 단지백과 | 카더라`, description: desc, url: `${SITE_URL}/apt/complex`, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [
        { url: `${SITE_URL}/api/og?title=${encodeURIComponent((r || '전국') + ' 단지백과')}&category=apt&design=2&subtitle=${encodeURIComponent('연차별 아파트 비교')}&author=${encodeURIComponent('카더라')}`, width: 1200, height: 630 },
        { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent((r || '전국') + ' 단지백과')}&category=apt`, width: 630, height: 630 },
      ] },
    twitter: { card: 'summary_large_image' as const, title: `${r || '전국'} 단지백과`, description: desc },
    other: { 'naver:author': '카더라', 'og:updated_time': '2026-04-12T00:00:00Z', 'article:section': '부동산' },
  };
}

export default async function ComplexPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const { region: selectedRegion } = await searchParams;
  const sb = await createSupabaseServer();

  // 지역별 + 연차별 통계
  const [{ data: regionRows }, { data: ageRows }] = await Promise.all([
    (sb as any).from('v_complex_region_stats').select('*'),
    (sb as any).from('v_complex_age_stats').select('*'),
  ]);

  const regionData = REGIONS
    .map(r => { const row = (regionRows || []).find((x: any) => x.region_nm === r); return { region: r, count: row?.profile_count || 0, avgPrice: row?.avg_sale_price || 0 }; })
    .filter(r => r.count > 0);
  const totalProfiles = (regionRows || []).reduce((s: number, r: any) => s + (r.profile_count || 0), 0);

  const ageMap = new Map<string, any>();
  for (const r of (ageRows || [])) ageMap.set(r.age_group, r);

  // 프로필 조회
  let pq = (sb as any).from('apt_complex_profiles')
    .select('apt_name, sigungu, region_nm, dong, age_group, latest_sale_price, latest_jeonse_price, latest_monthly_deposit, latest_monthly_rent, jeonse_ratio, sale_count_1y, rent_count_1y, built_year, avg_sale_price_pyeong, latitude, longitude, images')
    .not('age_group', 'is', null)
    .order('sale_count_1y', { ascending: false });
  if (selectedRegion && REGIONS.includes(selectedRegion)) pq = pq.eq('region_nm', selectedRegion);
  const { data: profiles } = await pq.limit(1000);
  const allProfiles: any[] = profiles || [];

  // 연차별 통계 (현재 필터 기준)
  const localAgeStats = new Map<string, { cnt: number; totalPrice: number }>();
  AGE_GROUPS.forEach(g => localAgeStats.set(g, { cnt: 0, totalPrice: 0 }));
  for (const p of allProfiles) {
    if (p.age_group && p.latest_sale_price > 0) {
      const s = localAgeStats.get(p.age_group);
      if (s) { s.cnt++; s.totalPrice += Number(p.latest_sale_price); }
    }
  }
  const ageChartData = AGE_GROUPS.map(g => {
    const s = localAgeStats.get(g)!;
    const dbRow = ageMap.get(g);
    return {
      group: g,
      avg: selectedRegion ? (s.cnt > 0 ? Math.round(s.totalPrice / s.cnt) : 0) : (dbRow?.avg_sale_price || 0),
      count: selectedRegion ? s.cnt : (dbRow?.profile_count || 0),
    };
  });

  const topComplexes = allProfiles.slice(0, 100).map((p: any) => ({
    aptName: p.apt_name, sigungu: p.sigungu, region: p.region_nm, dong: p.dong || '',
    builtYear: p.built_year || 0, saleCount: p.sale_count_1y || 0, rentCount: p.rent_count_1y || 0,
    lastPrice: p.latest_sale_price || 0, jeonse: p.latest_jeonse_price || 0,
    monthly: p.latest_monthly_deposit || 0, monthlyRent: p.latest_monthly_rent || 0,
    ageGroup: p.age_group || '', jeonseRatio: p.jeonse_ratio || null,
    pyeongPrice: p.avg_sale_price_pyeong || 0, hasCoords: !!(p.latitude && p.longitude),
    imageUrl: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0]?.thumbnail || p.images[0]?.url || null) : null,
  }));

  const displayCount = selectedRegion ? regionData.find(r => r.region === selectedRegion)?.count || allProfiles.length : totalProfiles;

  // KPI 집계
  const avgSale = allProfiles.length ? Math.round(allProfiles.filter(p => p.latest_sale_price > 0).reduce((s: number, p: any) => s + Number(p.latest_sale_price), 0) / allProfiles.filter(p => p.latest_sale_price > 0).length) : 0;
  const avgRatio = allProfiles.length ? Math.round(allProfiles.filter(p => p.jeonse_ratio > 0).reduce((s: number, p: any) => s + Number(p.jeonse_ratio), 0) / (allProfiles.filter(p => p.jeonse_ratio > 0).length || 1)) : 0;
  const totalTrades = allProfiles.reduce((s: number, p: any) => s + (p.sale_count_1y || 0) + (p.rent_count_1y || 0), 0);
  const ratioColor = avgRatio > 80 ? '#ef4444' : avgRatio > 60 ? '#f59e0b' : '#22c55e';

  // 도넛 데이터 (연차 비율)
  const ageDonut = ageChartData.filter(a => a.count > 0);
  const donutTotal = ageDonut.reduce((s, a) => s + a.count, 0);

  return (
    <article style={{ maxWidth: 960, margin: '0 auto', padding: '0 14px 80px' }}>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: selectedRegion ? `${selectedRegion} 단지백과` : '단지백과',
        description: `${selectedRegion || '전국'} ${displayCount.toLocaleString()}개 아파트 연차별 비교`,
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
      {/* FAQPage — 포털 노출 면적 2~3배 확대 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: '단지백과란 무엇인가요?', acceptedAnswer: { '@type': 'Answer', text: '단지백과는 전국 34,000여 아파트를 입주 연차별로 비교할 수 있는 카더라의 부동산 데이터 서비스입니다. 매매·전세·월세 실거래가, 전세가율, 평당가를 한눈에 확인할 수 있습니다.' } },
          { '@type': 'Question', name: '단지백과에서 어떤 정보를 확인할 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: '단지별 매매 실거래가, 전세가, 월세, 평당가, 전세가율, 거래량 등을 확인할 수 있습니다. 연차별(신축~30년+) 필터링과 지역별 비교도 가능합니다.' } },
          { '@type': 'Question', name: '어떤 지역의 아파트가 포함되어 있나요?', acceptedAnswer: { '@type': 'Answer', text: `서울, 경기, 부산, 대구, 인천, 광주, 대전, 울산, 세종 등 전국 ${displayCount.toLocaleString()}개 단지가 포함되어 있으며 매일 업데이트됩니다.` } },
        ],
      })}} />
      {/* speakable — 네이버 음성검색 + 스마트 스니펫 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'WebPage',
        name: selectedRegion ? `${selectedRegion} 단지백과` : '단지백과',
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.kpi-card'] },
      })}} />

      {/* ═══ 그라데이션 히어로 ═══ */}
      <div style={{
        borderRadius: 'var(--radius-lg)', padding: '18px 18px 14px', marginBottom: 14, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0F1B3E 0%, rgba(59,123,246,0.3) 100%)',
        border: '1px solid rgba(59,123,246,0.15)',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(59,123,246,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(59,123,246,0.05)' }} />
        <nav style={{ fontSize: 10, color: 'rgba(232,237,245,0.4)', marginBottom: 6, display: 'flex', gap: 'var(--sp-xs)', position: 'relative', flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>홈</Link><span>›</span>
          <Link href="/apt" style={{ color: 'inherit', textDecoration: 'none' }}>부동산</Link><span>›</span>
          {selectedRegion ? (<><Link href="/apt/complex" style={{ color: 'inherit', textDecoration: 'none' }}>단지백과</Link><span>›</span><span style={{ color: 'rgba(232,237,245,0.9)' }}>{selectedRegion}</span></>) : (<span style={{ color: 'rgba(232,237,245,0.9)' }}>단지백과</span>)}
        </nav>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', position: 'relative' }}>
          <h1 style={{ position:"absolute", width:1, height:1, overflow:"hidden", clip:"rect(0,0,0,0)" }}>
            🏢 {selectedRegion ? `${selectedRegion} 단지백과` : '단지백과'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
            {selectedRegion && (
              <Link href="/apt/complex" style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand)', textDecoration: 'none', background: 'rgba(59,123,246,0.15)', padding: '3px 10px', borderRadius: 'var(--radius-sm)' }}>✕ 전체</Link>
            )}
            <span style={{ fontSize: 12, color: 'rgba(232,237,245,0.6)', fontWeight: 600 }}>{displayCount.toLocaleString()}개</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-sm)', position: 'relative' }}>
          <ShareButtons title={`${selectedRegion || '전국'} 단지백과 — ${displayCount.toLocaleString()}개 아파트 비교`} contentType="page" contentRef="apt-complex" />
        </div>
      </div>

      {/* ═══ KPI 3열 ═══ */}
      <div className="kd-grid-3" style={{ gap: 6, marginBottom: 14 }}>
        {[
          { label: '평균 매매가', value: fmtAmount(avgSale), icon: '💰' },
          { label: '평균 전세가율', value: `${avgRatio}%`, icon: '📊', color: ratioColor },
          { label: '총 거래', value: totalTrades.toLocaleString() + '건', icon: '📈' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'linear-gradient(135deg, var(--bg-surface), var(--bg-hover))',
            borderRadius: 'var(--radius-md)', padding: '10px 8px', textAlign: 'center',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 14, marginBottom: 2 }}>{k.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: k.color || 'var(--text-primary)' }}>{k.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ═══ 지역별 현황 — 도넛 + 타일 (부동산 메인 스타일) ═══ */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>지역별 현황</div>

        {/* 도넛 + 범례 */}
        <div style={{
          display: 'flex', gap: 'var(--sp-md)', alignItems: 'center', flexWrap: 'wrap',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-card)', padding: '10px 12px', marginBottom: 6, overflow: 'hidden',
        }}>
          {/* 도넛 SVG — 연차별 분포 */}
          <svg width={100} height={100} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
            <circle cx={50} cy={50} r={38} fill="none" stroke="var(--border)" strokeWidth={14} opacity={0.4} />
            {(() => {
              const R = 38, CIRC = 2 * Math.PI * R;
              const ageColors: Record<string, string> = { '신축': '#3B7BF6', '5년차': '#22d3ee', '10년차': '#8b5cf6', '15년차': '#f59e0b', '20년차': '#f97316', '25년차': '#ef4444', '30년+': '#dc2626' };
              let offset = 0;
              return ageDonut.map(a => {
                const len = donutTotal > 0 ? (a.count / donutTotal) * CIRC : 0;
                const arc = <circle key={a.group} cx={50} cy={50} r={R} fill="none" stroke={ageColors[a.group] || '#666'} strokeWidth={14} strokeDasharray={`${len} ${CIRC - len}`} strokeDashoffset={-offset} transform="rotate(-90 50 50)" />;
                offset += len;
                return arc;
              });
            })()}
            <text x={50} y={46} textAnchor="middle" style={{ fontSize: 10, fontWeight: 600, fill: 'var(--text-secondary)' }}>{selectedRegion || '전체'}</text>
            <text x={50} y={60} textAnchor="middle" style={{ fontSize: 13, fontWeight: 800, fill: 'var(--text-primary)' }}>{displayCount.toLocaleString()}</text>
          </svg>

          {/* 연차 범례 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 80 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 1 }}>연차별 분포 · 총 {donutTotal.toLocaleString()}개</div>
            {(() => {
              const ageColors: Record<string, string> = { '신축': '#3B7BF6', '5년차': '#22d3ee', '10년차': '#8b5cf6', '15년차': '#f59e0b', '20년차': '#f97316', '25년차': '#ef4444', '30년+': '#dc2626' };
              return ageDonut.map(a => (
                <div key={a.group} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: ageColors[a.group], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.group}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                    {a.count.toLocaleString()}<span style={{ fontSize: 10, fontWeight: 400, opacity: 0.5, marginLeft: 1 }}>개</span>
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* 지역 타일 그리드 — /apt 스타일 미니 바 */}
        <div className="grid grid-cols-3 md:grid-cols-5" style={{ gap: 6 }}>
          {regionData.map(r => {
            const isActive = selectedRegion === r.region;
            const maxCount = Math.max(...regionData.map(x => x.count));
            const pct = maxCount > 0 ? (r.count / maxCount) * 100 : 0;
            return (
              <Link key={r.region} href={isActive ? '/apt/complex' : `/apt/complex?region=${encodeURIComponent(r.region)}`} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)',
                padding: '6px 8px', textDecoration: 'none',
                background: isActive ? 'rgba(59,123,246,0.06)' : 'var(--bg-surface)',
                border: isActive ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                borderRadius: 7, width: '100%',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--sp-xs)' }}>
                    <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? 'var(--brand)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{r.region}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? 'var(--brand)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{r.count.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', width: '100%', height: 3, borderRadius: 4, overflow: 'hidden', marginTop: 2, background: 'var(--bg-hover)' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: isActive ? 'linear-gradient(90deg, var(--brand), rgba(59,123,246,0.7))' : 'linear-gradient(90deg, rgba(59,123,246,0.5), rgba(59,123,246,0.2))', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ═══ 클라이언트 필터 + 카드 그리드 ═══ */}
      <ComplexClient
        complexes={topComplexes}
        ageGroups={AGE_GROUPS}
        regions={regionData.map(r => r.region)}
        initialRegion={selectedRegion || null}
        ageChartData={ageChartData}
      />

      {/* SEO 허브 링크 — 크롤 심도 + 롱테일 키워드 */}
      <div style={{ marginTop: 20 }}>
        <section style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>테마별 분석</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              { s: 'price-up', l: '📈 가격 상승' }, { s: 'price-down', l: '📉 가격 하락' },
              { s: 'low-jeonse-ratio', l: '🛡️ 전세가율↓' }, { s: 'high-jeonse-ratio', l: '⚠️ 전세가율↑' },
              { s: 'new-built', l: '🏗️ 신축' }, { s: 'high-trade', l: '🔥 거래활발' },
            ].map(t => (
              <Link key={t.s} href={`/apt/theme/${t.s}${selectedRegion ? `?region=${encodeURIComponent(selectedRegion)}` : ''}`} style={{ padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>{t.l}</Link>
            ))}
          </div>
        </section>
        <section style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>지역별 시세</h2>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {REGIONS.map(r => (
              <Link key={r} href={`/apt/region/${encodeURIComponent(r)}`} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 11, textDecoration: 'none', fontWeight: 600, background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{r}</Link>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

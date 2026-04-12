import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fmtAmount } from '@/lib/format';
import ShareButtons from '@/components/ShareButtons';
import { cache } from 'react';

export const revalidate = 3600;
export const maxDuration = 30;

interface Props { params: Promise<{ region: string; sigungu: string }> }

const GEO: Record<string, { code: string; lat: string; lng: string }> = {
  '서울': { code: 'KR-11', lat: '37.5665', lng: '126.9780' }, '부산': { code: 'KR-26', lat: '35.1796', lng: '129.0756' },
  '대구': { code: 'KR-27', lat: '35.8714', lng: '128.6014' }, '인천': { code: 'KR-28', lat: '37.4563', lng: '126.7052' },
  '광주': { code: 'KR-29', lat: '35.1595', lng: '126.8526' }, '대전': { code: 'KR-30', lat: '36.3504', lng: '127.3845' },
  '울산': { code: 'KR-31', lat: '35.5384', lng: '129.3114' }, '세종': { code: 'KR-36', lat: '36.4800', lng: '127.2600' },
  '경기': { code: 'KR-41', lat: '37.4138', lng: '127.5183' }, '강원': { code: 'KR-42', lat: '37.8228', lng: '128.1555' },
  '충북': { code: 'KR-43', lat: '36.6357', lng: '127.4917' }, '충남': { code: 'KR-44', lat: '36.5184', lng: '126.8000' },
  '전북': { code: 'KR-45', lat: '35.8203', lng: '127.1088' }, '전남': { code: 'KR-46', lat: '34.8161', lng: '126.4629' },
  '경북': { code: 'KR-47', lat: '36.4919', lng: '128.8889' }, '경남': { code: 'KR-48', lat: '35.4606', lng: '128.2132' },
  '제주': { code: 'KR-50', lat: '33.4996', lng: '126.5312' },
};

const fetchData = cache(async (region: string, sigungu: string) => {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('apt_complex_profiles')
    .select('apt_name, dong, age_group, latest_sale_price, latest_jeonse_price, jeonse_ratio, sale_count_1y, rent_count_1y, built_year, avg_sale_price_pyeong, latitude, longitude, total_households, price_change_1y')
    .eq('region_nm', region).eq('sigungu', sigungu)
    .not('age_group', 'is', null)
    .order('sale_count_1y', { ascending: false }).limit(2000);
  return data || [];
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: rr, sigungu: rs } = await params;
  const region = decodeURIComponent(rr), sigungu = decodeURIComponent(rs);
  const profiles = await fetchData(region, sigungu);
  if (profiles.length < 10) return { title: `${sigungu} 아파트`, robots: { index: false, follow: true } };

  const wp = profiles.filter((p: any) => p.latest_sale_price > 0);
  const avg = wp.length > 0 ? Math.round(wp.reduce((s: number, p: any) => s + p.latest_sale_price, 0) / wp.length) : 0;
  const totalTrades = profiles.reduce((s: number, p: any) => s + (p.sale_count_1y || 0), 0);
  const title = `${sigungu} 아파트 실거래가·시세 2026 | ${profiles.length}개 단지 비교`;
  const desc = `${region} ${sigungu} ${profiles.length}개 아파트 단지 실거래가·전세·월세 비교. 평균 매매가 ${fmtAmount(avg)}, 최근 1년 거래 ${totalTrades.toLocaleString()}건. 연차별·가격대별 시세를 카더라에서 확인하세요.`;
  const geo = GEO[region];
  const avgLat = profiles.filter((p: any) => p.latitude).length > 0 ? profiles.filter((p: any) => p.latitude).reduce((s: number, p: any) => s + Number(p.latitude), 0) / profiles.filter((p: any) => p.latitude).length : Number(geo?.lat || 0);
  const avgLng = profiles.filter((p: any) => p.longitude).length > 0 ? profiles.filter((p: any) => p.longitude).reduce((s: number, p: any) => s + Number(p.longitude), 0) / profiles.filter((p: any) => p.longitude).length : Number(geo?.lng || 0);

  return {
    title, description: desc,
    alternates: { canonical: `${SITE_URL}/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}` },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: { title: `${sigungu} 아파트 시세 종합`, description: desc, url: `${SITE_URL}/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}`, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(sigungu + ' 아파트 시세')}&design=2&subtitle=${encodeURIComponent(`${profiles.length}개 단지 · 평균 ${fmtAmount(avg)}`)}&author=${encodeURIComponent('카더라')}`, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: `${sigungu} 아파트 시세`, description: desc },
    other: {
      'naver:author': '카더라', 'naver:site_name': '카더라', 'naver:updated_time': new Date().toISOString(), 'og:updated_time': new Date().toISOString(),
      'article:section': '부동산', 'article:tag': `${sigungu},${region},아파트,실거래가,시세,전세,월세`,
      'article:modified_time': new Date().toISOString(), 'dg:plink': `${SITE_URL}/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}`,
      ...(geo ? { 'geo.region': geo.code, 'geo.placename': `${region} ${sigungu}`, 'geo.position': `${avgLat};${avgLng}`, 'ICBM': `${avgLat}, ${avgLng}` } : {}),
    },
  };
}

export default async function SigunguHubPage({ params }: Props) {
  const { region: rr, sigungu: rs } = await params;
  const region = decodeURIComponent(rr), sigungu = decodeURIComponent(rs);
  const profiles = await fetchData(region, sigungu);
  if (profiles.length < 10) return notFound();

  const wp = profiles.filter((p: any) => p.latest_sale_price > 0);
  const avg = wp.length > 0 ? Math.round(wp.reduce((s: number, p: any) => s + p.latest_sale_price, 0) / wp.length) : 0;
  const wj = profiles.filter((p: any) => p.jeonse_ratio > 0);
  const avgJR = wj.length > 0 ? Math.round(wj.reduce((s: number, p: any) => s + Number(p.jeonse_ratio), 0) / wj.length * 10) / 10 : 0;
  const totalTrades = profiles.reduce((s: number, p: any) => s + (p.sale_count_1y || 0), 0);
  const totalRents = profiles.reduce((s: number, p: any) => s + (p.rent_count_1y || 0), 0);

  // 연차별
  const ageMap = new Map<string, { count: number; prices: number[] }>();
  for (const p of profiles) { const ag = p.age_group || '기타'; const e = ageMap.get(ag) || { count: 0, prices: [] }; e.count++; if (p.latest_sale_price > 0) e.prices.push(p.latest_sale_price); ageMap.set(ag, e); }
  const ageOrder = ['신축', '5년차', '10년차', '15년차', '20년차', '25년차', '30년+'];
  const ageStats = Array.from(ageMap.entries()).map(([g, d]) => ({ group: g, count: d.count, avgPrice: d.prices.length > 0 ? Math.round(d.prices.reduce((a, b) => a + b, 0) / d.prices.length) : 0 })).sort((a, b) => ageOrder.indexOf(a.group) - ageOrder.indexOf(b.group));

  // 동별
  const dongMap = new Map<string, number>();
  for (const p of profiles) { if (p.dong) dongMap.set(p.dong, (dongMap.get(p.dong) || 0) + 1); }
  const dongStats = Array.from(dongMap.entries()).map(([dong, count]) => ({ dong, count })).filter(d => d.count >= 3).sort((a, b) => b.count - a.count);

  const priceTop = wp.sort((a: any, b: any) => b.latest_sale_price - a.latest_sale_price).slice(0, 10);
  const tradeTop = profiles.filter((p: any) => p.sale_count_1y > 0).sort((a: any, b: any) => b.sale_count_1y - a.sale_count_1y).slice(0, 10);
  const maxP = priceTop[0]; const minP = wp.length > 0 ? [...wp].sort((a: any, b: any) => a.latest_sale_price - b.latest_sale_price)[0] : null;
  const newBuilt = profiles.filter((p: any) => p.age_group === '신축').length;
  const oldBuilt = profiles.filter((p: any) => p.age_group === '30년+').length;
  const canon = `${SITE_URL}/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}`;

  const faq = [
    { q: `${sigungu} 아파트 평균 매매가는?`, a: `${sigungu}의 아파트 평균 매매가는 ${fmtAmount(avg)}이며, 최고가 단지는 ${maxP?.apt_name || '정보 없음'}(${maxP ? fmtAmount(maxP.latest_sale_price) : ''})입니다.` },
    { q: `${sigungu} 아파트 전세가율은?`, a: `${sigungu}의 평균 전세가율은 ${avgJR}%입니다.` },
    { q: `${sigungu}에 아파트가 몇 개 있나요?`, a: `총 ${profiles.length.toLocaleString()}개 단지, 시세 보유 ${wp.length.toLocaleString()}개 단지입니다.` },
    { q: `${sigungu} 최근 거래량은?`, a: `최근 1년 매매 ${totalTrades.toLocaleString()}건, 전월세 ${totalRents.toLocaleString()}건입니다.` },
    { q: `${sigungu} 신축 아파트는?`, a: `신축(5년 이내) ${newBuilt}개 단지.${ageStats.find(a => a.group === '신축')?.avgPrice ? ` 평균 ${fmtAmount(ageStats.find(a => a.group === '신축')?.avgPrice || 0)}.` : ''}` },
    { q: `${sigungu}에서 가장 비싼 아파트는?`, a: maxP ? `${maxP.apt_name} — ${fmtAmount(maxP.latest_sale_price)}` : '정보 없음' },
    { q: `${sigungu}에서 가장 저렴한 아파트는?`, a: minP ? `${minP.apt_name} — ${fmtAmount(minP.latest_sale_price)}` : '정보 없음' },
    { q: `${sigungu} 연차별 분포는?`, a: `${ageStats.map(a => `${a.group} ${a.count}개`).join(', ')}.${oldBuilt > 0 ? ` 30년+ 노후 단지 ${oldBuilt}개.` : ''}` },
  ];

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` }, { '@type': 'ListItem', position: 3, name: region, item: `${SITE_URL}/apt/region/${encodeURIComponent(region)}` }, { '@type': 'ListItem', position: 4, name: sigungu }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Dataset', name: `${sigungu} 아파트 실거래가 데이터`, description: `${region} ${sigungu} ${profiles.length}개 단지 실거래 데이터`, url: canon, keywords: [sigungu, region, '실거래가', '아파트 시세'], creator: { '@type': 'Organization', name: '카더라', url: SITE_URL }, dateModified: new Date().toISOString(), spatialCoverage: { '@type': 'Place', name: `${region} ${sigungu}` } }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: `${sigungu} 아파트 실거래가·시세 종합 분석`, url: canon, dateModified: new Date().toISOString(), author: { '@type': 'Organization', name: '카더라', url: SITE_URL }, publisher: { '@type': 'Organization', name: '카더라', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-192.png` } }, image: `${SITE_URL}/api/og?title=${encodeURIComponent(sigungu)}&design=2&category=apt`, speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.area-summary'] } }) }} />

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)', flexWrap: 'wrap' }}>
        <Link href="/apt" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>부동산</Link><span>›</span>
        <Link href={`/apt/region/${encodeURIComponent(region)}`} style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>{region}</Link><span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sigungu}</span>
      </nav>

      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1.3 }}>{sigungu} 아파트 실거래가·시세<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 8 }}>{profiles.length.toLocaleString()}개 단지</span></h1>
      <ShareButtons title={`${sigungu} 아파트 시세`} />

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
        {[{ l: '평균 매매가', v: fmtAmount(avg), s: `${wp.length}개 단지` }, { l: '평균 전세가율', v: avgJR > 0 ? `${avgJR}%` : '-', s: `${wj.length}개 단지` }, { l: '1년 매매', v: `${totalTrades.toLocaleString()}건`, s: '거래량' }, { l: '1년 전월세', v: `${totalRents.toLocaleString()}건`, s: '거래량' }].map((k, i) => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>{k.l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{k.v}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{k.s}</div>
          </div>
        ))}
      </div>

      {/* 고유 분석 문단 */}
      <section className="area-summary" style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
        <p style={{ margin: 0 }}>
          {region} {sigungu}에는 총 <strong>{profiles.length.toLocaleString()}</strong>개 아파트 단지가 있으며, 이 중 <strong>{wp.length.toLocaleString()}</strong>개 단지에서 최근 실거래가 확인됩니다. 평균 매매가는 <strong>{fmtAmount(avg)}</strong>이며, 전세가율은 평균 <strong>{avgJR}%</strong> 수준입니다.
          {maxP && ` 최고가 단지는 ${maxP.apt_name}(${fmtAmount(maxP.latest_sale_price)})이며,`}
          {minP && ` 최저가 단지는 ${minP.apt_name}(${fmtAmount(minP.latest_sale_price)})입니다.`}
          {newBuilt > 0 && ` 신축 단지는 ${newBuilt}개(${Math.round(newBuilt / profiles.length * 100)}%).`}
          {oldBuilt > 0 && ` 30년+ 노후 단지 ${oldBuilt}개.`}
          {` 최근 1년 매매 ${totalTrades.toLocaleString()}건, 전월세 ${totalRents.toLocaleString()}건. 데이터 출처: 국토교통부 실거래가 공개시스템.`}
        </p>
      </section>

      {/* 연차별 */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>연차별 분포</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
          {ageStats.map(a => (<div key={a.group} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center' }}><div style={{ fontSize: 12, fontWeight: 700 }}>{a.group}</div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-blue)' }}>{a.count}</div><div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{a.avgPrice > 0 ? fmtAmount(a.avgPrice) : '-'}</div></div>))}
        </div>
      </section>

      {/* 동별 */}
      {dongStats.length > 0 && (<section style={{ marginBottom: 20 }}><h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>{sigungu} 행정동별 아파트</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>{dongStats.slice(0, 15).map(d => (<Link key={d.dong} href={`/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}/${encodeURIComponent(d.dong)}`} style={{ display: 'block', padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: 12 }}><div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.dong}</div><div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{d.count}개 단지</div></Link>))}</div></section>)}

      {/* 매매가 TOP 10 */}
      {priceTop.length > 0 && (<section style={{ marginBottom: 20 }}><h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>매매가 TOP 10</h2><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{priceTop.map((p: any, i: number) => (<Link key={i} href={`/apt/complex/${encodeURIComponent(p.apt_name)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? 'var(--accent-blue)' : 'var(--text-tertiary)', width: 20 }}>{i + 1}</span><div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.apt_name}</div><div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.dong || ''} {p.built_year ? `${p.built_year}년` : ''}</div></div></div><div style={{ textAlign: 'right' }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtAmount(p.latest_sale_price)}</div>{p.jeonse_ratio > 0 && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>전세가율 {p.jeonse_ratio}%</div>}</div></Link>))}</div></section>)}

      {/* 거래량 TOP 10 */}
      {tradeTop.length > 0 && (<section style={{ marginBottom: 20 }}><h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>거래 활발 단지 TOP 10</h2><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{tradeTop.map((p: any, i: number) => (<Link key={i} href={`/apt/complex/${encodeURIComponent(p.apt_name)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? 'var(--accent-blue)' : 'var(--text-tertiary)', width: 20 }}>{i + 1}</span><div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.apt_name}</div><div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.dong || ''} {p.latest_sale_price ? fmtAmount(p.latest_sale_price) : ''}</div></div></div><div style={{ textAlign: 'right' }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-blue)' }}>{p.sale_count_1y}건</div><div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>매매 거래</div></div></Link>))}</div></section>)}

      {/* FAQ */}
      <section style={{ marginBottom: 20 }}><h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>{sigungu} 자주 묻는 질문</h2><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{faq.map((f, i) => (<details key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}><summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>{f.q}</summary><p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>{f.a}</p></details>))}</div></section>

      {/* 관련 링크 */}
      <section style={{ marginBottom: 20 }}><h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>{region} 다른 지역</h2><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Link href={`/apt/region/${encodeURIComponent(region)}`} style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none', fontSize: 12, color: 'var(--text-secondary)' }}>{region} 전체</Link></div></section>

      {/* 테마 분석 내부 링크 */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>테마별 분석</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {[
            { slug: 'price-up', label: '가격 상승 아파트' },
            { slug: 'price-down', label: '가격 하락 아파트' },
            { slug: 'low-jeonse-ratio', label: '전세가율 낮은 아파트' },
            { slug: 'new-built', label: '신축 아파트' },
            { slug: 'high-trade', label: '거래 활발 단지' },
            { slug: 'high-jeonse-ratio', label: '전세가율 높은 단지' },
          ].map(t => (
            <Link key={t.slug} href={`/apt/theme/${t.slug}?region=${encodeURIComponent(region)}`} style={{ padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t.label}</Link>
          ))}
        </div>
      </section>

      {/* 인기 비교 — 상위 단지 조합 */}
      {priceTop.length >= 2 && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>⚖️ 인기 비교</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {priceTop.slice(0, 3).flatMap((a: any, i: number) => priceTop.slice(i + 1, i + 2).map((b: any) => (
              <Link key={`${a.apt_name}-${b.apt_name}`} href={`/apt/compare/${encodeURIComponent(a.apt_name)}-vs-${encodeURIComponent(b.apt_name)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: 12 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.apt_name} <span style={{ color: 'var(--text-tertiary)' }}>vs</span> {b.apt_name}</span>
                <span style={{ color: 'var(--accent-blue)', fontSize: 11 }}>비교 →</span>
              </Link>
            )))}
          </div>
        </section>
      )}

      <Link href={`/apt/complex?region=${encodeURIComponent(region)}`} style={{ display: 'block', textAlign: 'center', padding: '14px', marginBottom: 40, borderRadius: 'var(--radius-lg)', fontWeight: 800, textDecoration: 'none', fontSize: 13, background: 'linear-gradient(135deg, #0F1B3E 0%, #2563EB 100%)', color: '#fff' }}>📊 {region} 전체 단지백과 보기 →</Link>
      <footer style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', paddingBottom: 40, lineHeight: 1.5 }}>데이터 출처: 국토교통부 실거래가 공개시스템 · 한국부동산원 · 카더라 자체 분석<br />본 페이지는 공공데이터 기반이며, 투자 판단의 근거로 사용할 수 없습니다.</footer>
    </article>
  );
}

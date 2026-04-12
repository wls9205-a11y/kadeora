import { cache } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fmtAmount } from '@/lib/format';

export const revalidate = 3600;
export const maxDuration = 30;
const MIN_COMPLEXES = 5;

interface Props { params: Promise<{ region: string; sigungu: string; dong: string }> }

const fetchData = cache(async (region: string, sigungu: string, dong: string) => {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('apt_complex_profiles')
    .select('apt_name, age_group, latest_sale_price, latest_jeonse_price, jeonse_ratio, sale_count_1y, rent_count_1y, built_year, avg_sale_price_pyeong, latitude, longitude, price_change_1y')
    .eq('region_nm', region).eq('sigungu', sigungu).eq('dong', dong)
    .not('age_group', 'is', null).order('sale_count_1y', { ascending: false }).limit(500);
  return data || [];
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: r, sigungu: s, dong: d } = await params;
  const [region, sigungu, dong] = [r, s, d].map(decodeURIComponent);
  const profiles = await fetchData(region, sigungu, dong);
  if (profiles.length < MIN_COMPLEXES) return { title: `${dong} 아파트`, robots: { index: false, follow: true } };

  const wp = profiles.filter((p: any) => p.latest_sale_price > 0);
  const avg = wp.length > 0 ? Math.round(wp.reduce((s: number, p: any) => s + p.latest_sale_price, 0) / wp.length) : 0;
  const title = `${dong} 아파트 실거래가 | ${sigungu} ${profiles.length}개 단지`;
  const desc = `${region} ${sigungu} ${dong} ${profiles.length}개 아파트 실거래가·전세·월세 비교. 평균 매매가 ${fmtAmount(avg)}. 카더라에서 확인하세요.`;
  return {
    title, description: desc,
    alternates: { canonical: `${SITE_URL}/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}/${encodeURIComponent(dong)}` },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: { title: `${dong} 아파트 시세`, description: desc, url: `${SITE_URL}/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}/${encodeURIComponent(dong)}`, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(dong + ' 아파트')}&design=2&subtitle=${encodeURIComponent(sigungu + ' · ' + profiles.length + '개 단지')}`, width: 1200, height: 630 }] },
    other: { 'naver:author': '카더라', 'naver:updated_time': new Date().toISOString(), 'og:updated_time': new Date().toISOString(), 'article:section': '부동산', 'article:tag': `${dong},${sigungu},${region},아파트,실거래가`, 'dg:plink': `${SITE_URL}/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}/${encodeURIComponent(dong)}` },
  };
}

export default async function DongHubPage({ params }: Props) {
  const { region: r, sigungu: s, dong: d } = await params;
  const [region, sigungu, dong] = [r, s, d].map(decodeURIComponent);
  const profiles = await fetchData(region, sigungu, dong);
  if (profiles.length < MIN_COMPLEXES) return notFound();

  const wp = profiles.filter((p: any) => p.latest_sale_price > 0);
  const avg = wp.length > 0 ? Math.round(wp.reduce((s: number, p: any) => s + p.latest_sale_price, 0) / wp.length) : 0;
  const wj = profiles.filter((p: any) => p.jeonse_ratio > 0);
  const avgJR = wj.length > 0 ? Math.round(wj.reduce((s: number, p: any) => s + Number(p.jeonse_ratio), 0) / wj.length * 10) / 10 : 0;
  const totalTrades = profiles.reduce((s: number, p: any) => s + (p.sale_count_1y || 0), 0);

  const faq = [
    { q: `${dong} 아파트 평균 시세는?`, a: `${dong} 평균 매매가 ${fmtAmount(avg)}, 총 ${profiles.length}개 단지.` },
    { q: `${dong} 전세가율은?`, a: `평균 전세가율 ${avgJR}%.` },
    { q: `${dong} 거래량은?`, a: `최근 1년 매매 ${totalTrades}건.` },
  ];

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` }, { '@type': 'ListItem', position: 3, name: region, item: `${SITE_URL}/apt/region/${encodeURIComponent(region)}` }, { '@type': 'ListItem', position: 4, name: sigungu, item: `${SITE_URL}/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}` }, { '@type': 'ListItem', position: 5, name: dong }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }) }} />

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)', flexWrap: 'wrap' }}>
        <Link href="/apt" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>부동산</Link><span>›</span>
        <Link href={`/apt/region/${encodeURIComponent(region)}`} style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>{region}</Link><span>›</span>
        <Link href={`/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}`} style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>{sigungu}</Link><span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{dong}</span>
      </nav>

      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>{dong} 아파트 실거래가<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 8 }}>{profiles.length}개 단지</span></h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {[{ l: '평균 매매가', v: fmtAmount(avg) }, { l: '전세가율', v: avgJR > 0 ? `${avgJR}%` : '-' }, { l: '1년 거래', v: `${totalTrades}건` }].map((k, i) => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, textAlign: 'center' }}><div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{k.l}</div><div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{k.v}</div></div>
        ))}
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 16, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        {region} {sigungu} {dong}에는 <strong>{profiles.length}개</strong> 아파트가 있습니다. 평균 매매가 <strong>{fmtAmount(avg)}</strong>{avgJR > 0 && `, 전세가율 ${avgJR}%`}.
        {wp.length > 0 && ` 최고가 ${wp.sort((a: any, b: any) => b.latest_sale_price - a.latest_sale_price)[0].apt_name}(${fmtAmount(wp[0].latest_sale_price)}).`}
        {` 출처: 국토교통부 실거래가 공개시스템.`}
      </p>

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>{dong} 아파트 단지</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {profiles.map((p: any, i: number) => (
            <Link key={i} href={`/apt/complex/${encodeURIComponent(p.apt_name)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.apt_name}</div><div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.built_year ? `${p.built_year}년` : ''} · {p.age_group || ''}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{p.latest_sale_price > 0 ? fmtAmount(p.latest_sale_price) : '-'}</div>{p.jeonse_ratio > 0 && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>전세가율 {p.jeonse_ratio}%</div>}</div>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 20 }}><h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>자주 묻는 질문</h2>{faq.map((f, i) => (<details key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 6 }}><summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>{f.q}</summary><p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{f.a}</p></details>))}</section>

      <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
        <Link href={`/apt/area/${encodeURIComponent(region)}/${encodeURIComponent(sigungu)}`} style={{ flex: 1, display: 'block', textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', textDecoration: 'none', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>← {sigungu} 전체</Link>
        <Link href={`/apt/complex?region=${encodeURIComponent(region)}`} style={{ flex: 1, display: 'block', textAlign: 'center', padding: 12, borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #0F1B3E 0%, #2563EB 100%)', textDecoration: 'none', fontSize: 12, fontWeight: 700, color: '#fff' }}>📊 단지백과</Link>
      </div>
      <footer style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', paddingBottom: 40 }}>데이터 출처: 국토교통부 실거래가 공개시스템 · 카더라</footer>
    </article>
  );
}

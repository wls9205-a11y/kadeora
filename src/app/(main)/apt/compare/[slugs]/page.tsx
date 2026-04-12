import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fmtAmount } from '@/lib/format';

export const revalidate = 3600;
export const maxDuration = 30;

interface Props { params: Promise<{ slugs: string }> }

function parseSlugs(raw: string): [string, string] | null {
  const decoded = decodeURIComponent(raw);
  // "래미안원베일리-vs-래미안퍼스티지" 형태
  const parts = decoded.split('-vs-');
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) return null;
  return [parts[0].trim(), parts[1].trim()];
}

async function fetchComplex(name: string) {
  const sb = getSupabaseAdmin();
  const { data } = await (sb as any).from('apt_complex_profiles')
    .select('apt_name, region_nm, sigungu, dong, age_group, latest_sale_price, latest_jeonse_price, jeonse_ratio, sale_count_1y, rent_count_1y, built_year, avg_sale_price_pyeong, total_households, price_change_1y, latitude, longitude')
    .eq('apt_name', name).limit(1).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slugs } = await params;
  const names = parseSlugs(slugs);
  if (!names) return { title: '단지 비교', robots: { index: false, follow: true } };
  const [a, b] = await Promise.all([fetchComplex(names[0]), fetchComplex(names[1])]);
  if (!a || !b) return { title: '단지 비교', robots: { index: false, follow: true } };

  // 안티스팸: 두 단지 모두 시세 있어야 인덱싱
  if (!a.latest_sale_price && !b.latest_sale_price) return { title: `${names[0]} vs ${names[1]}`, robots: { index: false, follow: true } };

  const title = `${a.apt_name} vs ${b.apt_name} 비교 | 실거래가·전세·시세`;
  const desc = `${a.apt_name}(${a.latest_sale_price ? fmtAmount(a.latest_sale_price) : '시세미상'}) vs ${b.apt_name}(${b.latest_sale_price ? fmtAmount(b.latest_sale_price) : '시세미상'}) 아파트 비교. 매매가, 전세가, 전세가율, 연차, 거래량을 한눈에 비교하세요.`;

  return {
    title, description: desc,
    alternates: { canonical: `${SITE_URL}/apt/compare/${encodeURIComponent(slugs)}` },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: { title, description: desc, url: `${SITE_URL}/apt/compare/${encodeURIComponent(slugs)}`, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(`${a.apt_name} vs ${b.apt_name}`)}&design=2&subtitle=${encodeURIComponent('아파트 비교 분석')}&author=${encodeURIComponent('카더라')}`, width: 1200, height: 630 }] },
    other: { 'naver:author': '카더라', 'naver:updated_time': new Date().toISOString(), 'article:section': '부동산', 'article:tag': `${a.apt_name},${b.apt_name},비교,실거래가,아파트`, 'dg:plink': `${SITE_URL}/apt/compare/${encodeURIComponent(slugs)}` },
  };
}

export default async function ComparePage({ params }: Props) {
  const { slugs } = await params;
  const names = parseSlugs(slugs);
  if (!names) return notFound();
  const [a, b] = await Promise.all([fetchComplex(names[0]), fetchComplex(names[1])]);
  if (!a || !b) return notFound();

  // 비교 항목
  const rows = [
    { label: '지역', va: `${a.region_nm} ${a.sigungu}`, vb: `${b.region_nm} ${b.sigungu}` },
    { label: '동', va: a.dong || '-', vb: b.dong || '-' },
    { label: '준공연도', va: a.built_year ? `${a.built_year}년` : '-', vb: b.built_year ? `${b.built_year}년` : '-' },
    { label: '연차', va: a.age_group || '-', vb: b.age_group || '-' },
    { label: '세대수', va: a.total_households ? `${a.total_households.toLocaleString()}세대` : '-', vb: b.total_households ? `${b.total_households.toLocaleString()}세대` : '-' },
    { label: '최근 매매가', va: a.latest_sale_price ? fmtAmount(a.latest_sale_price) : '-', vb: b.latest_sale_price ? fmtAmount(b.latest_sale_price) : '-', highlight: true },
    { label: '전세가', va: a.latest_jeonse_price ? fmtAmount(a.latest_jeonse_price) : '-', vb: b.latest_jeonse_price ? fmtAmount(b.latest_jeonse_price) : '-' },
    { label: '전세가율', va: a.jeonse_ratio ? `${a.jeonse_ratio}%` : '-', vb: b.jeonse_ratio ? `${b.jeonse_ratio}%` : '-' },
    { label: '평당가', va: a.avg_sale_price_pyeong ? fmtAmount(a.avg_sale_price_pyeong) : '-', vb: b.avg_sale_price_pyeong ? fmtAmount(b.avg_sale_price_pyeong) : '-' },
    { label: '1년 가격변동', va: a.price_change_1y != null ? `${Number(a.price_change_1y) > 0 ? '+' : ''}${a.price_change_1y}%` : '-', vb: b.price_change_1y != null ? `${Number(b.price_change_1y) > 0 ? '+' : ''}${b.price_change_1y}%` : '-' },
    { label: '1년 매매 거래', va: a.sale_count_1y ? `${a.sale_count_1y}건` : '-', vb: b.sale_count_1y ? `${b.sale_count_1y}건` : '-' },
    { label: '1년 전월세 거래', va: a.rent_count_1y ? `${a.rent_count_1y}건` : '-', vb: b.rent_count_1y ? `${b.rent_count_1y}건` : '-' },
  ];

  // 유니크 분석
  const priceDiff = a.latest_sale_price && b.latest_sale_price ? Math.round((a.latest_sale_price - b.latest_sale_price) / b.latest_sale_price * 100) : null;
  const jrDiff = a.jeonse_ratio && b.jeonse_ratio ? (Number(a.jeonse_ratio) - Number(b.jeonse_ratio)).toFixed(1) : null;

  const faq = [
    { q: `${a.apt_name}과 ${b.apt_name} 중 어디가 더 비싼가요?`, a: a.latest_sale_price && b.latest_sale_price ? (a.latest_sale_price > b.latest_sale_price ? `${a.apt_name}이 ${fmtAmount(a.latest_sale_price)}으로 ${b.apt_name}(${fmtAmount(b.latest_sale_price)})보다 ${Math.abs(priceDiff || 0)}% 높습니다.` : `${b.apt_name}이 ${fmtAmount(b.latest_sale_price)}으로 ${a.apt_name}(${fmtAmount(a.latest_sale_price)})보다 ${Math.abs(priceDiff || 0)}% 높습니다.`) : '비교 가능한 시세 데이터가 부족합니다.' },
    { q: `${a.apt_name}과 ${b.apt_name} 전세가율 비교`, a: a.jeonse_ratio && b.jeonse_ratio ? `${a.apt_name}의 전세가율은 ${a.jeonse_ratio}%, ${b.apt_name}은 ${b.jeonse_ratio}%입니다. 전세가율이 낮을수록 매매 대비 전세가 저렴한 편입니다.` : '전세가율 데이터가 부족합니다.' },
    { q: `${a.apt_name}과 ${b.apt_name} 중 거래가 더 활발한 곳은?`, a: `최근 1년 매매 거래는 ${a.apt_name} ${a.sale_count_1y || 0}건, ${b.apt_name} ${b.sale_count_1y || 0}건입니다.${(a.sale_count_1y || 0) > (b.sale_count_1y || 0) ? ` ${a.apt_name}이 더 활발합니다.` : (b.sale_count_1y || 0) > (a.sale_count_1y || 0) ? ` ${b.apt_name}이 더 활발합니다.` : ''}` },
  ];

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` }, { '@type': 'ListItem', position: 3, name: '단지 비교' }],
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      })}} />

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>
        <Link href="/apt" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>부동산</Link><span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>단지 비교</span>
      </nav>

      <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px', lineHeight: 1.3 }}>
        {a.apt_name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>vs</span> {b.apt_name}
      </h1>

      {/* 비교 테이블 */}
      <div style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ padding: '10px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)' }}>항목</div>
          <div style={{ padding: '10px 8px', fontSize: 12, fontWeight: 800, color: 'var(--accent-blue)', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>{a.apt_name}</div>
          <div style={{ padding: '10px 8px', fontSize: 12, fontWeight: 800, color: 'var(--accent-blue)', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>{b.apt_name}</div>
        </div>
        {/* 행 */}
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', background: r.highlight ? 'rgba(37, 99, 235, 0.05)' : 'transparent' }}>
            <div style={{ padding: '8px', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{r.label}</div>
            <div style={{ padding: '8px', fontSize: 12, fontWeight: r.highlight ? 800 : 600, color: 'var(--text-primary)', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>{r.va}</div>
            <div style={{ padding: '8px', fontSize: 12, fontWeight: r.highlight ? 800 : 600, color: 'var(--text-primary)', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>{r.vb}</div>
          </div>
        ))}
      </div>

      {/* 유니크 분석 문단 */}
      <section style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
        <p style={{ margin: 0 }}>
          <strong>{a.apt_name}</strong>은 {a.region_nm} {a.sigungu} {a.dong || ''} 소재{a.built_year ? ` ${a.built_year}년 준공` : ''} 아파트이고,
          <strong> {b.apt_name}</strong>은 {b.region_nm} {b.sigungu} {b.dong || ''} 소재{b.built_year ? ` ${b.built_year}년 준공` : ''} 아파트입니다.
          {priceDiff !== null && ` 매매가 기준 ${a.apt_name}이 ${b.apt_name} 대비 ${priceDiff > 0 ? `${priceDiff}% 높으며` : `${Math.abs(priceDiff)}% 낮으며`},`}
          {jrDiff !== null && ` 전세가율은 ${a.apt_name} ${a.jeonse_ratio}% vs ${b.apt_name} ${b.jeonse_ratio}%로 ${Number(jrDiff) > 0 ? `${a.apt_name}이 ${jrDiff}%p 높습니다` : `${b.apt_name}이 ${Math.abs(Number(jrDiff))}%p 높습니다`}.`}
          {` 데이터 출처: 국토교통부 실거래가 공개시스템.`}
        </p>
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px' }}>자주 묻는 질문</h2>
        {faq.map((f, i) => (
          <details key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 6 }}>
            <summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>{f.q}</summary>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>{f.a}</p>
          </details>
        ))}
      </section>

      {/* 단지별 상세 링크 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 40 }}>
        <Link href={`/apt/complex/${encodeURIComponent(a.apt_name)}`} style={{ display: 'block', textAlign: 'center', padding: '14px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #0F1B3E 0%, #2563EB 100%)', textDecoration: 'none', fontSize: 12, fontWeight: 700, color: '#fff' }}>{a.apt_name} 상세 →</Link>
        <Link href={`/apt/complex/${encodeURIComponent(b.apt_name)}`} style={{ display: 'block', textAlign: 'center', padding: '14px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #0F1B3E 0%, #2563EB 100%)', textDecoration: 'none', fontSize: 12, fontWeight: 700, color: '#fff' }}>{b.apt_name} 상세 →</Link>
      </div>

      <footer style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', paddingBottom: 40 }}>
        데이터 출처: 국토교통부 실거래가 공개시스템 · 카더라
      </footer>
    </article>
  );
}

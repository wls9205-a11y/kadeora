import { cache } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fmtAmount } from '@/lib/format';

export const revalidate = 3600;
export const maxDuration = 30;

interface Props { params: Promise<{ name: string }> }

const fetchBuilder = cache(async (builder: string) => {
  const sb = getSupabaseAdmin();
  const { data: sites } = await sb.from('apt_sites')
    .select('slug, name, region, sigungu, site_type, total_units, price_min, price_max, built_year, move_in_date, status, interest_count, images')
    .eq('is_active', true).eq('builder', builder)
    .order('interest_count', { ascending: false }).limit(200);
  return sites || [];
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name: raw } = await params;
  const builder = decodeURIComponent(raw);
  const sites = await fetchBuilder(builder);
  if (sites.length < 3) return { title: builder, robots: { index: false, follow: true } };

  const shortName = builder.replace(/\(주\)|주식회사| /g, '').slice(0, 15);
  const regions = [...new Set(sites.map(s => s.region).filter(Boolean))];
  const title = `${shortName} 분양 아파트 | ${sites.length}개 현장 · ${regions.length}개 지역`;
  const desc = `${builder}(${shortName}) 분양 아파트 ${sites.length}개 현장 정보. ${regions.slice(0, 5).join(', ')} 등 ${regions.length}개 지역. 분양가, 세대수, 입주일정을 한눈에.`;

  return {
    title, description: desc,
    alternates: { canonical: `${SITE_URL}/apt/builder/${encodeURIComponent(builder)}` },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: { title, description: desc, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(shortName + ' 분양')}&design=2&subtitle=${encodeURIComponent(sites.length + '개 현장')}&author=${encodeURIComponent('카더라')}`, width: 1200, height: 630 }] },
    other: { 'naver:author': '카더라', 'naver:updated_time': new Date().toISOString(), 'article:section': '부동산', 'article:tag': `${shortName},${builder},분양,아파트,건설사`, 'dg:plink': `${SITE_URL}/apt/builder/${encodeURIComponent(builder)}` },
  };
}

export default async function BuilderPage({ params }: Props) {
  const { name: raw } = await params;
  const builder = decodeURIComponent(raw);
  const sites = await fetchBuilder(builder);
  if (sites.length < 3) return notFound();

  const shortName = builder.replace(/\(주\)|주식회사| /g, '').slice(0, 15);
  const regions = [...new Set(sites.map(s => s.region).filter(Boolean))];
  const withPrice = sites.filter(s => s.price_min && s.price_min > 0);
  const avgPriceMin = withPrice.length > 0 ? Math.round(withPrice.reduce((s, p) => s + (p.price_min || 0), 0) / withPrice.length) : 0;
  const totalUnits = sites.reduce((s, p) => s + (p.total_units || 0), 0);
  const tLabel: Record<string, string> = { subscription: '분양', redevelopment: '재개발', unsold: '미분양', trade: '실거래', landmark: '랜드마크' };

  // 지역별 분포
  const regionMap = new Map<string, number>();
  for (const s of sites) { if (s.region) regionMap.set(s.region, (regionMap.get(s.region) || 0) + 1); }
  const regionDist = Array.from(regionMap.entries()).sort((a, b) => b[1] - a[1]);

  const faq = [
    { q: `${shortName} 분양 아파트는 몇 개인가요?`, a: `현재 ${builder}의 활성 분양 현장은 ${sites.length}개이며, ${regions.length}개 지역에 걸쳐 있습니다.` },
    { q: `${shortName} 분양가 평균은?`, a: avgPriceMin > 0 ? `${builder}의 평균 분양가(최소)는 ${fmtAmount(avgPriceMin)}입니다.` : '분양가 정보가 아직 없습니다.' },
    { q: `${shortName} 분양 지역은 어디인가요?`, a: `${regionDist.map(([r, c]) => `${r}(${c}개)`).join(', ')} 지역에서 분양 중입니다.` },
    { q: `${shortName} 총 세대수는?`, a: totalUnits > 0 ? `현재 활성 현장 기준 총 ${totalUnits.toLocaleString()}세대입니다.` : '세대수 정보가 아직 집계되지 않았습니다.' },
  ];

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` }, { '@type': 'ListItem', position: 3, name: '건설사' }, { '@type': 'ListItem', position: 4, name: shortName }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: builder, url: `${SITE_URL}/apt/builder/${encodeURIComponent(builder)}`, description: `${builder} — ${sites.length}개 아파트 분양 현장`, numberOfEmployees: { '@type': 'QuantitativeValue', value: sites.length, unitText: '분양 현장' } }) }} />

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>
        <Link href="/apt" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>부동산</Link><span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{shortName}</span>
      </nav>

      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        {shortName} 분양 아파트
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 8 }}>{sites.length}개 현장</span>
      </h1>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { l: '분양 현장', v: `${sites.length}개` },
          { l: '진출 지역', v: `${regions.length}개` },
          { l: '평균 분양가', v: avgPriceMin > 0 ? fmtAmount(avgPriceMin) : '-' },
        ].map((k, i) => (
          <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{k.l}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* 유니크 분석 */}
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 16, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        <strong>{builder}</strong>은 현재 <strong>{sites.length}개</strong> 분양 현장을 운영 중이며,
        {` ${regions.slice(0, 5).join(', ')} 등 ${regions.length}개 지역에 진출해 있습니다.`}
        {avgPriceMin > 0 && ` 평균 분양가(최소)는 ${fmtAmount(avgPriceMin)}이며,`}
        {totalUnits > 0 && ` 총 ${totalUnits.toLocaleString()}세대 규모입니다.`}
        {` 데이터 출처: 국토교통부 · 청약홈.`}
      </p>

      {/* 지역별 분포 */}
      {regionDist.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>지역별 현장 수</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {regionDist.map(([r, c]) => (
              <Link key={r} href={`/apt/region/${encodeURIComponent(r)}`} style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none', fontSize: 12, color: 'var(--text-secondary)' }}>{r} <strong>{c}</strong></Link>
            ))}
          </div>
        </section>
      )}

      {/* 현장 목록 */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>{shortName} 분양 현장</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sites.map((s, i) => (
            <Link key={i} href={`/apt/${s.slug}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.region} {s.sigungu || ''} · {tLabel[s.site_type] || ''}{s.total_units ? ` · ${s.total_units}세대` : ''}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                {s.price_min ? <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{fmtAmount(s.price_min)}~</div> : null}
                {s.status && <div style={{ fontSize: 10, color: s.status === '분양중' ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>{s.status}</div>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>자주 묻는 질문</h2>
        {faq.map((f, i) => (
          <details key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 6 }}>
            <summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>{f.q}</summary>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{f.a}</p>
          </details>
        ))}
      </section>

      <Link href="/apt" style={{ display: 'block', textAlign: 'center', padding: '14px', marginBottom: 40, borderRadius: 'var(--radius-lg)', fontWeight: 800, textDecoration: 'none', fontSize: 13, background: 'linear-gradient(135deg, #0F1B3E 0%, #2563EB 100%)', color: '#fff' }}>🏗️ 전체 분양 정보 보기 →</Link>
      <footer style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', paddingBottom: 40 }}>데이터 출처: 국토교통부 · 청약홈 · 카더라</footer>
    </article>
  );
}

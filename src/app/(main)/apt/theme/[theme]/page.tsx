import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fmtAmount } from '@/lib/format';

export const revalidate = 3600;
export const maxDuration = 30;

interface Props {
  params: Promise<{ theme: string }>;
  searchParams: Promise<{ region?: string }>;
}

const THEMES: Record<string, {
  title: string; desc: string; keywords: string[];
  query: (sb: any, region?: string) => any;
  formatSub: (p: any) => string;
}> = {
  'low-jeonse-ratio': {
    title: '전세가율 낮은 아파트',
    desc: '전세가율이 낮아 매매 대비 전세가 저렴한 안정적인 아파트 단지입니다. 갭투자 리스크가 적어 실수요자에게 유리합니다.',
    keywords: ['전세가율 낮은 아파트', '안정적인 아파트', '갭투자 안전', '투자 안정'],
    query: (sb, region) => {
      let q = sb.from('apt_complex_profiles').select('apt_name, region_nm, sigungu, dong, latest_sale_price, latest_jeonse_price, jeonse_ratio, sale_count_1y, built_year, age_group, price_change_1y')
        .gt('jeonse_ratio', 0).lt('jeonse_ratio', 45).gt('latest_sale_price', 0).not('age_group', 'is', null)
        .order('jeonse_ratio', { ascending: true }).limit(100);
      if (region) q = q.eq('region_nm', region);
      return q;
    },
    formatSub: (p) => `전세가율 ${p.jeonse_ratio}%`,
  },
  'high-jeonse-ratio': {
    title: '전세가율 높은 아파트 (주의)',
    desc: '전세가율이 70% 이상으로 높은 단지입니다. 갭투자 위험이 크며, 역전세 리스크에 주의가 필요합니다.',
    keywords: ['전세가율 높은 아파트', '갭투자 위험', '역전세 위험', '전세가율 70'],
    query: (sb, region) => {
      let q = sb.from('apt_complex_profiles').select('apt_name, region_nm, sigungu, dong, latest_sale_price, latest_jeonse_price, jeonse_ratio, sale_count_1y, built_year, age_group, price_change_1y')
        .gte('jeonse_ratio', 70).gt('latest_sale_price', 0).not('age_group', 'is', null)
        .order('jeonse_ratio', { ascending: false }).limit(100);
      if (region) q = q.eq('region_nm', region);
      return q;
    },
    formatSub: (p) => `전세가율 ${p.jeonse_ratio}% ⚠️`,
  },
  'price-up': {
    title: '최근 1년 가격 상승 아파트',
    desc: '최근 1년간 매매가가 상승한 아파트 단지입니다. 상승률 기준 정렬.',
    keywords: ['가격 상승 아파트', '아파트 가격 오른 곳', '부동산 상승', '시세 상승'],
    query: (sb, region) => {
      let q = sb.from('apt_complex_profiles').select('apt_name, region_nm, sigungu, dong, latest_sale_price, latest_jeonse_price, jeonse_ratio, sale_count_1y, built_year, age_group, price_change_1y')
        .gt('price_change_1y', 0).gt('latest_sale_price', 0).not('age_group', 'is', null)
        .order('price_change_1y', { ascending: false }).limit(100);
      if (region) q = q.eq('region_nm', region);
      return q;
    },
    formatSub: (p) => `+${p.price_change_1y}% 상승`,
  },
  'price-down': {
    title: '최근 1년 가격 하락 아파트',
    desc: '최근 1년간 매매가가 하락한 아파트 단지입니다. 저가 매수 기회를 찾는 투자자에게 참고가 됩니다.',
    keywords: ['가격 하락 아파트', '아파트 가격 내린 곳', '급매', '저가 매수'],
    query: (sb, region) => {
      let q = sb.from('apt_complex_profiles').select('apt_name, region_nm, sigungu, dong, latest_sale_price, latest_jeonse_price, jeonse_ratio, sale_count_1y, built_year, age_group, price_change_1y')
        .lt('price_change_1y', 0).gt('latest_sale_price', 0).not('age_group', 'is', null)
        .order('price_change_1y', { ascending: true }).limit(100);
      if (region) q = q.eq('region_nm', region);
      return q;
    },
    formatSub: (p) => `${p.price_change_1y}% 하락`,
  },
  'new-built': {
    title: '신축 아파트 (5년 이내)',
    desc: '최근 5년 이내 준공된 신축 아파트 단지입니다. 최신 설비와 인프라를 갖추고 있습니다.',
    keywords: ['신축 아파트', '새 아파트', '입주 아파트', '최신 아파트'],
    query: (sb, region) => {
      let q = sb.from('apt_complex_profiles').select('apt_name, region_nm, sigungu, dong, latest_sale_price, latest_jeonse_price, jeonse_ratio, sale_count_1y, built_year, age_group, price_change_1y')
        .eq('age_group', '신축').gt('latest_sale_price', 0)
        .order('latest_sale_price', { ascending: false }).limit(100);
      if (region) q = q.eq('region_nm', region);
      return q;
    },
    formatSub: (p) => `${p.built_year}년 준공`,
  },
  'high-trade': {
    title: '거래 활발 아파트',
    desc: '최근 1년간 매매 거래가 활발한 인기 아파트 단지입니다. 거래량이 많을수록 시장 관심도가 높습니다.',
    keywords: ['거래 활발 아파트', '인기 아파트', '거래량 많은', '아파트 거래량'],
    query: (sb, region) => {
      let q = sb.from('apt_complex_profiles').select('apt_name, region_nm, sigungu, dong, latest_sale_price, latest_jeonse_price, jeonse_ratio, sale_count_1y, built_year, age_group, price_change_1y')
        .gt('sale_count_1y', 10).gt('latest_sale_price', 0).not('age_group', 'is', null)
        .order('sale_count_1y', { ascending: false }).limit(100);
      if (region) q = q.eq('region_nm', region);
      return q;
    },
    formatSub: (p) => `${p.sale_count_1y}건 거래`,
  },
};

const REGIONS = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'];

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { theme } = await params;
  const { region } = await searchParams;
  const t = THEMES[theme];
  if (!t) return { title: '테마 검색' };

  const regionLabel = region && REGIONS.includes(region) ? `${region} ` : '전국 ';
  const title = `${regionLabel}${t.title} TOP 100 | 2026 카더라`;
  const desc = `${regionLabel}${t.title} 순위. ${t.desc} 데이터 출처: 국토교통부 실거래가 공개시스템.`;

  return {
    title, description: desc,
    alternates: { canonical: `${SITE_URL}/apt/theme/${theme}${region ? `?region=${encodeURIComponent(region)}` : ''}` },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: { title, description: desc, siteName: '카더라', locale: 'ko_KR', type: 'website',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(regionLabel + t.title)}&design=2&subtitle=${encodeURIComponent('TOP 100')}&author=${encodeURIComponent('카더라')}`, width: 1200, height: 630 }] },
    other: {
      'naver:author': '카더라', 'naver:updated_time': new Date().toISOString(), 'article:section': '부동산', 'article:tag': t.keywords.join(','),
      ...(() => {
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
        if (!region) return {};
        const g = GEO[region];
        return g ? { 'geo.region': g.code, 'geo.placename': region, 'geo.position': `${g.lat};${g.lng}`, 'ICBM': `${g.lat}, ${g.lng}` } : {};
      })(),
    },
  };
}

export default async function ThemePage({ params, searchParams }: Props) {
  const { theme } = await params;
  const { region } = await searchParams;
  const t = THEMES[theme];
  if (!t) return notFound();

  const sb = getSupabaseAdmin();
  let selectedRegion: string | undefined = region && REGIONS.includes(region) ? region : undefined;
  const { data: profiles } = await t.query(sb as any, selectedRegion);

  // 안티스팸: 결과 10개 미만이면 지역 필터 해제
  const items = (profiles || []) as any[];
  if (items.length < 10 && selectedRegion) {
    // fallback to all regions
    const { data: fallback } = await t.query(sb as any, undefined);
    if ((fallback || []).length >= 10) {
      items.length = 0;
      items.push(...(fallback || []));
      selectedRegion = undefined; // 전국 데이터로 전환됨
    }
  }

  if (items.length < 5) return notFound();

  const regionLabel = selectedRegion ? `${selectedRegion} ` : '전국 ';

  // 유니크 분석
  const avgPrice = items.filter(p => p.latest_sale_price > 0).length > 0 ? Math.round(items.filter(p => p.latest_sale_price > 0).reduce((s: number, p: any) => s + p.latest_sale_price, 0) / items.filter(p => p.latest_sale_price > 0).length) : 0;
  const topRegions = new Map<string, number>();
  for (const p of items) { topRegions.set(p.region_nm, (topRegions.get(p.region_nm) || 0) + 1); }
  const regionDist = Array.from(topRegions.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const faq = [
    { q: `${regionLabel}${t.title}는 몇 개인가요?`, a: `현재 ${regionLabel}기준 ${items.length}개 단지가 해당됩니다. 평균 매매가는 ${fmtAmount(avgPrice)}입니다.` },
    { q: `${t.title} 데이터는 어디서 오나요?`, a: `국토교통부 실거래가 공개시스템의 공공데이터를 기반으로 카더라가 자동 분석합니다.` },
    { q: `${t.title} 지역별 분포는?`, a: `${regionDist.map(([r, c]) => `${r} ${c}개`).join(', ')} 순입니다.` },
  ];

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` }, { '@type': 'ListItem', position: 3, name: t.title }] }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }) }} />

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>
        <Link href="/apt" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>부동산</Link><span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t.title}</span>
      </nav>

      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        {regionLabel}{t.title}
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 8 }}>TOP {items.length}</span>
      </h1>

      {/* 지역 필터 */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
        <Link href={`/apt/theme/${theme}`} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 11, textDecoration: 'none', fontWeight: 600, background: !selectedRegion ? 'var(--accent-blue)' : 'var(--bg-surface)', color: !selectedRegion ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>전국</Link>
        {REGIONS.map(r => (
          <Link key={r} href={`/apt/theme/${theme}?region=${encodeURIComponent(r)}`} style={{ padding: '4px 10px', borderRadius: 16, fontSize: 11, textDecoration: 'none', fontWeight: 600, background: selectedRegion === r ? 'var(--accent-blue)' : 'var(--bg-surface)', color: selectedRegion === r ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)' }}>{r}</Link>
        ))}
      </div>

      {/* 분석 */}
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 16, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        {t.desc} {regionLabel}기준 <strong>{items.length}개</strong> 단지가 해당되며, 평균 매매가는 <strong>{fmtAmount(avgPrice)}</strong>입니다.
        {regionDist.length > 0 && ` 지역별로는 ${regionDist.slice(0, 3).map(([r, c]) => `${r}(${c}개)`).join(', ')} 순입니다.`}
        {` 데이터 출처: 국토교통부 실거래가 공개시스템.`}
      </p>

      {/* 목록 */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((p: any, i: number) => (
            <Link key={i} href={`/apt/complex/${encodeURIComponent(p.apt_name)}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? 'var(--accent-blue)' : 'var(--text-tertiary)', width: 24, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.apt_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.region_nm} {p.sigungu} {p.dong || ''} · {p.age_group || ''}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{p.latest_sale_price ? fmtAmount(p.latest_sale_price) : '-'}</div>
                <div style={{ fontSize: 10, color: theme.includes('price-up') ? 'var(--accent-green, #16a34a)' : theme.includes('price-down') ? '#ef4444' : 'var(--text-tertiary)' }}>{t.formatSub(p)}</div>
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

      {/* 다른 테마 */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>다른 테마 분석</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {Object.entries(THEMES).filter(([k]) => k !== theme).map(([k, v]) => (
            <Link key={k} href={`/apt/theme/${k}${selectedRegion ? `?region=${encodeURIComponent(selectedRegion)}` : ''}`} style={{ padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{v.title}</Link>
          ))}
        </div>
      </section>

      <footer style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', paddingBottom: 40 }}>데이터 출처: 국토교통부 실거래가 공개시스템 · 카더라</footer>
    </article>
  );
}

import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notFound } from 'next/navigation';

const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  // 주요 시군구
  '강남구', '서초구', '송파구', '마포구', '용산구', '성남시', '수원시',
  '고양시', '화성시', '평택시', '해운대구', '부산진구', '동래구',
];

interface Props { params: Promise<{ region: string }> }

const sb = () => getSupabaseAdmin();

export async function generateStaticParams() {
  return REGIONS.map(r => ({ region: encodeURIComponent(r) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region } = await params;
  const decoded = decodeURIComponent(region);
  return {
    title: `${decoded} 부동산 정보 — 청약·실거래·재개발·미분양`,
    description: `${decoded} 지역 아파트 청약 일정, 실거래가, 재개발 현황, 미분양 정보를 한눈에. 카더라에서 ${decoded} 부동산 정보를 확인하세요.`,
    alternates: { canonical: `${SITE_URL}/apt/region/${encodeURIComponent(decoded)}` },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: {
      title: `${decoded} 부동산 종합 정보`,
      description: `${decoded} 청약·실거래·재개발·미분양 한눈에`,
      url: `${SITE_URL}/apt/region/${encodeURIComponent(decoded)}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(decoded + ' 부동산')}&subtitle=${encodeURIComponent('청약·실거래·재개발·미분양')}`, width: 1200, height: 630, alt: `${decoded} 부동산 정보` }],
    },
    twitter: { card: 'summary_large_image' as const, title: `${decoded} 부동산`, description: `청약·실거래·재개발·미분양 종합 정보` },
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString(),
      'dg:plink': `${SITE_URL}/apt/region/${decoded}`,
      'article:section': '부동산',
      'article:tag': `${decoded},부동산,청약,실거래,재개발,미분양`,
      ...((() => {
        const GEO: Record<string, string> = { '서울': 'KR-11', '부산': 'KR-26', '대구': 'KR-27', '인천': 'KR-28', '광주': 'KR-29', '대전': 'KR-30', '울산': 'KR-31', '세종': 'KR-36', '경기': 'KR-41', '강원': 'KR-42', '충북': 'KR-43', '충남': 'KR-44', '전북': 'KR-45', '전남': 'KR-46', '경북': 'KR-47', '경남': 'KR-48', '제주': 'KR-50' };
        const g = Object.entries(GEO).find(([k]) => decoded.includes(k));
        if (g) return { 'geo.region': g[1], 'geo.placename': decoded } as Record<string, string>;
        return {} as Record<string, string>;
      })()),
    },
  };
}

export const maxDuration = 30;
export const revalidate = 3600;

async function fetchRegionData(region: string) {
  const s = sb();

  const [subsRes, tradesRes, redevRes, unsoldRes] = await Promise.all([
    s.from('apt_subscriptions')
      .select('id,house_nm,region_nm,rcept_bgnde,rcept_endde,tot_supply_hshld_co,hssply_adres')
      .ilike('region_nm', `%${region}%`)
      .order('rcept_endde', { ascending: false }).limit(10) as unknown as Promise<any>,
    s.from('apt_transactions')
      .select('id,apt_name,region_nm,deal_date,deal_amount,exclusive_area')
      .ilike('region_nm', `%${region}%`)
      .order('deal_date', { ascending: false }).limit(10) as unknown as Promise<any>,
    s.from('redevelopment_projects')
      .select('id,project_name,region,stage,total_households')
      .ilike('region', `%${region}%`).eq('is_active', true)
      .order('created_at', { ascending: false }).limit(10) as unknown as Promise<any>,
    s.from('unsold_apts')
      .select('id,complex_name,region,unsold_count')
      .ilike('region', `%${region}%`).eq('is_active', true)
      .order('unsold_count', { ascending: false }).limit(10) as unknown as Promise<any>,
  ]);

  return {
    subscriptions: subsRes?.data || [],
    transactions: tradesRes?.data || [],
    redevelopments: redevRes?.data || [],
    unsolds: unsoldRes?.data || [],
  };
}

function fmtPrice(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`;
  return `${n.toLocaleString()}만`;
}

export default async function RegionLandingPage({ params }: Props) {
  const { region } = await params;
  const decoded = decodeURIComponent(region);

  if (!REGIONS.some(r => decoded.includes(r) || r.includes(decoded))) {
    notFound();
  }

  const data = await fetchRegionData(decoded);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* JSON-LD: BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"카더라","item":SITE_URL},{"@type":"ListItem","position":2,"name":"부동산","item":SITE_URL+"/apt"},{"@type":"ListItem","position":3,"name":decoded}]}) }} />
      {/* JSON-LD: CollectionPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":`${decoded} 부동산 종합 정보`,"description":`${decoded} 지역 청약 ${data.subscriptions.length}건, 실거래 ${data.transactions.length}건, 재개발 ${data.redevelopments.length}건, 미분양 ${data.unsolds.length}건`,"url":`${SITE_URL}/apt/region/${encodeURIComponent(decoded)}`,"isPartOf":{"@type":"WebSite","name":"카더라","url":SITE_URL}}) }} />
      {/* JSON-LD: FAQ (지역 검색 SERP 아코디언) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
        {"@type":"Question","name":`${decoded} 아파트 청약 일정은?`,"acceptedAnswer":{"@type":"Answer","text":`${decoded} 지역에는 현재 ${data.subscriptions.length}건의 청약이 진행 중입니다. 카더라에서 접수 일정, 경쟁률, 분양가를 실시간으로 확인하세요.`}},
        {"@type":"Question","name":`${decoded} 미분양 아파트 현황은?`,"acceptedAnswer":{"@type":"Answer","text":`${decoded} 지역에는 ${data.unsolds.length}건의 미분양 현장이 있습니다. 할인 분양, 중도금 혜택 등을 비교해보세요.`}},
        {"@type":"Question","name":`${decoded} 재개발 진행 현황은?`,"acceptedAnswer":{"@type":"Answer","text":`${decoded} 지역에서 ${data.redevelopments.length}건의 재개발·재건축 사업이 진행 중입니다. 사업 단계, 조합 현황, 예상 분양 시기를 확인하세요.`}},
        {"@type":"Question","name":`${decoded} 실거래가 조회 방법은?`,"acceptedAnswer":{"@type":"Answer","text":`카더라에서 ${decoded} 지역 ${data.transactions.length}건의 아파트 실거래가를 조회할 수 있습니다. 단지별, 면적별, 기간별 필터로 원하는 정보를 찾아보세요.`}},
      ]}) }} />
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/apt" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 부동산</Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>🏙️ {decoded} 부동산 종합</h1>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
          청약 {data.subscriptions.length}건 · 실거래 {data.transactions.length}건 · 재개발 {data.redevelopments.length}건 · 미분양 {data.unsolds.length}건
        </p>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 20 }}>
        {[
          { icon: '📋', label: '청약', count: data.subscriptions.length, href: '/apt', color: 'var(--accent-blue)' },
          { icon: '💰', label: '실거래', count: data.transactions.length, href: '/apt', color: 'var(--accent-green)' },
          { icon: '🏗️', label: '재개발', count: data.redevelopments.length, href: '/apt', color: 'var(--accent-orange)' },
          { icon: '🏚️', label: '미분양', count: data.unsolds.length, href: '/apt', color: 'var(--accent-red)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '12px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 청약 섹션 */}
      {data.subscriptions.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📋 최근 청약</h2>
          {data.subscriptions.map((s: any) => (
            <Link key={s.id} href={`/apt/${s.id}`} style={{
              display: 'block', textDecoration: 'none', padding: '10px 14px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, marginBottom: 6,
            }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{s.house_nm}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                {s.hssply_adres} · {s.tot_supply_hshld_co}세대 · ~{s.rcept_endde?.slice(5)}
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* 실거래 섹션 */}
      {data.transactions.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>💰 최근 실거래</h2>
          {data.transactions.map((t: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 14px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, marginBottom: 4,
            }}>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{t.apt_name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{t.deal_date} · {t.exclusive_area}㎡</div>
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-blue)', textAlign: 'right' }}>
                {fmtPrice(t.deal_amount)}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 재개발 섹션 */}
      {data.redevelopments.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🏗️ 재개발 현황</h2>
          {data.redevelopments.map((r: any) => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, marginBottom: 4,
            }}>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{r.project_name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{r.region}</div>
              </div>
              <span style={{
                fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 4,
                background: 'var(--bg-hover)', color: 'var(--accent-orange)', fontWeight: 600,
              }}>
                {r.stage || '진행중'}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* 미분양 섹션 */}
      {data.unsolds.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🏚️ 미분양</h2>
          {data.unsolds.map((u: any) => (
            <div key={u.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, marginBottom: 4,
            }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{u.complex_name}</div>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-red)' }}>{u.unsold_count}세대</span>
            </div>
          ))}
        </section>
      )}

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: 20 }}>
        <Link href="/apt" style={{
          display: 'inline-block', padding: '12px 28px', background: 'var(--brand)',
          color: 'var(--text-inverse)', borderRadius: 10, fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none',
        }}>
          전체 부동산 정보 보기 →
        </Link>
      </div>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${decoded} 부동산 종합 정보`,
        description: `${decoded} 지역 아파트 청약, 실거래가, 재개발, 미분양 정보`,
        url: `${SITE_URL}/apt/region/${encodeURIComponent(decoded)}`,
        isPartOf: { '@type': 'WebSite', name: '카더라', url: SITE_URL },
      })}} />
    </div>
  );
}

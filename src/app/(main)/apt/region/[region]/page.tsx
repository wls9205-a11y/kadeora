import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import ShareButtons from '@/components/ShareButtons';
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
    title: `${decoded} 부동산 정보 — 청약·모집공고·실거래·재개발·미분양`,
    description: `${decoded} 지역 아파트 청약 일정, 모집공고 요약, 실거래가, 재개발 현황, 미분양 정보를 한눈에. 카더라에서 ${decoded} 부동산 정보를 확인하세요.`,
    alternates: { canonical: `${SITE_URL}/apt/region/${encodeURIComponent(decoded)}` },
    robots: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' as const },
    openGraph: {
      title: `${decoded} 부동산 종합 정보`,
      description: `${decoded} 청약·실거래·재개발·미분양 한눈에`,
      url: `${SITE_URL}/apt/region/${encodeURIComponent(decoded)}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'website',
      images: [
        { url: `${SITE_URL}/api/og?title=${encodeURIComponent(decoded + ' 부동산')}&design=2&subtitle=${encodeURIComponent('청약·실거래·재개발·미분양')}`, width: 1200, height: 630, alt: `${decoded} 부동산 정보` },
        { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(decoded + ' 부동산')}&category=apt`, width: 630, height: 630, alt: `${decoded} 부동산` },
      ],
    },
    twitter: { card: 'summary_large_image' as const, title: `${decoded} 부동산`, description: `청약·실거래·재개발·미분양 종합 정보` },
    other: {
      'naver:written_time': '2026-04-12T00:00:00Z',
      'naver:updated_time': '2026-04-12T00:00:00Z',
      'naver:author': '카더라',
      'og:updated_time': '2026-04-12T00:00:00Z',
      'dg:plink': `${SITE_URL}/apt/region/${decoded}`,
      'article:section': '부동산',
      'article:tag': `${decoded},부동산,청약,실거래,재개발,미분양,모집공고,분양가`,
      'article:published_time': '2026-01-15T00:00:00Z',
      'article:modified_time': new Date().toISOString(),
      ...((() => {
        const GEO: Record<string, { code: string; lat: string; lng: string }> = {
          '서울': { code: 'KR-11', lat: '37.5665', lng: '126.9780' }, '부산': { code: 'KR-26', lat: '35.1796', lng: '129.0756' }, '대구': { code: 'KR-27', lat: '35.8714', lng: '128.6014' }, '인천': { code: 'KR-28', lat: '37.4563', lng: '126.7052' }, '광주': { code: 'KR-29', lat: '35.1595', lng: '126.8526' }, '대전': { code: 'KR-30', lat: '36.3504', lng: '127.3845' }, '울산': { code: 'KR-31', lat: '35.5384', lng: '129.3114' }, '세종': { code: 'KR-36', lat: '36.4800', lng: '127.2600' }, '경기': { code: 'KR-41', lat: '37.4138', lng: '127.5183' }, '강원': { code: 'KR-42', lat: '37.8228', lng: '128.1555' }, '충북': { code: 'KR-43', lat: '36.6357', lng: '127.4917' }, '충남': { code: 'KR-44', lat: '36.5184', lng: '126.8000' }, '전북': { code: 'KR-45', lat: '35.8203', lng: '127.1088' }, '전남': { code: 'KR-46', lat: '34.8161', lng: '126.4629' }, '경북': { code: 'KR-47', lat: '36.4919', lng: '128.8889' }, '경남': { code: 'KR-48', lat: '35.4606', lng: '128.2132' }, '제주': { code: 'KR-50', lat: '33.4996', lng: '126.5312' },
          // 주요 시군구
          '강남구': { code: 'KR-11', lat: '37.5172', lng: '127.0473' }, '서초구': { code: 'KR-11', lat: '37.4837', lng: '127.0324' }, '송파구': { code: 'KR-11', lat: '37.5145', lng: '127.1059' }, '마포구': { code: 'KR-11', lat: '37.5663', lng: '126.9014' }, '용산구': { code: 'KR-11', lat: '37.5326', lng: '126.9910' }, '성남시': { code: 'KR-41', lat: '37.4200', lng: '127.1267' }, '수원시': { code: 'KR-41', lat: '37.2636', lng: '127.0286' }, '고양시': { code: 'KR-41', lat: '37.6584', lng: '126.8320' }, '화성시': { code: 'KR-41', lat: '37.1995', lng: '126.8313' }, '평택시': { code: 'KR-41', lat: '36.9921', lng: '127.1126' }, '해운대구': { code: 'KR-26', lat: '35.1631', lng: '129.1636' }, '부산진구': { code: 'KR-26', lat: '35.1630', lng: '129.0532' }, '동래구': { code: 'KR-26', lat: '35.2050', lng: '129.0858' },
        };
        const g = Object.entries(GEO).find(([k]) => decoded === k || decoded.startsWith(k));
        if (g) return {
          'geo.region': g[1].code,
          'geo.placename': decoded,
          'geo.position': `${g[1].lat};${g[1].lng}`,
          'ICBM': `${g[1].lat}, ${g[1].lng}`,
        } as Record<string, string>;
        return {} as Record<string, string>;
      })()),
    },
  };
}

export const maxDuration = 30;
export const revalidate = 3600;

async function fetchRegionData(region: string) {
  const s = sb();

  const [subsRes, tradesRes, redevRes, unsoldRes, priceRes] = await Promise.all([
    s.from('apt_subscriptions')
      .select('id,house_nm,region_nm,rcept_bgnde,rcept_endde,tot_supply_hshld_co,hssply_adres,is_price_limit,constructor_nm,ai_summary,house_type_info,price_per_pyeong_avg,brand_name,project_type,loan_rate,is_regulated_area,developer_nm,total_households')
      .ilike('region_nm', `%${region}%`)
      .order('rcept_endde', { ascending: false }).limit(10) as unknown as Promise<any>,
    s.from('apt_transactions')
      .select('id,apt_name,region_nm,deal_date,deal_amount,exclusive_area')
      .ilike('region_nm', `%${region}%`)
      .order('deal_date', { ascending: false }).limit(10) as unknown as Promise<any>,
    s.from('redevelopment_projects')
      .select('id,district_name,region,stage,total_households')
      .ilike('region', `%${region}%`).eq('is_active', true)
      .order('created_at', { ascending: false }).limit(10) as unknown as Promise<any>,
    s.from('unsold_apts')
      .select('id,complex_name,region,unsold_count')
      .ilike('region', `%${region}%`).eq('is_active', true)
      .order('unsold_count', { ascending: false }).limit(10) as unknown as Promise<any>,
    // 지역 분양가 통계
    s.from('apt_sites')
      .select('price_min,price_max')
      .ilike('region', `%${region}%`).eq('is_active', true)
      .gt('price_min', 0).gt('price_max', 0)
      .limit(50) as unknown as Promise<any>,
  ]);

  const priceData = priceRes?.data || [];
  const priceStats = priceData.length > 0 ? {
    count: priceData.length,
    avgMin: Math.round(priceData.reduce((s: number, p: any) => s + p.price_min, 0) / priceData.length),
    avgMax: Math.round(priceData.reduce((s: number, p: any) => s + p.price_max, 0) / priceData.length),
    lowestMin: Math.min(...priceData.map((p: any) => p.price_min)),
    highestMax: Math.max(...priceData.map((p: any) => p.price_max)),
  } : null;

  return {
    subscriptions: subsRes?.data || [],
    transactions: tradesRes?.data || [],
    redevelopments: redevRes?.data || [],
    unsolds: unsoldRes?.data || [],
    priceStats,
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
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      {/* JSON-LD: BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"카더라","item":SITE_URL},{"@type":"ListItem","position":2,"name":"부동산","item":SITE_URL+"/apt"},{"@type":"ListItem","position":3,"name":decoded}]}) }} />
      {/* JSON-LD: CollectionPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":`${decoded} 부동산 종합 정보`,"description":`${decoded} 지역 청약 ${data.subscriptions.length}건, 실거래 ${data.transactions.length}건, 재개발 ${data.redevelopments.length}건, 미분양 ${data.unsolds.length}건`,"url":`${SITE_URL}/apt/region/${encodeURIComponent(decoded)}`,"isPartOf":{"@type":"WebSite","name":"카더라","url":SITE_URL},"speakable":{"@type":"SpeakableSpecification","cssSelector":["h1",".region-summary"]},"mainEntityOfPage":{"@type":"WebPage","@id":`${SITE_URL}/apt/region/${encodeURIComponent(decoded)}`},"thumbnailUrl":`${SITE_URL}/api/og-square?title=${encodeURIComponent(decoded + ' 부동산')}&category=apt`}) }} />
      {/* JSON-LD: ItemList (주요 단지) */}
      {data.subscriptions.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: `${decoded} 주요 분양 단지`,
        numberOfItems: Math.min(data.subscriptions.length, 10),
        itemListElement: data.subscriptions.slice(0, 10).map((s: any, i: number) => ({
          '@type': 'ListItem', position: i + 1,
          image: `${SITE_URL}/api/og?title=${encodeURIComponent(s.name || '')}&design=2&category=apt`,
          url: `${SITE_URL}/apt/${s.id}`,
          name: s.house_nm,
        })),
      })}} />}
      {/* JSON-LD: FAQ (지역 검색 SERP 아코디언) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
        {"@type":"Question","name":`${decoded} 아파트 청약 일정은?`,"acceptedAnswer":{"@type":"Answer","text":`${decoded} 지역에는 현재 ${data.subscriptions.length}건의 청약이 진행 중입니다. 카더라에서 접수 일정, 경쟁률, 분양가를 실시간으로 확인하세요.`}},
        {"@type":"Question","name":`${decoded} 미분양 아파트 현황은?`,"acceptedAnswer":{"@type":"Answer","text":`${decoded} 지역에는 ${data.unsolds.length}건의 미분양 현장이 있습니다. 할인 분양, 중도금 혜택 등을 비교해보세요.`}},
        {"@type":"Question","name":`${decoded} 재개발 진행 현황은?`,"acceptedAnswer":{"@type":"Answer","text":`${decoded} 지역에서 ${data.redevelopments.length}건의 재개발·재건축 사업이 진행 중입니다. 사업 단계, 조합 현황, 예상 분양 시기를 확인하세요.`}},
        {"@type":"Question","name":`${decoded} 모집공고 확인 방법은?`,"acceptedAnswer":{"@type":"Answer","text":`카더라에서 ${decoded} 지역 아파트 입주자모집공고 핵심 요약, 분양 조건(분양가상한제·전매제한·거주의무), 평형별 공급 정보를 확인할 수 있습니다. 각 현장 상세 페이지에서 모집공고 요약을 제공합니다.`}},
        {"@type":"Question","name":`${decoded} 실거래가 조회 방법은?`,"acceptedAnswer":{"@type":"Answer","text":`카더라에서 ${decoded} 지역 ${data.transactions.length}건의 아파트 실거래가를 조회할 수 있습니다. 단지별, 면적별, 기간별 필터로 원하는 정보를 찾아보세요.`}},
        {"@type":"Question","name":`${decoded} 아파트 평균 시세는?`,"acceptedAnswer":{"@type":"Answer","text":`${decoded} 지역의 최근 실거래 ${data.transactions.length}건을 기준으로 평균 매매가를 확인할 수 있습니다. 카더라 단지백과에서 단지별 상세 시세를 비교해보세요.`}},
        {"@type":"Question","name":`${decoded} 분양중인 아파트는?`,"acceptedAnswer":{"@type":"Answer","text":`현재 ${decoded} 지역에서 분양 진행 중인 현장을 카더라 부동산 페이지에서 확인할 수 있습니다. 분양가, 시공사, 입주 예정일까지 한눈에 비교하세요.`}},
        {"@type":"Question","name":`${decoded} 전세 시세는?`,"acceptedAnswer":{"@type":"Answer","text":`${decoded} 지역 아파트 전세·월세 시세는 카더라 단지백과에서 단지별로 확인할 수 있습니다. 전세가율, 월세 보증금 등 임대차 정보를 제공합니다.`}},
      ]}) }} />
      {/* 헤더 */}
      <div style={{ marginBottom: 'var(--sp-xl)' }}>
        <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-md)' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
          <span>›</span>
          <Link href="/apt" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>부동산</Link>
          <span>›</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{decoded}</span>
        </nav>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/og?title=${encodeURIComponent(decoded + ' 부동산')}&design=2&category=apt&subtitle=${encodeURIComponent('청약·실거래·재개발·미분양')}`} alt={`${decoded} 부동산 정보 — 청약 실거래 재개발 미분양 종합`} width={1200} height={630} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block', borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-md)', border: '1px solid var(--border)' }} loading="lazy" />
        <h1 style={{ margin: '0 0 4px', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>🏙️ {decoded} 부동산 종합</h1>
        <time dateTime={new Date().toISOString()} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date().toLocaleDateString('ko-KR')} 기준</time>
        <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
          청약 {data.subscriptions.length}건 · 실거래 {data.transactions.length}건 · 재개발 {data.redevelopments.length}건 · 미분양 {data.unsolds.length}건
          {(() => { const plc = data.subscriptions.filter((s: any) => s.is_price_limit).length; return plc > 0 ? ` · 분양가상한제 ${plc}건` : ''; })()}
        </p>
        <div style={{ marginTop: 8 }}><ShareButtons title={`${decoded} 부동산 종합 — 카더라`} postId={`region-${decoded}`} /></div>
      </div>

      {/* SEO 가시적 텍스트 */}
      <p className="site-description" style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.7, margin: '0 0 14px', wordBreak: 'keep-all' }}>
        {decoded} 지역의 최신 부동산 정보를 종합 제공합니다. 아파트 청약 모집공고 요약, 실거래가 시세, 재개발·재건축 진행 현황, 미분양 현황을 한눈에 확인하세요.
        {data.subscriptions.length > 0 && ` 현재 ${data.subscriptions.length}건의 청약이 진행 중이며, 입주자모집공고 핵심 정보를 카더라에서 확인할 수 있습니다.`}
      </p>

      {/* 요약 카드 — 시각 대시보드 */}
      <div className="kd-grid-1-2" style={{ gap: 'var(--sp-sm)', marginBottom: 'var(--sp-xl)' }}>
        {/* 현장 유형별 도넛 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {(() => {
            const items = [
              { label: '청약', count: data.subscriptions.length, color: 'var(--accent-blue)' },
              { label: '실거래', count: data.transactions.length, color: 'var(--accent-green)' },
              { label: '재개발', count: data.redevelopments.length, color: '#FB923C' },
              { label: '미분양', count: data.unsolds.length, color: 'var(--accent-red)' },
            ];
            const total = items.reduce((s, i) => s + i.count, 0) || 1;
            let offset = 0;
            return (<>
              <svg viewBox="0 0 80 80" style={{ width: 70, height: 70 }}>
                {items.filter(i => i.count > 0).map((item) => {
                  const pct = (item.count / total) * 100;
                  const dash = (pct / 100) * (2 * Math.PI * 30);
                  const gap = (2 * Math.PI * 30) - dash;
                  const rotation = (offset / 100) * 360 - 90;
                  offset += pct;
                  return <circle key={item.label} cx="40" cy="40" r="30" fill="none" stroke={item.color} strokeWidth="10" strokeDasharray={`${dash} ${gap}`} transform={`rotate(${rotation} 40 40)`} />;
                })}
                <text x="40" y="37" textAnchor="middle" style={{ fontSize: 14, fontWeight: 800, fill: 'var(--text-primary)' }}>{total}</text>
                <text x="40" y="50" textAnchor="middle" style={{ fontSize: 8, fill: 'var(--text-tertiary)' }}>현장</text>
              </svg>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginTop: 6, justifyContent: 'center' }}>
                {items.filter(i => i.count > 0).map(i => (
                  <span key={i.label} style={{ fontSize: 10, color: i.color }}>● {i.label} {i.count}</span>
                ))}
              </div>
            </>);
          })()}
        </div>
        {/* KPI 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 6 }}>
          {[
            { icon: '📋', label: '청약', count: data.subscriptions.length, max: 500, color: 'var(--accent-blue)' },
            { icon: '💰', label: '실거래', count: data.transactions.length, max: 1000, color: 'var(--accent-green)' },
            { icon: '🏗️', label: '재개발', count: data.redevelopments.length, max: 50, color: '#FB923C' },
            { icon: '🏚️', label: '미분양', count: data.unsolds.length, max: 50, color: 'var(--accent-red)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
              <div style={{ fontSize: 16, marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.label}</div>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: s.count > 0 ? s.color : 'var(--text-tertiary)' }}>{s.count}</div>
              <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-hover)', marginTop: 'var(--sp-xs)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((s.count / s.max) * 100, 100)}%`, borderRadius: 2, background: s.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 💰 지역 분양가 현황 */}
      {data.priceStats && (() => {
        const ps = data.priceStats;
        const fmtA = (n: number) => n >= 100000000 ? `${(n / 100000000).toFixed(1)}억` : `${Math.round(n / 10000).toLocaleString()}만`;
        const tradeAmts = data.transactions.map((t: any) => Number(t.deal_amount)).filter((a: number) => a > 0);
        const tradeAvg = tradeAmts.length > 0 ? Math.round(tradeAmts.reduce((s: number, a: number) => s + a, 0) / tradeAmts.length) : 0;
        return (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: '14px', marginBottom: 'var(--sp-lg)' }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>💰 {decoded} 분양가 현황 <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)' }}>{ps.count}개 현장 기준</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: tradeAvg > 0 ? 'repeat(3, minmax(0,1fr))' : 'repeat(2, minmax(0,1fr))', gap: 6 }}>
              <div style={{ background: 'rgba(59,123,246,0.05)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand)' }}>{fmtA(ps.avgMin)}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>평균 최저 분양가</div>
              </div>
              <div style={{ background: 'rgba(248,113,113,0.05)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-red)' }}>{fmtA(ps.avgMax)}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>평균 최고 분양가</div>
              </div>
              {tradeAvg > 0 && (
                <div style={{ background: 'rgba(52,211,153,0.05)', borderRadius: 'var(--radius-sm)', padding: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent-green)' }}>{fmtA(tradeAvg)}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>실거래 평균 ({tradeAmts.length}건)</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              <span>최저 {fmtA(ps.lowestMin)}</span>
              <span>최고 {fmtA(ps.highestMax)}</span>
            </div>
          </div>
        );
      })()}

      {/* 청약 섹션 */}
      {data.subscriptions.length > 0 && (
        <section style={{ marginBottom: 'var(--sp-2xl)' }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📋 최근 청약 {(() => { const plCount = data.subscriptions.filter((s: any) => s.is_price_limit).length; return plCount > 0 ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-purple)', marginLeft: 6 }}>분양가상한제 {plCount}건</span> : null; })()}</h2>
          {data.subscriptions.map((s: any) => (
            <Link key={s.id} href={`/apt/${s.id}`} style={{
              display: 'block', textDecoration: 'none', padding: 'var(--sp-md) var(--card-p)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', marginBottom: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.house_nm}</span>
                {s.is_price_limit && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: 'var(--accent-purple)', flexShrink: 0 }}>상한제</span>}
                {s.brand_name && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: 'rgba(59,123,246,0.08)', color: 'var(--brand)', flexShrink: 0 }}>{s.brand_name}</span>}
                {s.project_type && s.project_type !== '민간' && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: s.project_type === '재개발' ? 'rgba(251,146,60,0.1)' : 'rgba(52,211,153,0.1)', color: s.project_type === '재개발' ? 'var(--accent-orange)' : 'var(--accent-green)', flexShrink: 0 }}>{s.project_type}</span>}
                {s.is_regulated_area && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)', flexShrink: 0 }}>규제</span>}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                {s.constructor_nm ? `${s.constructor_nm} · ` : ''}{s.tot_supply_hshld_co}세대 · ~{s.rcept_endde?.slice(5)}
                {s.loan_rate && <span style={{ marginLeft: 4, fontSize: 9, fontWeight: 600, padding: '1px 4px', borderRadius: 3, background: s.loan_rate.includes('무이자') ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.08)', color: s.loan_rate.includes('무이자') ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>중도금 {s.loan_rate}</span>}
              </div>
              {s.ai_summary && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🤖 {s.ai_summary}</div>}
              {/* 분양가 (house_type_info에서 추출) */}
              {(() => {
                const hti = s.house_type_info;
                if (!hti || !Array.isArray(hti) || hti.length === 0) return null;
                const prices = hti.map((t: any) => t.lttot_top_amount).filter((p: number) => p > 0);
                if (prices.length === 0) return null;
                const pMin = Math.min(...prices);
                const pMax = Math.max(...prices);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', marginTop: 'var(--sp-xs)' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand)' }}>💰 {fmtPrice(pMin)}{pMax !== pMin ? `~${fmtPrice(pMax)}` : ''}</span>
                    {s.price_per_pyeong_avg > 0 && <span style={{ fontSize: 9, color: 'var(--accent-purple)' }}>평당 {s.price_per_pyeong_avg.toLocaleString()}만</span>}
                  </div>
                );
              })()}
            </Link>
          ))}
        </section>
      )}

      {/* 실거래 섹션 */}
      {data.transactions.length > 0 && (
        <section style={{ marginBottom: 'var(--sp-2xl)' }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>💰 최근 실거래</h2>
          {data.transactions.map((t: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 14px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-xs)',
            }}>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{t.apt_name}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{t.deal_date} · {t.exclusive_area}㎡</div>
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-blue)', textAlign: 'right', minWidth: 50 }}>
                {fmtPrice(t.deal_amount)}
                {t.exclusive_area > 0 && t.deal_amount > 0 && (
                  <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 500 }}>평당 {fmtPrice(Math.round(t.deal_amount / (t.exclusive_area / 3.3058)))}</div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 재개발 섹션 */}
      {data.redevelopments.length > 0 && (
        <section style={{ marginBottom: 'var(--sp-2xl)' }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🏗️ 재개발 현황</h2>
          {data.redevelopments.map((r: any) => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-xs)',
            }}>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{r.district_name}</div>
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
        <section style={{ marginBottom: 'var(--sp-2xl)' }}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🏚️ 미분양</h2>
          {data.unsolds.map((u: any) => (
            <div key={u.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-xs)',
            }}>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{u.complex_name}</div>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent-red)' }}>{u.unsold_count}세대</span>
            </div>
          ))}
        </section>
      )}

      {/* SSR 지역 분석 텍스트 — Featured Snippet 타겟 */}
      <section className="region-summary" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>{decoded} 부동산 시장 요약</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          {decoded} 지역에는 현재 청약 {data.subscriptions.length}건, 실거래 {data.transactions.length}건, 재개발·재건축 {data.redevelopments.length}건, 미분양 {data.unsolds.length}건의 부동산 정보가 등록되어 있습니다.
          {data.transactions.length > 0 && ` 최근 실거래 기준 평균 매매가는 ${(() => { const avg = Math.round(data.transactions.reduce((s: number, t: any) => s + (t.deal_amount || 0), 0) / data.transactions.length); return avg >= 10000 ? (avg / 10000).toFixed(1) + '억원' : avg.toLocaleString() + '만원'; })()}이며, 가장 최근 거래는 ${data.transactions[0]?.apt_name || ''} 단지입니다.`}
          {data.redevelopments.length > 0 && ` 재개발·재건축 사업이 ${data.redevelopments.length}건 진행 중이어서 향후 공급 물량이 기대됩니다.`}
          {data.unsolds.length > 0 && ` 미분양 ${data.unsolds.reduce((s: number, u: any) => s + (u.unsold_count || 0), 0)}세대가 남아 있어 할인 분양 기회를 확인해볼 만합니다.`}
          {` 카더라에서 ${decoded} 지역 부동산 정보를 실시간으로 확인하세요.`}
        </p>
      </section>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: 20 }}>
        <Link href="/apt" style={{
          display: 'inline-block', padding: '12px 28px', background: 'var(--brand)',
          color: 'var(--text-inverse)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none',
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
    </article>
  );
}

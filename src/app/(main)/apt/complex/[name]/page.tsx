import { createSupabaseServer } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/constants';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { fmtAmount } from '@/lib/format';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import dynamic from 'next/dynamic';

const AptPriceTrendChart = dynamic(() => import('@/components/charts/AptPriceTrendChart'));
const AptReviewSection = dynamic(() => import('@/components/AptReviewSection'));

export const maxDuration = 30;
export const revalidate = 3600;

interface Props { params: Promise<{ name: string }> }

async function getProfile(decoded: string) {
  const sb = await createSupabaseServer();
  const { data } = await (sb as any).from('apt_complex_profiles')
    .select('*')
    .eq('apt_name', decoded)
    .limit(1)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const p = await getProfile(decoded);

  const region = p?.region_nm || '';
  const sigungu = p?.sigungu || '';
  const ageGroup = p?.age_group || '';
  const salePrice = p?.latest_sale_price ? fmtAmount(p.latest_sale_price) : '';
  const jeonsePrice = p?.latest_jeonse_price ? fmtAmount(p.latest_jeonse_price) : '';

  const title = p?.seo_title || `${decoded} 실거래가·전세·월세 시세 | ${region} ${sigungu} | 카더라`;
  const description = p?.seo_description || `${decoded} 아파트 실거래가 이력, 전세·월세 시세, 평당가 추이, 면적별 비교. 카더라에서 확인하세요.`;
  const ogSubtitle = salePrice ? `매매 ${salePrice}${jeonsePrice ? ` · 전세 ${jeonsePrice}` : ''}` : '실거래가·시세 분석';
  const ogUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(decoded)}&design=2&category=apt&subtitle=${encodeURIComponent(ogSubtitle)}&author=${encodeURIComponent('카더라 부동산팀')}`;
  const ogSquareUrl = `${SITE_URL}/api/og-square?title=${encodeURIComponent(decoded)}&category=apt&subtitle=${encodeURIComponent(ogSubtitle)}`;
  const keywords = [decoded, '실거래가', '시세', '아파트', region, sigungu, ageGroup, '전세', '월세', '매매', '시세조회', '평당가'].filter(Boolean);

  const meta: Metadata = {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/apt/complex/${name}` },
    openGraph: {
      title: `${decoded} 실거래가·시세 | 카더라`,
      description: ogSubtitle + ` — ${region} ${sigungu}`,
      url: `${SITE_URL}/apt/complex/${name}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'article',
      images: [
        { url: ogUrl, width: 1200, height: 630, alt: `${decoded} 아파트 실거래가 시세` },
        { url: ogSquareUrl, width: 630, height: 630, alt: `${decoded} 실거래가` },
      ],
    },
    twitter: { card: 'summary_large_image', title: `${decoded} 실거래가·시세`, description: ogSubtitle },
    other: {
      'naver:written_time': p?.created_at || new Date(Date.now() - 86400000 * 7).toISOString(),
      'naver:updated_time': p?.updated_at || new Date().toISOString(),
      'naver:author': '카더라 부동산팀',
      'naver:site_name': '카더라',
      'og:updated_time': p?.updated_at || new Date().toISOString(),
      'article:section': '부동산',
      'article:tag': keywords.join(','),
      'article:published_time': p?.created_at || new Date(Date.now() - 86400000 * 30).toISOString(),
      'article:modified_time': p?.updated_at || new Date().toISOString(),
      'dg:plink': `${SITE_URL}/apt/complex/${name}`,
    },
  };

  // Geo 메타 (좌표 있을 때)
  if (p?.latitude && p?.longitude) {
    meta.other = {
      ...meta.other,
      'geo.position': `${p.latitude};${p.longitude}`,
      'geo.placename': `${decoded} 아파트`,
      'geo.region': 'KR',
      'ICBM': `${p.latitude}, ${p.longitude}`,
    } as Record<string, string>;
  }

  return meta;
}

export default async function ComplexDetailPage({ params }: Props) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const sb = await createSupabaseServer();

  // 프로필 조회 (좌표, SEO 데이터 포함)
  const profile = await getProfile(decoded);

  const { data: trades } = await sb.from('apt_transactions')
    .select('id, apt_name, region_nm, sigungu, dong, deal_date, deal_amount, exclusive_area, floor, built_year, trade_type')
    .eq('apt_name', decoded)
    .order('deal_date', { ascending: false })
    .limit(200) as { data: Record<string, any>[] | null };

  if (!trades?.length) notFound();

  const region = trades[0].region_nm || '';
  const dong = trades[0].dong || '';
  const sigungu = trades[0].sigungu || '';

  // 관련 블로그
  let relatedBlogs: Record<string, any>[] = [];
  try {
    const searchTerm = sanitizeSearchQuery(decoded.length > 4 ? decoded.slice(0, 4) : decoded, 20);
    const { data: rb } = await sb.from('blog_posts').select('slug,title,view_count,published_at')
      .eq('is_published', true).or(`title.ilike.%${searchTerm}%,title.ilike.%${region.slice(0,2)} 부동산%`)
      .order('view_count', { ascending: false }).limit(3) as { data: Record<string, any>[] | null };
    relatedBlogs = rb || [];
  } catch {}

  // 전월세 데이터
  let rentTrades: Record<string, any>[] = [];
  try {
    const { data: rt } = await (sb as any).from('apt_rent_transactions')
      .select('rent_type, deposit, monthly_rent, deal_date, exclusive_area, floor')
      .eq('apt_name', decoded)
      .order('deal_date', { ascending: false })
      .limit(100);
    rentTrades = rt || [];
  } catch {}

  // 통계 계산
  const amounts = trades.filter(t => t.deal_amount > 0).map(t => t.deal_amount);
  const avgPrice = amounts.length ? Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length) : 0;
  const maxPrice = amounts.length ? Math.max(...amounts) : 0;
  const minPrice = amounts.length ? Math.min(...amounts) : 0;
  const latestPrice = trades.length > 0 ? (trades[0]?.deal_amount || 0) : 0;

  // 전월세 요약
  const latestJeonse = rentTrades.find(r => r.rent_type === 'jeonse');
  const latestMonthly = rentTrades.find(r => r.rent_type === 'monthly');
  const jeonseRatio = latestJeonse && latestPrice > 0 ? Math.round((latestJeonse.deposit / latestPrice) * 100) : null;

  // 면적별 그룹핑
  const areaMap = new Map<string, { count: number; avg: number; trades: Record<string, any>[] }>();
  trades.forEach(t => {
    const area = `${Math.round(t.exclusive_area)}㎡`;
    const cur = areaMap.get(area) || { count: 0, avg: 0, trades: [] };
    cur.count++;
    cur.trades.push(t);
    areaMap.set(area, cur);
  });
  areaMap.forEach((v) => {
    const amts = v.trades.filter((t: Record<string, any>) => t.deal_amount > 0).map((t: Record<string, any>) => t.deal_amount);
    v.avg = amts.length ? Math.round(amts.reduce((s: number, a: number) => s + a, 0) / amts.length) : 0;
  });
  const areaStats = Array.from(areaMap.entries())
    .map(([area, data]) => ({ area, ...data }))
    .sort((a, b) => b.count - a.count);

  // 연도별 평균가 추이
  const yearMap = new Map<string, { sum: number; cnt: number }>();
  trades.forEach(t => {
    if (!t.deal_date || !t.deal_amount) return;
    const ym = t.deal_date.slice(0, 7);
    const cur = yearMap.get(ym) || { sum: 0, cnt: 0 };
    cur.sum += t.deal_amount;
    cur.cnt++;
    yearMap.set(ym, cur);
  });
  const monthlyTrend = [...yearMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ym, d]) => ({ ym, avg: Math.round(d.sum / d.cnt), cnt: d.cnt }));

  const card = 'kd-card';

  const builtYear = trades[0]?.built_year || profile?.built_year || 0;
  const hasCoords = profile?.latitude && profile?.longitude;

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* JSON-LD: Place + GeoCoordinates */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Place',
        name: `${decoded} 아파트`,
        description: `${region} ${sigungu} ${dong} 소재 아파트${builtYear ? ` (${builtYear}년 준공)` : ''}`,
        address: { '@type': 'PostalAddress', addressRegion: region, addressLocality: `${sigungu} ${dong}`, addressCountry: 'KR' },
        ...(hasCoords ? {
          geo: { '@type': 'GeoCoordinates', latitude: Number(profile.latitude), longitude: Number(profile.longitude) },
          hasMap: `https://map.kakao.com/?q=${encodeURIComponent(decoded + ' 아파트')}`,
        } : {}),
        ...(builtYear ? { foundingDate: `${builtYear}` } : {}),
      })}} />

      {/* JSON-LD: Dataset (실거래 데이터셋) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Dataset',
        name: `${decoded} 아파트 실거래가 데이터`,
        description: `${decoded} 아파트의 매매·전세·월세 실거래 데이터 ${trades.length + rentTrades.length}건`,
        url: `${SITE_URL}/apt/complex/${encodeURIComponent(decoded)}`,
        keywords: [decoded, '실거래가', '아파트 시세', region, sigungu],
        creator: { '@type': 'Organization', name: '카더라', url: SITE_URL },
        dateModified: new Date().toISOString(),
        spatialCoverage: { '@type': 'Place', name: `${region} ${sigungu}` },
        temporalCoverage: trades.length > 0 ? `${trades[trades.length-1]?.deal_date || ''}/${trades[0]?.deal_date || ''}` : '',
        distribution: { '@type': 'DataDownload', contentUrl: `${SITE_URL}/apt/complex/${encodeURIComponent(decoded)}`, encodingFormat: 'text/html' },
      })}} />

      {/* JSON-LD: BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '부동산', item: `${SITE_URL}/apt` },
          { '@type': 'ListItem', position: 3, name: '단지백과', item: `${SITE_URL}/apt/complex` },
          { '@type': 'ListItem', position: 4, name: `${region} ${sigungu}`, item: `${SITE_URL}/apt/complex?region=${encodeURIComponent(region)}` },
          { '@type': 'ListItem', position: 5, name: decoded },
        ],
      })}} />

      {/* JSON-LD: FAQPage (SERP 아코디언) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: `${decoded} 최근 실거래가는?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}의 최근 매매가는 ${latestPrice > 0 ? fmtAmount(latestPrice) : '정보 없음'}이며, 평균 ${fmtAmount(avgPrice)}입니다. ${region} ${sigungu} ${dong} 소재${builtYear ? `, ${builtYear}년 준공` : ''}입니다.` } },
          { '@type': 'Question', name: `${decoded} 전세·월세 시세는?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}의 전세가는 ${latestJeonse ? fmtAmount(latestJeonse.deposit) : '정보 없음'}${jeonseRatio ? ` (전세가율 ${jeonseRatio}%)` : ''}이며, 월세는 ${latestMonthly ? `보증금 ${fmtAmount(latestMonthly.deposit)}/월 ${latestMonthly.monthly_rent}만원` : '정보 없음'}입니다.` } },
          { '@type': 'Question', name: `${decoded} 면적별 평당가는?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}에는 ${areaStats.length}개 면적 타입이 있으며, 면적별 평당가와 거래 이력을 카더라에서 비교 분석할 수 있습니다.` } },
          { '@type': 'Question', name: `${decoded} 입주 연차는?`, acceptedAnswer: { '@type': 'Answer', text: builtYear ? `${decoded}은 ${builtYear}년 준공으로 현재 ${2026 - builtYear}년차(${profile?.age_group || ''})입니다.` : `${decoded}의 준공 연도 정보는 확인되지 않았습니다.` } },
        ],
      })}} />

      <nav aria-label="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, flexWrap: 'wrap' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>홈</Link>
        <span>›</span>
        <Link href="/apt" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>부동산</Link>
        <span>›</span>
        <Link href="/apt/complex" style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>단지백과</Link>
        <span>›</span>
        <Link href={`/apt/complex?region=${encodeURIComponent(region)}`} style={{ textDecoration: 'none', color: 'var(--text-tertiary)' }}>{region}</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{decoded}</span>
      </nav>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/og?title=${encodeURIComponent(decoded)}&design=2&category=apt&subtitle=${encodeURIComponent(latestPrice > 0 ? `매매 ${fmtAmount(latestPrice)}${latestJeonse ? ` · 전세 ${fmtAmount(latestJeonse.deposit)}` : ''}` : '실거래가 시세')}&author=${encodeURIComponent('카더라 부동산팀')}`} alt={`${decoded} 아파트 ${region} ${sigungu} 실거래가 시세 ${latestPrice > 0 ? fmtAmount(latestPrice) : ''}`} width={1200} height={630} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 10, marginBottom: 12, border: '1px solid var(--border)' }} loading="eager" />
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{decoded}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <time dateTime={new Date().toISOString()} style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date().toLocaleDateString('ko-KR')} 기준</time>
        {profile?.age_group && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: profile.age_group === '신축' ? 'rgba(59,123,246,0.1)' : 'var(--bg-hover)', color: profile.age_group === '신축' ? 'var(--brand)' : 'var(--text-secondary)' }}>{profile.age_group}</span>}
        {builtYear > 0 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{builtYear}년 준공</span>}
      </div>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: '0 0 16px' }}>{region} {sigungu} {dong} · 매매 {trades.length}건{rentTrades.length > 0 ? ` · 전월세 ${rentTrades.length}건` : ''}</p>

      {/* SEO 가시적 텍스트 (확장) */}
      <section className="site-description" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, wordBreak: 'keep-all' }}>
          {decoded}은 {region} {sigungu} {dong} 소재{builtYear ? ` ${builtYear}년 준공 (${profile?.age_group || ''})` : ''} 아파트입니다.
          {avgPrice > 0 && <> 최근 매매 평균가 {fmtAmount(avgPrice)}, 최고가 {fmtAmount(maxPrice)}, 최저가 {fmtAmount(minPrice)}.</>}
          {latestJeonse && <> 전세가 {fmtAmount(latestJeonse.deposit)}{jeonseRatio ? ` (전세가율 ${jeonseRatio}%)` : ''}.</>}
          {latestMonthly && <> 월세 보증금 {fmtAmount(latestMonthly.deposit)}/월 {latestMonthly.monthly_rent}만원.</>}
          {areaStats.length > 0 && <> {areaStats.length}개 면적 타입에서 {trades.length}건의 거래가 확인됩니다.</>}
        </p>
      </section>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
        {[
          { label: '최근 매매', value: fmtAmount(latestPrice), color: 'var(--text-primary)' },
          { label: '평균 매매', value: fmtAmount(avgPrice), color: 'var(--brand)' },
          { label: '전세', value: latestJeonse ? fmtAmount(latestJeonse.deposit) : '—', color: 'var(--accent-blue)' },
          { label: '월세', value: latestMonthly ? `${fmtAmount(latestMonthly.deposit)}/${latestMonthly.monthly_rent}만` : '—', color: 'var(--accent-orange)' },
          { label: '전세가율', value: jeonseRatio ? `${jeonseRatio}%` : '—', color: jeonseRatio && jeonseRatio > 70 ? 'var(--accent-red)' : 'var(--accent-green)' },
          { label: '최고가', value: fmtAmount(maxPrice), color: 'var(--accent-red)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 📈 월별 평균 시세 추이 — 서버 렌더링 SVG */}
      {monthlyTrend.length >= 3 && (() => {
        const data = monthlyTrend.slice(-12);
        const maxVal = Math.max(...data.map(d => d.avg));
        const minVal = Math.min(...data.map(d => d.avg));
        const range = maxVal - minVal || 1;
        const w = 100; const h = 40;
        const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d.avg - minVal) / range) * (h - 4) - 2}`).join(' ');
        const lastAvg = data[data.length - 1].avg;
        const firstAvg = data[0].avg;
        const trendPct = Math.round(((lastAvg - firstAvg) / firstAvg) * 100);
        return (
          <div className={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>📈 월별 시세 추이</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: trendPct > 0 ? '#F87171' : trendPct < 0 ? '#60A5FA' : 'var(--text-tertiary)', background: trendPct > 0 ? 'rgba(248,113,113,0.1)' : trendPct < 0 ? 'rgba(96,165,250,0.1)' : 'var(--bg-hover)', padding: '2px 8px', borderRadius: 6 }}>
                {trendPct > 0 ? '▲' : trendPct < 0 ? '▼' : '━'} {Math.abs(trendPct)}% ({data.length}개월)
              </span>
            </div>
            <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 80 }} preserveAspectRatio="none">
              <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={trendPct >= 0 ? '#F87171' : '#60A5FA'} stopOpacity="0.2" /><stop offset="100%" stopColor={trendPct >= 0 ? '#F87171' : '#60A5FA'} stopOpacity="0" /></linearGradient></defs>
              <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#trendFill)" />
              <polyline points={pts} fill="none" stroke={trendPct >= 0 ? '#F87171' : '#60A5FA'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
              <span>{data[0].ym}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>최근 {fmtAmount(lastAvg)}</span>
              <span>{data[data.length - 1].ym}</span>
            </div>
          </div>
        );
      })()}

      {/* 면적별 비교 */}
      {areaStats.length > 1 && (() => {
        const maxAvg = Math.max(...areaStats.map(a => a.avg));
        return (
        <div className={card}>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, margin: '0 0 12px' }}>📐 면적별 비교</h2>
          {/* 수평 바 차트 */}
          <div style={{ marginBottom: 12 }}>
            {areaStats.slice(0, 6).map((a, i) => (
              <div key={a.area} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', minWidth: 42 }}>{a.area}</span>
                <div style={{ flex: 1, height: 18, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: `${maxAvg > 0 ? (a.avg / maxAvg) * 100 : 0}%`, borderRadius: 4, background: `hsl(${210 + i * 15}, 65%, ${55 + i * 3}%)` }} />
                  <span style={{ position: 'absolute', right: 6, top: 2, fontSize: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtAmount(a.avg)}</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', minWidth: 24, textAlign: 'right' }}>{a.count}건</span>
              </div>
            ))}
          </div>
          {/* 카드 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {areaStats.slice(0, 8).map(a => (
              <div key={a.area} style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{a.area}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>평균 {fmtAmount(a.avg)}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{a.count}건</div>
                {a.trades[0]?.exclusive_area > 0 && a.avg > 0 && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-blue)', fontWeight: 600, marginTop: 2 }}>
                    평당 {fmtAmount(Math.round(a.avg / (a.trades[0].exclusive_area / 3.3058)))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>);
      })()}

      {/* 가격 추이 차트 */}
      <AptPriceTrendChart aptName={decoded} region={region} />

      {/* 거래 이력 */}
      <div className={card}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📋 거래 이력 ({trades.length}건)</div>
        {trades.slice(0, 50).map((t, i) => {
          const amt = t.deal_amount || 0;
          const color = amt >= 100000 ? 'var(--accent-red)' : amt >= 50000 ? 'var(--accent-orange)' : 'var(--accent-green)';
          return (
            <div key={t.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' }}>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>{t.deal_date}</span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{t.exclusive_area}㎡ · {t.floor}층</span>
              </div>
              <span style={{ fontWeight: 700, color }}>{fmtAmount(amt)}</span>
            </div>
          );
        })}
        {trades.length > 50 && (
          <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
            +{trades.length - 50}건 더 있음
          </div>
        )}
      </div>

      {/* 전월세 거래 이력 */}
      {rentTrades.length > 0 && (
        <div className={card}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🏠 전월세 이력 ({rentTrades.length}건)</div>
          {rentTrades.slice(0, 30).map((r, i) => {
            const isJeonse = r.rent_type === 'jeonse';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-sm)' }}>
                <div>
                  <span style={{ color: 'var(--text-tertiary)' }}>{r.deal_date}</span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{r.exclusive_area}㎡ · {r.floor}층</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                    background: isJeonse ? 'rgba(96,165,250,0.1)' : 'rgba(251,146,60,0.1)',
                    color: isJeonse ? '#60A5FA' : '#FB923C',
                  }}>{isJeonse ? '전세' : '월세'}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {fmtAmount(r.deposit)}{!isJeonse && r.monthly_rent > 0 ? `/${r.monthly_rent}만` : ''}
                  </span>
                </div>
              </div>
            );
          })}
          {rentTrades.length > 30 && (
            <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
              +{rentTrades.length - 30}건 더 있음
            </div>
          )}
        </div>
      )}

      {/* 주민 리뷰 */}
      <AptReviewSection aptName={decoded} region={region} />

      {/* 외부 링크 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <a href={`https://map.kakao.com/?q=${encodeURIComponent(decoded + ' ' + dong)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 카카오맵</a>
        <a href={`https://map.naver.com/p/search/${encodeURIComponent(decoded + ' ' + dong)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🗺️ 네이버지도</a>
        <Link href={`/apt/search?q=${encodeURIComponent(decoded)}`} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>🔍 실거래 검색</Link>
      </div>

      {/* 관련 블로그 */}
      {relatedBlogs.length > 0 && (
        <div className={card}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>📰 관련 분석</div>
          {relatedBlogs.map((b: Record<string, any>) => (
            <Link key={b.slug} href={`/blog/${b.slug}`} className="kd-feed-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px', borderRadius: 6, transition: 'background var(--transition-fast)', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8 }}>👀 {b.view_count || 0}</span>
            </Link>
          ))}
        </div>
      )}

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '16px 0 8px' }}>
        📊 국토교통부 실거래가 공개시스템 기준
      </p>

      {/* 현장 허브 페이지 링크 */}
      <Link href={`/apt/search?q=${encodeURIComponent(decoded)}`} style={{
        display: 'block', textAlign: 'center', padding: '14px', marginBottom: 40,
        borderRadius: 12, background: 'var(--brand-bg)', border: '1px solid var(--brand-border)',
        color: 'var(--brand)', fontSize: 'var(--fs-sm)', fontWeight: 700, textDecoration: 'none',
      }}>
        🏗️ 이 현장의 전체 정보 보기 (청약 · 재개발 · 리뷰) →
      </Link>
    </article>
  );
}

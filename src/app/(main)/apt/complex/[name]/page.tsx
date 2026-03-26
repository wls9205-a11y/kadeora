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

export const revalidate = 3600;

interface Props { params: Promise<{ name: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  return {
    title: `${decoded} 실거래가·시세 분석`,
    description: `${decoded} 아파트 실거래가 이력, 평당가 추이, 면적별 비교. 최근 거래 내역과 시세 변동을 카더라에서 확인하세요.`,
    alternates: { canonical: `${SITE_URL}/apt/complex/${name}` },
    openGraph: {
      title: `${decoded} 실거래가·시세`,
      description: `실거래 이력, 평당가 추이, 면적별 비교 분석`,
      url: `${SITE_URL}/apt/complex/${name}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'article',
      images: [{ url: `${SITE_URL}/api/og?title=${encodeURIComponent(decoded)}&subtitle=${encodeURIComponent('실거래가·시세 분석')}`, width: 1200, height: 630, alt: `${decoded} 실거래가` }],
    },
    twitter: { card: 'summary_large_image' as const, title: `${decoded} 실거래가`, description: `실거래 이력·평당가 추이·면적별 비교` },
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString(),
      'article:section': '부동산',
      'article:tag': `${decoded},실거래가,시세,아파트,부동산`, 'dg:plink': `${SITE_URL}/apt/complex/${name}`,
    },
  };
}

export default async function ComplexDetailPage({ params }: Props) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const sb = await createSupabaseServer();

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

  // 통계 계산
  const amounts = trades.filter(t => t.deal_amount > 0).map(t => t.deal_amount);
  const avgPrice = amounts.length ? Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length) : 0;
  const maxPrice = amounts.length ? Math.max(...amounts) : 0;
  const minPrice = amounts.length ? Math.min(...amounts) : 0;
  const latestPrice = trades[0].deal_amount || 0;

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

  const card = 'kd-card';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Place',
        name: `${decoded} 아파트`,
        address: { '@type': 'PostalAddress', addressRegion: region, addressLocality: `${sigungu} ${dong}`, addressCountry: 'KR' },
      })}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: '실거래 검색', item: `${SITE_URL}/apt/search` },
          { '@type': 'ListItem', position: 3, name: decoded },
        ],
      })}} />
      {/* FAQ JSON-LD (SERP 아코디언) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: `${decoded} 최근 실거래가는?`, acceptedAnswer: { '@type': 'Answer', text: `${decoded}의 최근 ${trades.length}건 실거래 내역을 카더라에서 확인할 수 있습니다. ${region} ${sigungu} ${dong} 소재입니다.` } },
          { '@type': 'Question', name: `${decoded} 시세 조회 방법은?`, acceptedAnswer: { '@type': 'Answer', text: `카더라(kadeora.app)에서 ${decoded}의 면적별, 기간별 실거래 내역과 평당가 추이를 무료로 조회할 수 있습니다.` } },
        ],
      })}} />

      <Link href="/apt/search" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 실거래 검색</Link>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 4px' }}>{decoded}</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: '0 0 16px' }}>{region} {sigungu} {dong} · 거래 {trades.length}건</p>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: '최근 거래가', value: fmtAmount(latestPrice), color: 'var(--text-primary)' },
          { label: '평균', value: fmtAmount(avgPrice), color: 'var(--brand)' },
          { label: '최고가', value: fmtAmount(maxPrice), color: 'var(--accent-red)' },
          { label: '최저가', value: fmtAmount(minPrice), color: 'var(--accent-blue)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 면적별 비교 */}
      {areaStats.length > 1 && (
        <div className={card}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📐 면적별 비교</div>
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
        </div>
      )}

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
    </div>
  );
}

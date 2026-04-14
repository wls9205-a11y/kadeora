import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { fmtAmount } from '@/lib/format';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: '아파트 실거래가 검색',
  description: '전국 아파트 실거래가를 검색하세요. 단지명, 지역, 면적별 실거래 조회. 카더라에서 최신 거래 내역을 확인하세요.',
  openGraph: {
    title: '아파트 실거래가 검색',
    description: '전국 아파트 실거래가 조회 — 단지명·지역·면적별 검색',
    url: SITE_URL + '/apt/search',
    siteName: '카더라',
    locale: 'ko_KR',
    type: 'website',
    images: [
      { url: `${SITE_URL}/api/og?title=${encodeURIComponent('실거래가 검색')}&design=2&subtitle=${encodeURIComponent('전국 아파트 단지별 조회')}`, width: 1200, height: 630, alt: '카더라 실거래가 검색' },
      { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent('실거래가 검색')}&category=apt`, width: 630, height: 630 },
    ],
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: SITE_URL + '/apt/search' },
  robots: { index: true, follow: true, 'max-snippet': -1 as const, 'max-image-preview': 'large' as const },
  other: { 'naver:written_time': new Date().toISOString(), 'naver:updated_time': new Date().toISOString(), 'naver:author': '카더라', 'naver:description': '전국 아파트 실거래가 검색', 'og:updated_time': new Date().toISOString(), 'article:section': '부동산', 'article:tag': '실거래가,아파트,시세,매매,검색,부동산', 'dg:plink': SITE_URL + '/apt/search' },
};

export const revalidate = 300;

interface Props { searchParams: Promise<{ q?: string; region?: string; area?: string; page?: string }> }

export default async function AptSearchPage({ searchParams }: Props) {
  const { q = '', region = '', area = '', page = '1' } = await searchParams;
  const pageNum = Math.max(1, parseInt(page));
  const perPage = 30;

  const sb = await createSupabaseServer();

  let query = sb.from('apt_transactions')
    .select('id, apt_name, region_nm, sigungu, dong, deal_date, deal_amount, exclusive_area, floor, built_year, trade_type', { count: 'exact' })
    .order('deal_date', { ascending: false });

  if (q) { const sq = sanitizeSearchQuery(q, 100); if (sq) query = query.or(`apt_name.ilike.%${sq}%,dong.ilike.%${sq}%,sigungu.ilike.%${sq}%`); }
  if (region) query = query.ilike('region_nm', `%${region}%`);
  if (area === 'small') query = query.lte('exclusive_area', 60);
  else if (area === 'mid') query = query.gt('exclusive_area', 60).lte('exclusive_area', 85);
  else if (area === 'large') query = query.gt('exclusive_area', 85);

  query = query.range((pageNum - 1) * perPage, pageNum * perPage - 1);
  const { data: trades, count } = await query;

  // 인기 지역
  let regionStats: any[] = [];
  try {
    const { data: rs } = await sb.rpc('get_trade_region_stats');
    regionStats = rs || [];
  } catch {}

  // 관련 블로그
  let relatedBlogs: any[] = [];
  if (q && q.length >= 2) {
    try {
      const { data } = await sb.from('blog_posts')
        .select('slug, title, category, view_count')
        .eq('is_published', true)
        .ilike('title', `%${q}%`)
        .order('view_count', { ascending: false })
        .limit(3);
      relatedBlogs = data || [];
    } catch {}
  }

  const totalCount = count || 0;
  const hasMore = (trades?.length || 0) === perPage;

  return (
    <>      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "아파트 청약 검색은 어떻게 하나요?", acceptedAnswer: { "@type": "Answer", text: "카더라 부동산 검색에서 아파트명, 지역, 시공사로 청약 일정을 검색할 수 있습니다." } }] }) }} />

    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '부동산', item: SITE_URL + '/apt' }, { '@type': 'ListItem', position: 3, name: '실거래 검색' }] }) }} />
      <Link href="/apt" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 부동산</Link>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 4px' }}>🔍 실거래가 검색</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: '0 0 8px' }}>전국 {totalCount.toLocaleString()}건의 실거래 데이터</p>
      <div style={{ marginBottom: 12 }}><ShareButtons title="아파트 실거래가 검색 — 카더라" contentType="page" contentRef="apt-search" /></div>

      {/* 검색 폼 */}
      <form method="GET" action="/apt/search" style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 'var(--sp-lg)', position: 'relative' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input name="q" defaultValue={q} placeholder="단지명, 동 검색" aria-label="실거래가 검색"
            style={{ width: '100%', height: 40, padding: '0 12px 0 38px', fontSize: 13, fontWeight: 500, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }} />
        </div>
        <button type="submit" style={{ padding: '0 20px', height: 40, borderRadius: 'var(--radius-md)', background: 'var(--brand)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>검색</button>
      </form>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-lg)', flexWrap: 'wrap' }}>
        {[
          { key: '', label: '전체 면적' },
          { key: 'small', label: '소형 (~60㎡)' },
          { key: 'mid', label: '중형 (60~85㎡)' },
          { key: 'large', label: '대형 (85㎡~)' },
        ].map(f => (
          <Link key={f.key} href={`/apt/search?${q ? `q=${q}&` : ''}${region ? `region=${region}&` : ''}${f.key ? `area=${f.key}` : ''}`} style={{
            padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: 600,
            background: area === f.key ? 'var(--brand)' : 'var(--bg-hover)',
            color: area === f.key ? 'var(--text-inverse)' : 'var(--text-secondary)',
            textDecoration: 'none', border: 'none',
          }}>{f.label}</Link>
        ))}
      </div>

      {/* 인기 지역 (검색어 없을 때) */}
      {!q && regionStats && (
        <div style={{ marginBottom: 'var(--sp-lg)' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>인기 지역</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {regionStats.slice(0, 10).map((r: any) => (
              <Link key={r.region_nm} href={`/apt/search?region=${r.region_nm}`} style={{
                padding: '4px 10px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-xs)', fontWeight: 500,
                background: region === r.region_nm ? 'var(--brand)' : 'var(--bg-surface)',
                color: region === r.region_nm ? 'var(--text-inverse)' : 'var(--text-secondary)',
                textDecoration: 'none', border: '1px solid var(--border)',
              }}>{r.region_nm} ({r.cnt}건)</Link>
            ))}
          </div>
        </div>
      )}

      {/* 결과 */}
      {q && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-md)' }}>&quot;{q}&quot; 검색 결과 {totalCount.toLocaleString()}건</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
        {(trades || []).map((t: any) => {
          const amt = t.deal_amount || 0;
          const color = amt >= 100000 ? 'var(--accent-red)' : amt >= 50000 ? 'var(--accent-orange)' : 'var(--accent-green)';
          return (
            <Link key={t.id} href={`/apt/complex/${encodeURIComponent(t.apt_name)}`} className="kd-card-hover" style={{ display: 'block', padding: '12px 16px', borderRadius: 'var(--radius-card)', background: 'var(--bg-surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-xs)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>{t.apt_name}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {t.region_nm} {t.sigungu} {t.dong} · 전용 {t.exclusive_area}㎡ · {t.floor}층{t.built_year ? ` · ${t.built_year}년식` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color }}>{fmtAmount(amt)}</div>
                  {t.exclusive_area > 0 && amt > 0 && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>평당 {fmtAmount(Math.round(amt / (t.exclusive_area / 3.3058)))}</div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', paddingTop: 4, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
                <span>📅 {t.deal_date} · {t.trade_type || '매매'}</span>
                <div style={{ flex: 1, height: 3, borderRadius: 4, background: 'var(--bg-hover)', overflow: 'hidden', maxWidth: 100 }}>
                  <div style={{ height: '100%', width: `${Math.min(amt / 1500 , 100)}%`, borderRadius: 4, background: color, opacity: 0.6 }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {(trades || []).length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: 48, marginBottom: 'var(--sp-md)' }}>{q ? '🔍' : '🏠'}</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)' }}>
            {q ? `"${q}" 검색 결과가 없습니다` : '실거래가를 검색하세요'}
          </div>
          <div style={{ fontSize: 'var(--fs-sm)' }}>
            {q ? '다른 단지명이나 동 이름으로 시도해보세요' : '단지명, 동 이름으로 검색하면 실거래 이력을 확인할 수 있어요'}
          </div>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalCount > perPage && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-sm)', marginTop: 'var(--sp-xl)', marginBottom: 40 }}>
          {pageNum > 1 && (
            <Link href={`/apt/search?${q ? `q=${q}&` : ''}${region ? `region=${region}&` : ''}${area ? `area=${area}&` : ''}page=${pageNum - 1}`}
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-sm)' }}>← 이전</Link>
          )}
          <span style={{ padding: '8px 16px', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{pageNum} / {Math.ceil(totalCount / perPage)}</span>
          {hasMore && (
            <Link href={`/apt/search?${q ? `q=${q}&` : ''}${region ? `region=${region}&` : ''}${area ? `area=${area}&` : ''}page=${pageNum + 1}`}
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-sm)' }}>다음 →</Link>
          )}
        </div>
      )}

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textAlign: 'center', margin: '20px 0' }}>
        📊 국토교통부 실거래가 공개시스템 기준
      </p>

      {/* 관련 블로그 */}
      {relatedBlogs.length > 0 && (
        <div style={{ marginTop: 'var(--sp-lg)', padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginBottom: 'var(--sp-lg)' }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>📰 관련 분석 글</div>
          {relatedBlogs.map((b: any) => (
            <Link key={b.slug} href={`/blog/${b.slug}`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 4px', borderBottom: '1px solid var(--border)',
              textDecoration: 'none', color: 'inherit', fontSize: 13,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{b.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8 }}>👀 {b.view_count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 지역별 부동산 내부 링크 (SEO) */}
      <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginBottom: 'var(--sp-xl)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>🏙️ 지역별 부동산 정보</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'].map(r => (
            <Link key={r} href={`/apt/region/${encodeURIComponent(r)}`} style={{
              padding: '4px 10px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-xs)', fontWeight: 500,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none',
              border: '1px solid var(--border)',
            }}>{r}</Link>
          ))}
        </div>
      </div>
    </div>
  
    </>);
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';
import EmptyState from '@/components/EmptyState';
import { sanitizeSearchQuery } from '@/lib/sanitize';

export const revalidate = 300;

import { SITE_URL as SITE } from '@/lib/constants';

const CAT_META: Record<string, { title: string; desc: string }> = {
  all: { title: '블로그 — 주식·청약·부동산 정보', desc: '코스피 코스닥 시세, 아파트 청약 일정, 미분양 현황, 재테크 정보를 매일 업데이트합니다.' },
  stock: { title: '주식 블로그 — 코스피·코스닥 시황 분석', desc: '매일 업데이트되는 코스피 코스닥 시황, 급등락 종목 분석, 섹터별 동향 정보.' },
  apt: { title: '청약 블로그 — 아파트 청약 일정·분석', desc: '전국 아파트 청약 일정, 분양가 분석, 당첨 전략 등 청약 정보를 매일 제공합니다.' },
  unsold: { title: '미분양 블로그 — 전국 미분양 현황·분석', desc: '전국 미분양 아파트 현황, 투자 분석, 할인 분양 정보를 월간 업데이트합니다.' },
  finance: { title: '재테크 블로그 — 투자·절약·자산관리', desc: '재테크 기본 원칙부터 실전 투자 전략까지, 자산 관리 정보를 제공합니다.' },
  general: { title: '생활 정보 블로그 — 우리동네 소식', desc: '알아두면 유용한 생활 정보, 동네 소식, 정책 변경 사항을 안내합니다.' },
};

const SUB_CATS: Record<string, { key: string; label: string }[]> = {
  stock: [
    { key: 'market', label: '시황' },
    { key: 'analysis', label: '종목분석' },
    { key: 'theme', label: '테마' },
    { key: 'weekly', label: '주간리뷰' },
  ],
  apt: [
    { key: 'subscription', label: '청약' },
    { key: 'trade', label: '실거래' },
    { key: 'redev', label: '재개발' },
    { key: 'competition', label: '경쟁률' },
    { key: 'guide', label: '가이드' },
  ],
  unsold: [
    { key: 'trend', label: '추이' },
    { key: 'region', label: '지역별' },
  ],
  finance: [
    { key: 'saving', label: '저축' },
    { key: 'tax', label: '세금' },
    { key: 'invest', label: '투자' },
  ],
};

interface PageProps { searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string; sub?: string }> }

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { category = 'all', page = '1', q } = await searchParams;
  const meta = CAT_META[category] || CAT_META.all;
  const pageNum = parseInt(page) || 1;
  const suffix = pageNum > 1 ? ` (${pageNum}페이지)` : '';
  const qSuffix = q ? ` — "${q}" 검색` : '';

  const canonical = category === 'all' && pageNum === 1 && !q
    ? `${SITE}/blog`
    : `${SITE}/blog?${category !== 'all' ? `category=${category}&` : ''}${pageNum > 1 ? `page=${pageNum}` : ''}`.replace(/&$/, '');

  return {
    title: `${meta.title}${suffix}${qSuffix}`,
    description: meta.desc,
    alternates: { canonical },
    openGraph: { title: meta.title, description: meta.desc, url: canonical, siteName: '카더라', locale: 'ko_KR', type: 'website', images: [{ url: `${SITE}/api/og?title=${encodeURIComponent(meta.title)}&category=blog`, width: 1200, height: 630, alt: meta.title }] },
    twitter: { card: 'summary_large_image' as const, title: meta.title, description: meta.desc },
    ...(pageNum > 1 ? { robots: { index: false, follow: true } } : {}),
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString(),
      'dg:plink': `${SITE}/blog`,
      'article:section': category === 'all' ? '블로그' : (CAT_META[category]?.title?.split('—')[0]?.trim() || '블로그'),
      'article:tag': '블로그,주식,청약,부동산,미분양,재테크',
    },
  };
}

const CATS = [
  { key: 'all', label: '전체', icon: '📋' },
  { key: 'stock', label: '주식', icon: '📈' },
  { key: 'apt', label: '청약', icon: '🏠' },
  { key: 'unsold', label: '미분양', icon: '🏚️' },
  { key: 'finance', label: '재테크', icon: '💰' },
  { key: 'general', label: '생활', icon: '📰' },
];

const CAT_COLORS: Record<string, string> = {
  stock: 'var(--accent-blue)', apt: 'var(--accent-green)', unsold: 'var(--accent-orange)', finance: 'var(--accent-purple)', general: 'var(--text-tertiary)',
};

interface Props { searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string; sub?: string }> }

export default async function BlogPage({ searchParams }: Props) {
  const { category = 'all', sort = 'latest', q = '', page = '1', sub = '' } = await searchParams;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const perPage = 20;
  const sb = await createSupabaseServer();

  // 카테고리별 건수 (단일 RPC로 5개 쿼리 → 1개)
  const { data: catCountsRaw } = await sb.rpc('blog_category_counts');
  const countMap: Record<string, number> = { all: 0 };
  (catCountsRaw || []).forEach((c: any) => { countMap[c.category] = Number(c.cnt); countMap.all += Number(c.cnt); });
  const totalCount = countMap.all;

  // 인기글 (최근 30일 내 조회수 TOP 5)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: popularPosts } = await sb.from('blog_posts')
    .select('id, slug, title, category, view_count, cover_image')
    .eq('is_published', true)
    .gte('created_at', thirtyDaysAgo)
    .order('view_count', { ascending: false })
    .limit(5);

  // 오늘의 추천 (카테고리별 최신 1편씩)
  let todayPicks: any[] = [];
  if (pageNum === 1 && !q && category === 'all') {
    try {
      const picks = await Promise.all(
        ['stock', 'apt', 'unsold', 'finance'].map(async (cat) => {
          const { data } = await sb.from('blog_posts')
            .select('id, slug, title, category, view_count, created_at')
            .eq('is_published', true).eq('category', cat)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
          return data;
        })
      );
      todayPicks = picks.filter(Boolean);
    } catch {}
  }

  // 인기 태그
  let popularTags: { tag: string; cnt: number }[] = [];
  if (pageNum === 1 && !q) {
    try {
      const { data: tagData } = await sb.rpc('blog_popular_tags', { limit_count: 20 });
      popularTags = tagData || [];
    } catch {}
  }

  // 메인 쿼리
  const now = new Date().toISOString();
  let q2 = sb.from('blog_posts')
    .select('id, slug, title, excerpt, category, sub_category, tags, created_at, view_count, cover_image, image_alt, published_at, reading_time_min, comment_count, helpful_count, rewritten_at')
    .eq('is_published', true)
    .or(`published_at.is.null,published_at.lte.${now}`);
  if (category !== 'all') q2 = q2.eq('category', category);
  if (sub) q2 = q2.eq('sub_category', sub);
  if (q) { const sq = sanitizeSearchQuery(q, 100); if (sq) q2 = q2.or(`title.ilike.%${sq}%,excerpt.ilike.%${sq}%`); }
  if (sort === 'popular') {
    q2 = q2.order('view_count', { ascending: false });
  } else {
    q2 = q2.order('created_at', { ascending: false });
  }
  q2 = q2.range((pageNum - 1) * perPage, pageNum * perPage - 1);
  const { data: posts, count: filteredCount } = await q2;

  // 다음 페이지 미리보기
  let nextPagePosts: any[] = [];
  try {
    let nq = sb.from('blog_posts')
      .select('id, slug, title, category')
      .eq('is_published', true)
      .or(`published_at.is.null,published_at.lte.${now}`);
    if (category !== 'all') nq = nq.eq('category', category);
    if (sub) nq = nq.eq('sub_category', sub);
    if (sort === 'popular') nq = nq.order('view_count', { ascending: false });
    else nq = nq.order('created_at', { ascending: false });
    nq = nq.range(pageNum * perPage, pageNum * perPage + 4);
    const { data: np } = await nq;
    nextPagePosts = np || [];
  } catch {}

  const hasMore = (posts ?? []).length === perPage;

  // 인기 시리즈 (1페이지, 카테고리 전체일 때만)
  let topSeries: any[] = [];
  if (pageNum === 1 && category === 'all') {
    try {
      const { data } = await sb.from('blog_series')
        .select('slug, title, post_count, cover_image')
        .eq('is_active', true)
        .gt('post_count', 10)
        .order('post_count', { ascending: false })
        .limit(5);
      topSeries = data || [];
    } catch {}
  }

  const catLabel = CATS.find(c => c.key === category)?.label || '전체';
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE },
      { '@type': 'ListItem', position: 2, name: '블로그', item: SITE + '/blog' },
      ...(category !== 'all' ? [{ '@type': 'ListItem', position: 3, name: catLabel }] : []),
    ],
  };

  const itemListLd = (posts ?? []).length > 0 ? {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `카더라 블로그 — ${catLabel}`,
    numberOfItems: (posts ?? []).length,
    itemListElement: (posts ?? []).slice(0, 10).map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1 + (pageNum - 1) * perPage,
      url: `${SITE}/blog/${p.slug}`,
      name: p.title,
    })),
  } : null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
      {/* JSON-LD: FAQPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: '카더라 블로그란?', acceptedAnswer: { '@type': 'Answer', text: '카더라 블로그는 주식 시황, 아파트 청약, 미분양, 재테크 등 금융·부동산 정보를 매일 업데이트하는 데이터 기반 블로그입니다.' } },
          { '@type': 'Question', name: '카더라 블로그는 무료인가요?', acceptedAnswer: { '@type': 'Answer', text: '네, 카더라 블로그의 모든 분석 글은 무료로 읽을 수 있습니다. 카카오 로그인 시 댓글, 도움돼요, 관심글 저장 기능도 이용 가능합니다.' } },
          { '@type': 'Question', name: '카더라 블로그 글은 얼마나 자주 올라오나요?', acceptedAnswer: { '@type': 'Answer', text: '주식 시황과 청약 분석은 매일, 미분양 현황은 월간, 재테크 정보는 주 1~2회 업데이트됩니다. RSS 구독으로 새 글 알림을 받을 수 있습니다.' } },
        ],
      })}} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📝 블로그</h1>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{totalCount.toLocaleString()}편</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 10px' }}>매일 업데이트되는 투자 정보</p>

      {/* 검색 */}
      <form action="/blog" method="GET" style={{ marginBottom: 10 }}>
        {category !== 'all' && <input type="hidden" name="category" value={category} />}
        {sort !== 'latest' && <input type="hidden" name="sort" value={sort} />}
        <input name="q" defaultValue={q} placeholder="블로그 검색..." style={{
          width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-surface)',
          color: 'var(--text-primary)', boxSizing: 'border-box',
        }} />
      </form>

      {/* 카테고리 탭 + 건수 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {CATS.map(c => (
          <Link key={c.key} href={`/blog${c.key !== 'all' ? `?category=${c.key}` : ''}${sort !== 'latest' ? `${c.key !== 'all' ? '&' : '?'}sort=${sort}` : ''}${q ? `${c.key !== 'all' || sort !== 'latest' ? '&' : '?'}q=${q}` : ''}`}
            style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 'var(--fs-sm)', fontWeight: category === c.key ? 700 : 500,
              background: category === c.key ? 'var(--text-primary)' : 'var(--bg-surface)',
              color: category === c.key ? 'var(--bg-base, #fff)' : 'var(--text-secondary)',
              textDecoration: 'none', flexShrink: 0, border: category === c.key ? 'none' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <span>{c.icon}</span> {c.label}
            <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.7 }}>({countMap[c.key] || 0})</span>
          </Link>
        ))}
        <Link href="/blog/series" style={{
          padding: '7px 14px', borderRadius: 999, fontSize: 'var(--fs-sm)', fontWeight: 500,
          background: 'var(--bg-surface)', color: 'var(--accent-blue)',
          textDecoration: 'none', flexShrink: 0, border: '1px solid var(--accent-blue)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          📚 시리즈
        </Link>
      </div>

      {/* 서브카테고리 칩 */}
      {category !== 'all' && SUB_CATS[category] && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <Link href={`/blog?category=${category}${sort !== 'latest' ? `&sort=${sort}` : ''}${q ? `&q=${q}` : ''}`}
            style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: !sub ? 700 : 500,
              background: !sub ? 'var(--brand)' : 'var(--bg-hover)',
              color: !sub ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              textDecoration: 'none', flexShrink: 0, border: 'none',
            }}>
            전체
          </Link>
          {SUB_CATS[category].map(sc => (
            <Link key={sc.key} href={`/blog?category=${category}&sub=${sc.key}${sort !== 'latest' ? `&sort=${sort}` : ''}${q ? `&q=${q}` : ''}`}
              style={{
                padding: '4px 12px', borderRadius: 999, fontSize: 'var(--fs-xs)', fontWeight: sub === sc.key ? 700 : 500,
                background: sub === sc.key ? 'var(--brand)' : 'var(--bg-hover)',
                color: sub === sc.key ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                textDecoration: 'none', flexShrink: 0, border: 'none',
              }}>
              {sc.label}
            </Link>
          ))}
        </div>
      )}

      {/* 정렬 토글 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { key: 'latest', label: '🕐 최신순' },
          { key: 'popular', label: '🔥 인기순' },
        ].map(s => (
          <Link key={s.key} href={`/blog?${category !== 'all' ? `category=${category}&` : ''}sort=${s.key}${q ? `&q=${q}` : ''}`}
            style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 'var(--fs-sm)', fontWeight: 600,
              background: sort === s.key ? 'var(--brand)' : 'var(--bg-hover)',
              color: sort === s.key ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              textDecoration: 'none', border: 'none',
            }}>
            {s.label}
          </Link>
        ))}
      </div>

      {/* 오늘의 추천 */}
      {pageNum === 1 && !q && category === 'all' && todayPicks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>✨ 오늘의 추천</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {todayPicks.map((p: any) => {
              const catEmoji: Record<string, string> = { stock: '📈', apt: '🏢', unsold: '🏚️', finance: '💰' };
              const catLabel: Record<string, string> = { stock: '주식', apt: '청약', unsold: '미분양', finance: '재테크' };
              return (
                <Link key={p.id} href={`/blog/${p.slug}`} style={{
                  flexShrink: 0, width: 180, padding: '12px 14px', borderRadius: 12,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  textDecoration: 'none', color: 'inherit',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{catEmoji[p.category] || '📝'}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: CAT_COLORS[p.category] || 'var(--text-tertiary)', marginBottom: 4 }}>{catLabel[p.category] || p.category}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, lineHeight: 1.35 }}>{p.title}</div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 인기글 하이라이트 (첫 페이지, 검색 아닐 때) */}
      {pageNum === 1 && !q && category === 'all' && (popularPosts ?? []).length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🔥 인기 글</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(popularPosts ?? []).map((p: any, i: number) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="kd-feed-card" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', padding: '6px 4px', borderRadius: 6, transition: 'background var(--transition-fast)' }}>
                <span style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)', minWidth: 22 }}>{i + 1}</span>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: CAT_COLORS[p.category] || 'var(--text-tertiary)', fontWeight: 700, flexShrink: 0 }}>
                  {CATS.find(c => c.key === p.category)?.label || p.category}
                </span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>👀 {p.view_count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 인기 태그 클라우드 */}
      {popularTags.length > 0 && pageNum === 1 && !q && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {popularTags.map((t: any) => (
            <Link key={t.tag} href={`/blog?q=${encodeURIComponent(t.tag)}`}
              style={{
                padding: '3px 10px', borderRadius: 16,
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)',
                textDecoration: 'none', fontWeight: 500,
              }}>
              #{t.tag} <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{t.cnt}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 검색 결과 안내 */}
      {q && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>
          &quot;{q}&quot; 검색 결과 {(posts ?? []).length}건
        </div>
      )}

      {/* 글 목록 — 카드형 */}
      {(posts ?? []).length === 0 ? (
        <EmptyState
          icon={q ? '🔍' : '📝'}
          title={q ? `"${q}"에 대한 검색 결과가 없습니다` : '아직 블로그 글이 없어요'}
          description={q ? '다른 검색어로 시도해보세요' : '곧 새로운 분석이 올라옵니다'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(posts ?? []).map((p: any) => {
            const catColor = CAT_COLORS[p.category] || 'var(--text-tertiary)';
            const catEmoji: Record<string, string> = { apt: '🏢', stock: '📈', unsold: '🏚️', finance: '💰', general: '📝' };
            const readMin = p.reading_time_min || 3;
            return (
              <Link key={p.id} href={`/blog/${p.slug}`} className="kd-card-hover" style={{
                display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                textDecoration: 'none', color: 'inherit',
              }}>
                {/* 썸네일 */}
                <div style={{
                  width: 56, height: 56, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                  background: (() => {
                    const hash = p.title.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                    const angle = hash % 360;
                    const pairs: Record<string, [string, string]> = {
                      stock: ['rgba(96,165,250,0.25)', 'rgba(167,139,250,0.25)'],
                      apt: ['rgba(52,211,153,0.25)', 'rgba(34,211,238,0.25)'],
                      unsold: ['rgba(251,191,36,0.25)', 'rgba(248,113,113,0.25)'],
                      finance: ['rgba(167,139,250,0.25)', 'rgba(236,72,153,0.25)'],
                    };
                    const [c1, c2] = pairs[p.category] || ['rgba(148,163,184,0.2)', 'rgba(203,213,225,0.2)'];
                    return `linear-gradient(${angle}deg, ${c1}, ${c2})`;
                  })(),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {p.cover_image ? (
                    <img src={p.cover_image} alt={p.image_alt || p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 24 }}>{catEmoji[p.category] || '📝'}</span>
                  )}
                  {p.view_count >= 50 && (
                    <span style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-red)', border: '1px solid var(--bg-surface)' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* 카테고리 + HOT */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: `${catColor}15`, color: catColor,
                    }}>
                      {CATS.find(c => c.key === p.category)?.label || p.category}
                    </span>
                    {p.view_count >= 100 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-red)' }}>HOT</span>
                    )}
                  </div>
                  {/* 제목 */}
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{p.title}</div>
                  {p.excerpt && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{p.excerpt}</div>
                  )}
                  {/* 메타 */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 2, fontSize: 10, color: 'var(--text-tertiary)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                    <span>·</span>
                    <span>📖 {readMin}분</span>
                    <span>·</span>
                    <span>👀 {p.view_count > 0 ? p.view_count.toLocaleString() : 0}</span>
                    {(p.comment_count || 0) > 0 && <><span>·</span><span>💬 {p.comment_count}</span></>}
                    {(p.helpful_count || 0) > 0 && <><span>·</span><span>👍 {p.helpful_count}</span></>}
                    {p.rewritten_at && <span style={{ padding: '0 4px', borderRadius: 3, background: 'var(--accent-green-bg, rgba(52,211,153,0.1))', color: 'var(--accent-green)', fontSize: 9, fontWeight: 700 }}>UP</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 인기 시리즈 (SEO 내부링크) */}
      {topSeries.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>📚 인기 시리즈</span>
            <Link href="/blog/series" style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>전체 보기 →</Link>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {topSeries.map(s => (
              <Link key={s.slug} href={`/blog/series/${s.slug}`} style={{
                flexShrink: 0, width: 140, padding: '10px 12px',
                background: 'var(--bg-hover)', borderRadius: 10, textDecoration: 'none',
                border: '1px solid var(--border)', transition: 'border-color var(--transition-fast)',
              }}>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.post_count}편</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 다음 페이지 미리보기 */}
      {nextPagePosts.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>다음 페이지 미리보기</div>
          {nextPagePosts.map((p: any) => (
            <Link key={p.id} href={`/blog/${p.slug}`} style={{
              display: 'block', padding: '4px 0', fontSize: 13, color: 'var(--text-secondary)',
              textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <span style={{ color: CAT_COLORS[p.category] || 'var(--text-tertiary)', marginRight: 4, fontSize: 11 }}>●</span>
              {p.title}
            </Link>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 20 }}>
        {pageNum > 1 && (
          <Link href={`/blog?${category !== 'all' ? `category=${category}&` : ''}${sort !== 'latest' ? `sort=${sort}&` : ''}${q ? `q=${q}&` : ''}page=${pageNum - 1}`}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
            ← 이전
          </Link>
        )}
        <span style={{ padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{pageNum} 페이지</span>
        {hasMore && (
          <Link href={`/blog?${category !== 'all' ? `category=${category}&` : ''}${sort !== 'latest' ? `sort=${sort}&` : ''}${q ? `q=${q}&` : ''}page=${pageNum + 1}`}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: 'var(--text-inverse)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
            다음 →
          </Link>
        )}
      </div>
    </div>
  );
}

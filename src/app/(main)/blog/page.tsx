import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';
import EmptyState from '@/components/EmptyState';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import SectionShareButton from '@/components/SectionShareButton';

function highlightTitle(title: string, query: string): React.ReactNode {
  if (!query) return title;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = title.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: 'rgba(37,99,235,0.15)', color: 'var(--brand)', borderRadius: 2, padding: '0 2px' }}>{part}</mark>
      : part
  );
}

export const maxDuration = 60;
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
    openGraph: { title: meta.title, description: meta.desc, url: canonical, siteName: '카더라', locale: 'ko_KR', type: 'website', images: [{ url: `${SITE}/api/og?title=${encodeURIComponent(meta.title)}&design=2&category=blog`, width: 1200, height: 630, alt: meta.title }, { url: `${SITE}/api/og-square?title=${encodeURIComponent(meta.title)}&category=blog`, width: 630, height: 630, alt: meta.title }] },
    twitter: { card: 'summary_large_image' as const, title: meta.title, description: meta.desc },
    ...(pageNum > 1 ? { robots: { index: false, follow: true } } : {}),
    other: {
      'naver:written_time': new Date().toISOString(),
      'naver:updated_time': new Date().toISOString(),
      'naver:author': '카더라',
      'og:updated_time': new Date().toISOString(),
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
  const perPage = 30;
  const sb = await createSupabaseServer();

  // 카테고리 건수 + 인기글 + 인기태그 — 병렬 조회
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const [catCountsR, popularR, tagsR] = await Promise.allSettled([
    sb.rpc('blog_category_counts'),
    sb.from('blog_posts')
      .select('id, slug, title, category, view_count, cover_image')
      .eq('is_published', true)
      .gte('created_at', thirtyDaysAgo)
      .order('view_count', { ascending: false })
      .limit(5),
    pageNum === 1 && !q ? sb.rpc('blog_popular_tags', { limit_count: 20 }) : Promise.resolve({ data: [] }),
  ]);

  const catCountsRaw = catCountsR.status === 'fulfilled' ? catCountsR.value?.data : [];
  const countMap: Record<string, number> = { all: 0 };
  (catCountsRaw || []).forEach((c: any) => { countMap[c.category] = Number(c.cnt); countMap.all += Number(c.cnt); });
  const totalCount = countMap.all;

  const popularPosts = popularR.status === 'fulfilled' ? popularR.value?.data : [];

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

  // 인기 태그 (위에서 병렬 조회됨)
  const popularTags: { tag: string; cnt: number }[] = tagsR.status === 'fulfilled' ? ((tagsR.value as any)?.data || []) : [];

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
      image: p.cover_image || `${SITE}/api/og?title=${encodeURIComponent((p.title || "").slice(0, 50))}&design=2&category=${p.category || "blog"}`,
    })),
  } : null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
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
      {/* speakable — 네이버 음성검색 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: '카더라 블로그', speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.blog-summary'] } }) }} />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, paddingTop: 4 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>블로그</h1>
          <p className="blog-summary" style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '2px 0 0', letterSpacing: '0.3px' }}>매일 업데이트되는 투자 인사이트 · {totalCount.toLocaleString()}편</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SectionShareButton section="blog" label="투자 정보 블로그 19,000편+" pagePath="/blog" />
          <Link href="/blog?sort=popular" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 14 }}>🔥</Link>
        </div>
      </div>

      {/* 검색 */}
      <form action="/blog" method="GET" style={{ marginBottom: 'var(--sp-md)', position: 'relative' }}>
        {category !== 'all' && <input type="hidden" name="category" value={category} />}
        {sort !== 'latest' && <input type="hidden" name="sort" value={sort} />}
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input name="q" defaultValue={q} placeholder="블로그 검색" style={{
          width: '100%', height: 40, padding: '0 12px 0 38px', fontSize: 13, fontWeight: 500,
          borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)',
          color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
        }} />
      </form>

      {/* 카테고리 탭 — 밑줄 스타일 */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 'var(--sp-md)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {CATS.map(c => (
          <Link key={c.key} href={`/blog${c.key !== 'all' ? `?category=${c.key}` : ''}${sort !== 'latest' ? `${c.key !== 'all' ? '&' : '?'}sort=${sort}` : ''}${q ? `${c.key !== 'all' || sort !== 'latest' ? '&' : '?'}q=${q}` : ''}`}
            style={{
              padding: '8px 14px', fontSize: 'var(--fs-sm)', fontWeight: category === c.key ? 700 : 500,
              color: category === c.key ? 'var(--brand)' : 'var(--text-tertiary)',
              textDecoration: 'none', flexShrink: 0,
              borderBottom: category === c.key ? '2px solid var(--brand)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', transition: 'all var(--transition-fast)',
            }}>
            {c.label}
            <span style={{ fontSize: 'var(--fs-xs)', opacity: 0.6 }}>{countMap[c.key] || 0}</span>
          </Link>
        ))}
        <Link href="/blog/series" style={{
          padding: '8px 14px', fontSize: 'var(--fs-sm)', fontWeight: 500,
          color: 'var(--brand)', textDecoration: 'none', flexShrink: 0,
          borderBottom: '2px solid transparent',
          display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)',
        }}>
          📚 시리즈
        </Link>
      </div>

      {/* 서브카테고리 칩 */}
      {category !== 'all' && SUB_CATS[category] && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <Link href={`/blog?category=${category}${sort !== 'latest' ? `&sort=${sort}` : ''}${q ? `&q=${q}` : ''}`}
            style={{
              padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: !sub ? 700 : 500,
              background: !sub ? 'var(--brand)' : 'var(--bg-hover)',
              color: !sub ? 'var(--text-inverse)' : 'var(--text-tertiary)',
              textDecoration: 'none', flexShrink: 0, border: 'none',
            }}>
            전체
          </Link>
          {SUB_CATS[category].map(sc => (
            <Link key={sc.key} href={`/blog?category=${category}&sub=${sc.key}${sort !== 'latest' ? `&sort=${sort}` : ''}${q ? `&q=${q}` : ''}`}
              style={{
                padding: '4px 12px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--fs-xs)', fontWeight: sub === sc.key ? 700 : 500,
                background: sub === sc.key ? 'var(--brand)' : 'var(--bg-hover)',
                color: sub === sc.key ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                textDecoration: 'none', flexShrink: 0, border: 'none',
              }}>
              {sc.label}
            </Link>
          ))}
        </div>
      )}

      {/* 정렬 + 인기태그 인라인 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 'var(--sp-xs)' }}>
          {[
            { key: 'latest', label: '최신순' },
            { key: 'popular', label: '인기순' },
          ].map(s => (
            <Link key={s.key} href={`/blog?${category !== 'all' ? `category=${category}&` : ''}sort=${s.key}${q ? `&q=${q}` : ''}`}
              style={{
                padding: '4px 10px', borderRadius: 'var(--radius-xs)', fontSize: 11, fontWeight: 600,
                background: sort === s.key ? 'var(--brand)' : 'transparent',
                color: sort === s.key ? '#fff' : 'var(--text-tertiary)',
                textDecoration: 'none', border: sort === s.key ? 'none' : '1px solid var(--border)',
              }}>
              {s.label}
            </Link>
          ))}
        </div>
        {popularTags.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--sp-xs)', overflow: 'hidden' }}>
            {popularTags.slice(0, 4).map((t: any) => (
              <Link key={t.tag} href={`/blog?q=${encodeURIComponent(t.tag)}`}
                style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                #{t.tag}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 인기글 — 컴팩트 한 줄 */}
      {pageNum === 1 && !q && category === 'all' && (popularPosts ?? []).length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 'var(--sp-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>🔥 인기 글</span>
            <Link href="/blog?sort=popular" style={{ fontSize: 10, color: 'var(--text-tertiary)', textDecoration: 'none', fontWeight: 600 }}>전체보기 →</Link>
          </div>
          {(popularPosts ?? []).slice(0, 3).map((p: any, i: number) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="kd-feed-card" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'inherit', padding: '4px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: i === 0 ? 'var(--brand)' : 'var(--text-tertiary)', width: 16, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
              <span style={{ fontSize: 10, color: CAT_COLORS[p.category] || 'var(--text-tertiary)', fontWeight: 700, flexShrink: 0 }}>
                {CATS.find(c => c.key === p.category)?.label || p.category}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>👀{p.view_count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 검색 결과 안내 */}
      {q && (
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-md)' }}>
          &quot;{q}&quot; 검색 결과 {(posts ?? []).length}건
        </div>
      )}

      {/* 글 목록 — 에디토리얼 타임라인 */}
      {(posts ?? []).length === 0 ? (
        <EmptyState
          icon={q ? '🔍' : '📝'}
          title={q ? `"${q}"에 대한 검색 결과가 없습니다` : '아직 블로그 글이 없어요'}
          description={q ? '다른 검색어로 시도해보세요' : '곧 새로운 분석이 올라옵니다'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {(posts ?? []).map((p: any, idx: number) => {
            const catColor = CAT_COLORS[p.category] || 'var(--text-tertiary)';
            const catLabel = CATS.find(c => c.key === p.category)?.label || p.category;
            const readMin = p.reading_time_min || 3;
            const d = new Date(p.created_at || Date.now());
            const now = Date.now();
            const diff = now - d.getTime();
            const dateStr = diff < 86400000 ? '오늘' : diff < 172800000 ? '어제' : diff < 604800000 ? `${Math.floor(diff / 86400000)}일 전` : d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
            const rank = (pageNum - 1) * perPage + idx + 1;
            const isHot = (p.view_count ?? 0) >= 100;
            return (
              <Link key={p.id} href={`/blog/${p.slug}`} className="kd-feed-card" style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 6px',
                textDecoration: 'none', color: 'inherit',
                borderBottom: '1px solid rgba(30,50,88,0.25)',
              }}>
                {/* 순위 */}
                <span style={{ fontSize: 10, fontWeight: 800, color: isHot ? 'var(--accent-red)' : 'var(--text-tertiary)', width: 18, textAlign: 'center', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{rank}</span>
                {/* 썸네일 */}
                {p.cover_image && (
                  <div style={{ width: 64, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-hover)' }}>
                    <img src={p.cover_image} alt="" width={64} height={44} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  </div>
                )}
                {/* 본문 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: `${catColor}12`, color: catColor, flexShrink: 0 }}>{catLabel}</span>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{q ? highlightTitle(p.title, q) : p.title}</span>
                    {isHot && <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent-red)', flexShrink: 0 }}>HOT</span>}
                  </div>
                  {p.excerpt && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3, marginBottom: 2 }}>{p.excerpt}</div>}
                  <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
                    <span>{readMin}분</span>
                    <span>👀 {p.view_count > 0 ? p.view_count.toLocaleString() : 0}</span>
                    {(p.comment_count || 0) > 0 && <span>💬 {p.comment_count}</span>}
                    {(p.helpful_count || 0) > 0 && <span style={{ color: 'var(--accent-green)' }}>👍 {p.helpful_count}</span>}
                  </div>
                </div>
                {/* 날짜 */}
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0, whiteSpace: 'nowrap', paddingTop: 2 }}>{dateStr}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* 인기 시리즈 (SEO 내부링크) */}
      {/* 세션70: 블로그 목록 회원가입 유도 */}
      {pageNum === 1 && !q && (
        <div style={{
          margin: '12px 0', padding: '10px 14px', borderRadius: 8,
          background: 'linear-gradient(135deg, var(--brand-bg), var(--accent-green-bg))',
          border: '1px solid var(--brand-border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>📬</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>매일 투자 분석 받아보기</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>가입하면 전체 글 무제한 · 알림까지 무료</div>
          </div>
          <Link href="/login?redirect=/blog" style={{
            padding: '6px 14px', borderRadius: 'var(--radius-pill)',
            background: 'var(--kakao-bg)', color: 'var(--kakao-text)',
            fontWeight: 700, fontSize: 12, textDecoration: 'none', flexShrink: 0,
          }}>가입</Link>
        </div>
      )}
      {topSeries.length > 0 && (
        <div style={{ marginTop: 'var(--sp-2xl)', padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-sm)' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>📚 인기 시리즈</span>
            <Link href="/blog/series" style={{ fontSize: 'var(--fs-xs)', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>전체 보기 →</Link>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-sm)', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {topSeries.map(s => (
              <Link key={s.slug} href={`/blog/series/${s.slug}`} style={{
                flexShrink: 0, width: 140, padding: '10px 12px',
                background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)', textDecoration: 'none',
                border: '1px solid var(--border)', transition: 'border-color var(--transition-fast)',
              }}>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.post_count}편</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 다음 페이지 미리보기 */}
      {nextPagePosts.length > 0 && (
        <div style={{ marginTop: 'var(--sp-lg)', padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 'var(--sp-sm)' }}>다음 페이지 미리보기</div>
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

      {/* 관련 서비스 (내부 링크 — SEO 교차 참조) */}
      <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', marginTop: 'var(--sp-md)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 'var(--sp-sm)' }}>🔗 카더라 서비스</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[
            { href: '/apt', label: '🏠 부동산 청약' },
            { href: '/stock', label: '📈 주식 시세' },
            { href: '/apt/complex', label: '📖 단지백과' },
            { href: '/stock/compare', label: '⚖️ 종목 비교' },
            { href: '/daily/서울', label: '📰 데일리 리포트' },
            { href: '/apt/diagnose', label: '🎯 가점 계산기' },
          ].map(l => (
            <Link key={l.href} href={l.href} style={{ padding: '5px 10px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-xs)', fontWeight: 500, background: 'var(--bg-hover)', color: 'var(--text-secondary)', textDecoration: 'none', border: '1px solid var(--border)' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 페이지네이션 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-sm)', marginTop: 'var(--sp-xl)', marginBottom: 'var(--sp-xl)' }}>
        {pageNum > 1 && (
          <Link href={`/blog?${category !== 'all' ? `category=${category}&` : ''}${sort !== 'latest' ? `sort=${sort}&` : ''}${q ? `q=${q}&` : ''}page=${pageNum - 1}`}
            style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
            ← 이전
          </Link>
        )}
        <span style={{ padding: '8px 14px', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{pageNum} 페이지</span>
        {hasMore && (
          <Link href={`/blog?${category !== 'all' ? `category=${category}&` : ''}${sort !== 'latest' ? `sort=${sort}&` : ''}${q ? `q=${q}&` : ''}page=${pageNum + 1}`}
            style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--brand)', color: 'var(--text-inverse)', textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
            다음 →
          </Link>
        )}
      </div>
    </div>
  );
}

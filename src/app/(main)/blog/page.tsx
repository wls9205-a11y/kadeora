import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createSupabaseServer } from '@/lib/supabase-server';
import EmptyState from '@/components/EmptyState';

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

interface PageProps { searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string }> }

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
    openGraph: { title: meta.title, description: meta.desc, url: canonical },
    ...(pageNum > 1 ? { robots: { index: false, follow: true } } : {}),
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

interface Props { searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string }> }

export default async function BlogPage({ searchParams }: Props) {
  const { category = 'all', sort = 'latest', q = '', page = '1' } = await searchParams;
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

  // 메인 쿼리
  const now = new Date().toISOString();
  let q2 = sb.from('blog_posts')
    .select('id, slug, title, excerpt, category, tags, created_at, view_count, cover_image, image_alt, published_at, reading_time_min, comment_count')
    .eq('is_published', true)
    .or(`published_at.is.null,published_at.lte.${now}`);
  if (category !== 'all') q2 = q2.eq('category', category);
  if (q) q2 = q2.or(`title.ilike.%${q}%,excerpt.ilike.%${q}%`);
  if (sort === 'popular') {
    q2 = q2.order('view_count', { ascending: false });
  } else {
    q2 = q2.order('created_at', { ascending: false });
  }
  q2 = q2.range((pageNum - 1) * perPage, pageNum * perPage - 1);
  const { data: posts, count: filteredCount } = await q2;

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
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: '블로그', item: SITE_URL + '/blog' },
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
      url: `${SITE_URL}/blog/${p.slug}`,
      name: p.title,
    })),
  } : null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📝 블로그</h1>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>{totalCount.toLocaleString()}개의 글</span>
      </div>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', margin: '0 0 16px' }}>매일 업데이트되는 투자 정보</p>

      {/* 검색 */}
      <form action="/blog" method="GET" style={{ marginBottom: 14 }}>
        {category !== 'all' && <input type="hidden" name="category" value={category} />}
        {sort !== 'latest' && <input type="hidden" name="sort" value={sort} />}
        <input name="q" defaultValue={q} placeholder="블로그 검색 (제목)" style={{
          width: '100%', padding: '10px 14px', fontSize: 'var(--fs-base)', borderRadius: 10,
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

      {/* 인기글 하이라이트 (첫 페이지, 검색 아닐 때) */}
      {pageNum === 1 && !q && category === 'all' && (popularPosts ?? []).length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(posts ?? []).map((p: any) => {
            const catColor = CAT_COLORS[p.category] || 'var(--text-tertiary)';
            const catEmoji: Record<string, string> = { apt: '🏢', stock: '📈', unsold: '🏚️', finance: '💰', general: '📝' };
            const readMin = p.reading_time_min || 3;
            return (
              <Link key={p.id} href={`/blog/${p.slug}`} className="kd-card-hover" style={{
                display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 12,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                textDecoration: 'none', color: 'inherit',
              }}>
                {/* 썸네일 (이미지 없으면 카테고리 이모지) */}
                <div style={{
                  width: 80, height: 80, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                  background: p.cover_image ? 'var(--bg-hover)' : `${catColor}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {p.cover_image ? (
                    <Image src={p.cover_image} alt={p.image_alt || p.title}
                      width={80} height={80}
                      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                      loading="lazy" />
                  ) : (
                    <span style={{ fontSize: 32 }}>{catEmoji[p.category] || '📝'}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* 카테고리 뱃지 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}30`,
                    }}>
                      {CATS.find(c => c.key === p.category)?.icon} {CATS.find(c => c.key === p.category)?.label || p.category}
                    </span>
                    {p.view_count >= 100 && (
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)' }}>🔥</span>
                    )}
                  </div>
                  {/* 제목 */}
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{p.title}</div>
                  {/* 요약 */}
                  {p.excerpt && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as any }}>{p.excerpt}</div>}
                  {/* 메타 */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                    <span>{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                    <span>📖 {readMin}분</span>
                    {p.view_count > 0 && <span>👀 {p.view_count}</span>}
                    {(p.comment_count || 0) > 0 && <span>💬 {p.comment_count}</span>}
                    {(p.tags ?? []).slice(0, 2).map((t: string) => <span key={t} style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4 }}>#{t}</span>)}
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
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {topSeries.map(s => (
              <Link key={s.slug} href={`/blog/series/${s.slug}`} style={{
                flexShrink: 0, width: 140, padding: '10px 12px',
                background: 'var(--bg-hover)', borderRadius: 10, textDecoration: 'none',
                border: '1px solid var(--border)', transition: 'border-color var(--transition-fast)',
              }}>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.post_count}편</div>
              </Link>
            ))}
          </div>
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

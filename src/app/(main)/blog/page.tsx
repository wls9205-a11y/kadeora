import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';

export const revalidate = 300;
export const metadata: Metadata = {
  title: '블로그 — 주식·청약·부동산 정보',
  description: '코스피 코스닥 시세, 아파트 청약 일정, 미분양 현황, 재테크 정보를 매일 업데이트합니다.',
};

const CATS = [
  { key: 'all', label: '전체', icon: '📋' },
  { key: 'stock', label: '주식', icon: '📈' },
  { key: 'apt', label: '청약', icon: '🏠' },
  { key: 'unsold', label: '미분양', icon: '🏚️' },
  { key: 'finance', label: '재테크', icon: '💰' },
  { key: 'general', label: '생활', icon: '📰' },
];

const CAT_COLORS: Record<string, string> = {
  stock: '#3b82f6', apt: '#22c55e', unsold: '#f97316', finance: '#8b5cf6', general: '#64748b',
};

interface Props { searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string }> }

export default async function BlogPage({ searchParams }: Props) {
  const { category = 'all', sort = 'latest', q = '', page = '1' } = await searchParams;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const perPage = 20;
  const sb = await createSupabaseServer();

  // 카테고리별 건수
  const countPromises = CATS.filter(c => c.key !== 'all').map(async c => {
    const { count } = await sb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('is_published', true).eq('category', c.key);
    return { key: c.key, count: count || 0 };
  });
  const catCounts = await Promise.all(countPromises);
  const totalCount = catCounts.reduce((s, c) => s + c.count, 0);
  const countMap: Record<string, number> = { all: totalCount };
  catCounts.forEach(c => { countMap[c.key] = c.count; });

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
    .select('id, slug, title, excerpt, category, tags, created_at, view_count, cover_image, image_alt, published_at')
    .eq('is_published', true)
    .or(`published_at.is.null,published_at.lte.${now}`);
  if (category !== 'all') q2 = q2.eq('category', category);
  if (q) q2 = q2.ilike('title', `%${q}%`);
  if (sort === 'popular') {
    q2 = q2.order('view_count', { ascending: false });
  } else {
    q2 = q2.order('created_at', { ascending: false });
  }
  q2 = q2.range((pageNum - 1) * perPage, pageNum * perPage - 1);
  const { data: posts, count: filteredCount } = await q2;

  const hasMore = (posts ?? []).length === perPage;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📝 블로그</h1>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{totalCount.toLocaleString()}개의 글</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '0 0 16px' }}>매일 업데이트되는 투자 정보</p>

      {/* 검색 */}
      <form action="/blog" method="GET" style={{ marginBottom: 14 }}>
        {category !== 'all' && <input type="hidden" name="category" value={category} />}
        {sort !== 'latest' && <input type="hidden" name="sort" value={sort} />}
        <input name="q" defaultValue={q} placeholder="블로그 검색 (제목)" style={{
          width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--bg-surface)',
          color: 'var(--text-primary)', boxSizing: 'border-box',
        }} />
      </form>

      {/* 카테고리 탭 + 건수 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {CATS.map(c => (
          <Link key={c.key} href={`/blog${c.key !== 'all' ? `?category=${c.key}` : ''}${sort !== 'latest' ? `${c.key !== 'all' ? '&' : '?'}sort=${sort}` : ''}${q ? `${c.key !== 'all' || sort !== 'latest' ? '&' : '?'}q=${q}` : ''}`}
            style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: category === c.key ? 700 : 500,
              background: category === c.key ? 'var(--text-primary)' : 'var(--bg-surface)',
              color: category === c.key ? 'var(--bg-base, #fff)' : 'var(--text-secondary)',
              textDecoration: 'none', flexShrink: 0, border: category === c.key ? 'none' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
            <span>{c.icon}</span> {c.label}
            <span style={{ fontSize: 10, opacity: 0.7 }}>({countMap[c.key] || 0})</span>
          </Link>
        ))}
      </div>

      {/* 정렬 토글 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { key: 'latest', label: '🕐 최신순' },
          { key: 'popular', label: '🔥 인기순' },
        ].map(s => (
          <Link key={s.key} href={`/blog?${category !== 'all' ? `category=${category}&` : ''}sort=${s.key}${q ? `&q=${q}` : ''}`}
            style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              background: sort === s.key ? 'var(--brand)' : 'var(--bg-hover)',
              color: sort === s.key ? '#fff' : 'var(--text-tertiary)',
              textDecoration: 'none', border: 'none',
            }}>
            {s.label}
          </Link>
        ))}
      </div>

      {/* 인기글 하이라이트 (첫 페이지, 검색 아닐 때) */}
      {pageNum === 1 && !q && category === 'all' && (popularPosts ?? []).length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>🔥 인기 글</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(popularPosts ?? []).map((p: any, i: number) => (
              <Link key={p.id} href={`/blog/${p.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: i < 3 ? 'var(--brand)' : 'var(--text-tertiary)', minWidth: 22 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                <span style={{ fontSize: 10, color: CAT_COLORS[p.category] || 'var(--text-tertiary)', fontWeight: 700, flexShrink: 0 }}>
                  {CATS.find(c => c.key === p.category)?.label || p.category}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>👀 {p.view_count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 검색 결과 안내 */}
      {q && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          &quot;{q}&quot; 검색 결과 {(posts ?? []).length}건
        </div>
      )}

      {/* 글 목록 — 카드형 */}
      {(posts ?? []).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
          {q ? `"${q}"에 대한 검색 결과가 없습니다` : '아직 블로그 글이 없어요'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(posts ?? []).map((p: any) => {
            const catColor = CAT_COLORS[p.category] || '#64748b';
            return (
              <Link key={p.id} href={`/blog/${p.slug}`} style={{
                display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 12,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                textDecoration: 'none', color: 'inherit', transition: 'background 0.15s',
              }}>
                {/* 썸네일 */}
                {p.cover_image && (
                  <div style={{
                    width: 80, height: 80, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                    background: 'var(--bg-hover)',
                  }}>
                    <img src={p.cover_image} alt={p.image_alt || p.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* 카테고리 뱃지 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}30`,
                    }}>
                      {CATS.find(c => c.key === p.category)?.icon} {CATS.find(c => c.key === p.category)?.label || p.category}
                    </span>
                    {p.view_count >= 100 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>🔥</span>
                    )}
                  </div>
                  {/* 제목 */}
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{p.title}</div>
                  {/* 요약 */}
                  {p.excerpt && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as any }}>{p.excerpt}</div>}
                  {/* 메타 */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    <span>{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                    {p.view_count > 0 && <span>👀 {p.view_count}</span>}
                    {(p.tags ?? []).slice(0, 2).map((t: string) => <span key={t} style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4 }}>#{t}</span>)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 20 }}>
        {pageNum > 1 && (
          <Link href={`/blog?${category !== 'all' ? `category=${category}&` : ''}${sort !== 'latest' ? `sort=${sort}&` : ''}${q ? `q=${q}&` : ''}page=${pageNum - 1}`}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            ← 이전
          </Link>
        )}
        <span style={{ padding: '8px 14px', fontSize: 13, color: 'var(--text-tertiary)' }}>{pageNum} 페이지</span>
        {hasMore && (
          <Link href={`/blog?${category !== 'all' ? `category=${category}&` : ''}${sort !== 'latest' ? `sort=${sort}&` : ''}${q ? `q=${q}&` : ''}page=${pageNum + 1}`}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            다음 →
          </Link>
        )}
      </div>
    </div>
  );
}

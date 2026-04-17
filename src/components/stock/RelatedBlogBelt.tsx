import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';

/**
 * 관련 블로그 벨트
 * 해당 종목 태그가 달린 블로그 포스트 6개 표시
 * 종목 → 블로그 → 종목 순환 구조의 핵심
 */

interface Props {
  symbol: string;
  stockName: string;
}

export default async function RelatedBlogBelt({ symbol, stockName }: Props) {
  const sb = await createSupabaseServer();

  // 종목명 또는 심볼이 태그에 포함된 블로그 검색
  const { data: blogs } = await sb
    .from('blog_posts')
    .select('id, slug, title, cover_image, published_at, category')
    .eq('is_published', true)
    .or(`tags.cs.{${symbol}},tags.cs.{${stockName}}`)
    .order('published_at', { ascending: false })
    .limit(6);

  // 태그 매칭 없으면 stock 카테고리 최신 글
  let posts = blogs || [];
  if (posts.length < 3) {
    const { data: fallback } = await sb
      .from('blog_posts')
      .select('id, slug, title, cover_image, published_at, category')
      .eq('is_published', true)
      .eq('category', 'stock')
      .order('published_at', { ascending: false })
      .limit(6);
    posts = fallback || [];
  }

  if (!posts.length) return null;

  return (
    <section style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
          📰 관련 분석 글
        </h2>
        <Link
          href={`/blog?q=${encodeURIComponent(stockName)}`}
          style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none' }}
        >
          더보기 →
        </Link>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '10px',
      }}>
        {posts.map((post: any) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            style={{
              display: 'flex',
              gap: '10px',
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md, 8px)',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid var(--border)',
              alignItems: 'center',
            }}
          >
            {post.cover_image && (
              <img
                src={post.cover_image}
                alt=""
                width={56}
                height={56}
                style={{
                  borderRadius: '6px',
                  objectFit: 'cover',
                  flexShrink: 0,
                  background: 'var(--bg-tertiary)',
                }}
                loading="lazy"
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '13px',
                fontWeight: 600,
                margin: 0,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {post.title}
              </p>
              {post.published_at && (
                <time style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', display: 'block' }}>
                  {new Date(post.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </time>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

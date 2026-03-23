import type { Metadata } from 'next';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { notFound } from 'next/navigation';

interface Props { params: Promise<{ slug: string }> }

const sb = () => getSupabaseAdmin();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: s } = await sb().from('blog_series').select('title,description').eq('slug', slug).single();
  if (!s) return { title: '시리즈' };
  return {
    title: `${s.title} — 시리즈`,
    description: s.description || `${s.title} 시리즈 전체 글 모아보기`,
    alternates: { canonical: `https://kadeora.app/blog/series/${slug}` },
  };
}

export const revalidate = 3600;

export default async function SeriesDetailPage({ params }: Props) {
  const { slug } = await params;
  const { data: series } = await sb().from('blog_series')
    .select('*').eq('slug', slug).eq('is_active', true).single();
  if (!series) notFound();

  const { data: posts } = await sb().from('blog_posts')
    .select('id,title,slug,excerpt,cover_image,category,published_at,series_order')
    .eq('series_id', series.id).eq('is_published', true)
    .order('series_order', { ascending: true, nullsFirst: false })
    .order('published_at', { ascending: true });

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/blog/series" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 시리즈 목록</Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>📚 {series.title}</h1>
        {series.description && (
          <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{series.description}</p>
        )}
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 8 }}>총 {posts?.length || 0}편</div>
      </div>

      {/* 시리즈 진행률 바 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ height: 4, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '100%', background: 'var(--brand)', borderRadius: 2 }} />
        </div>
      </div>

      {/* 포스트 목록 — 타임라인 스타일 */}
      <div style={{ position: 'relative' }}>
        {/* 왼쪽 연결선 */}
        <div style={{
          position: 'absolute', left: 15, top: 20, bottom: 20, width: 2,
          background: 'var(--border)',
        }} />

        {(posts || []).map((post, idx) => (
          <Link key={post.id} href={`/blog/${post.slug}`} style={{
            display: 'flex', gap: 14, padding: '12px 0', textDecoration: 'none',
            position: 'relative', marginLeft: 0,
          }}>
            {/* 넘버 서클 */}
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: 'var(--brand)', color: 'var(--text-inverse)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--fs-xs)', fontWeight: 800, zIndex: 1,
              border: '3px solid var(--bg-base)',
            }}>
              {idx + 1}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)',
                margin: 0, lineHeight: 1.4,
              }}>
                {post.title}
              </h3>
              {post.excerpt && (
                <p style={{
                  fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)',
                  margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {post.excerpt}
                </p>
              )}
            </div>

            {post.cover_image && (
              <img src={post.cover_image} alt="" style={{
                width: 56, height: 42, objectFit: 'cover', borderRadius: 6, flexShrink: 0,
              }} />
            )}
          </Link>
        ))}
      </div>

      {/* 시리즈 JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: series.title,
        description: series.description,
        numberOfItems: posts?.length || 0,
        itemListElement: (posts || []).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://kadeora.app/blog/${p.slug}`,
          name: p.title,
        })),
      })}} />
    </div>
  );
}

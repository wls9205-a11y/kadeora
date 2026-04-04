import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import ShareButtons from '@/components/ShareButtons';
import { notFound } from 'next/navigation';

interface Props { params: Promise<{ slug: string }> }

const sb = () => getSupabaseAdmin();

export async function generateStaticParams() {
  try {
    const { data } = await sb().from('blog_series').select('slug');
    return (data || []).map((s: any) => ({ slug: s.slug }));
  } catch { return []; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: s } = await sb().from('blog_series').select('title,description,created_at').eq('slug', slug).single();
  if (!s) return { title: '시리즈' };
  return {
    title: `${s.title} — 시리즈`,
    description: s.description || `${s.title} 시리즈 전체 글 모아보기. 카더라 블로그에서 주제별 심층 분석을 읽어보세요.`,
    alternates: { canonical: `${SITE_URL}/blog/series/${slug}` },
    openGraph: {
      title: `📚 ${s.title} 시리즈`,
      description: s.description || `${s.title} 시리즈 전체 글 모아보기`,
      url: `${SITE_URL}/blog/series/${slug}`,
      siteName: '카더라',
      locale: 'ko_KR',
      type: 'article',
      images: [
        { url: `${SITE_URL}/api/og?title=${encodeURIComponent(s.title)}&design=2&category=blog`, width: 1200, height: 630, alt: s.title },
        { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(s.title)}&category=blog`, width: 630, height: 630, alt: s.title },
      ],
    },
    twitter: { card: 'summary_large_image' as const, title: s.title, images: [`${SITE_URL}/api/og?title=${encodeURIComponent(s.title)}&design=2&category=blog`] },
    other: {
      'naver:written_time': s.created_at || '2026-01-15T00:00:00Z',
      'naver:updated_time': s.created_at || new Date().toISOString(),
      'naver:author': '카더라',
      'article:section': '블로그',
      'article:tag': `${s.title},시리즈,카더라`,
      'article:published_time': s.created_at || '2026-01-15T00:00:00Z',
      'article:modified_time': s.created_at || new Date().toISOString(),
      'dg:plink': `${SITE_URL}/blog/series/${slug}`,
    },
  };
}

export const revalidate = 3600;

export default async function SeriesDetailPage({ params }: Props) {
  const { slug } = await params;
  const { data: series } = await sb().from('blog_series')
    .select('id,title,slug,description,cover_image,category,post_count,is_active').eq('slug', slug).eq('is_active', true).single();
  if (!series) notFound();

  const { data: posts } = await sb().from('blog_posts')
    .select('id,title,slug,excerpt,cover_image,category,published_at,series_order')
    .eq('series_id', series.id).eq('is_published', true)
    .order('series_order', { ascending: true, nullsFirst: false })
    .order('published_at', { ascending: true });

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '카더라', item: SITE_URL }, { '@type': 'ListItem', position: 2, name: '블로그', item: SITE_URL + '/blog' }, { '@type': 'ListItem', position: 3, name: '시리즈', item: SITE_URL + '/blog/series' }, { '@type': 'ListItem', position: 4, name: series.title }] }) }} />
      {/* Speakable — 음성검색/AI 답변 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: `${series.title} 시리즈`, url: `${SITE_URL}/blog/series/${slug}`, speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.series-description'] }, thumbnailUrl: `${SITE_URL}/api/og-square?title=${encodeURIComponent(series.title)}&category=blog` }) }} />
      {/* FAQPage — SERP 면적 확장 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: `${series.title} 시리즈는 몇 편인가요?`, acceptedAnswer: { '@type': 'Answer', text: `${series.title} 시리즈는 총 ${posts?.length || 0}편으로 구성되어 있습니다. 카더라 블로그에서 주제별 심층 분석을 순서대로 읽을 수 있습니다.` } }, { '@type': 'Question', name: `${series.title} 시리즈는 어떤 내용인가요?`, acceptedAnswer: { '@type': 'Answer', text: series.description || `${series.title}에 대한 심층 분석 시리즈입니다. 투자 인사이트와 데이터 기반 분석을 제공합니다.` } }] }) }} />
      <div style={{ marginBottom: 'var(--sp-xl)' }}>
        <Link href="/blog/series" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 시리즈 목록</Link>
        <h1 style={{ margin: '8px 0 0', fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>📚 {series.title}</h1>
        {series.description && (
          <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{series.description}</p>
        )}
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--sp-sm)' }}>총 {posts?.length || 0}편</div>
        <div style={{ marginTop: 8 }}><ShareButtons title={`${series.title} 시리즈 — 카더라 블로그`} postId={`series-${slug}`} /></div>
      </div>

      {/* 시리즈 진행률 바 */}
      <div style={{ marginBottom: 'var(--sp-lg)' }}>
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
              <div style={{ width: 56, height: 42, borderRadius: 'var(--radius-xs)', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                <Image src={post.cover_image} alt="" fill sizes="56px" style={{ objectFit: 'cover' }} loading="lazy" unoptimized={!post.cover_image.includes('supabase.co')} />
              </div>
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
          url: `${SITE_URL}/blog/${p.slug}`,
          name: p.title,
        })),
      })}} />
    </div>
  );
}

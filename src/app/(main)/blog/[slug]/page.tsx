import { createSupabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 300;

const SITE = 'https://kadeora.app';

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const sb = await createSupabaseServer();
  const { data: post } = await sb.from('blog_posts').select('title, excerpt, category, tags, created_at').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (!post) return {};
  return {
    title: `${post.title} | 카더라 블로그`,
    description: post.excerpt || post.title,
    keywords: (post.tags ?? []).join(', '),
    alternates: { canonical: `${SITE}/blog/${slug}` },
    openGraph: { title: post.title, description: post.excerpt || post.title, type: 'article', publishedTime: post.created_at, url: `${SITE}/blog/${slug}` },
  };
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params;
  const sb = await createSupabaseServer();

  const { data: post } = await sb.from('blog_posts').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
  if (!post) return notFound();

  // 조회수 증가
  sb.from('blog_posts').update({ view_count: (post.view_count ?? 0) + 1 }).eq('id', post.id).then(() => {});

  // 로그인 여부
  const { data: { user } } = await sb.auth.getUser();
  const isLoggedIn = !!user;

  // 관련 글
  const { data: related } = await sb.from('blog_posts').select('slug, title').eq('category', post.category).eq('is_published', true).neq('id', post.id).order('created_at', { ascending: false }).limit(3);

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: post.title, description: post.excerpt || '',
    datePublished: post.created_at, dateModified: post.updated_at,
    author: { '@type': 'Organization', name: '카더라', url: SITE },
    publisher: { '@type': 'Organization', name: '카더라', url: SITE },
    url: `${SITE}/blog/${slug}`,
    keywords: (post.tags ?? []).join(', '),
    inLanguage: 'ko-KR',
  };

  // 비로그인 시 50%만 노출
  const fullContent = post.content;
  const halfIndex = Math.floor(fullContent.length * 0.5);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div style={{ marginBottom: 16 }}>
        <Link href="/blog" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 블로그</Link>
      </div>

      <article style={{ paddingBottom: 80 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35, margin: '0 0 12px' }}>{post.title}</h1>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, display: 'flex', gap: 8 }}>
          <span>{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
          <span>조회 {post.view_count ?? 0}</span>
        </div>

        {(post.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {post.tags.map((t: string) => <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>#{t}</span>)}
          </div>
        )}

        {/* 본문 */}
        {isLoggedIn ? (
          <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {fullContent}
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflow: 'hidden' }}>
              {fullContent.slice(0, halfIndex)}
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(transparent, var(--bg-base))' }} />
            <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginTop: -20, position: 'relative' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>전체 글을 보려면 로그인하세요</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>청약 마감 알림도 받을 수 있어요</div>
              <Link href="/login" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 12, background: '#FEE500', color: '#191919', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                카카오로 가입
              </Link>
            </div>
          </div>
        )}

        {/* 면책 */}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 24, padding: '8px 12px', background: 'var(--bg-hover)', borderRadius: 8, lineHeight: 1.5 }}>
          본 콘텐츠는 투자 권유가 아니며 참고용입니다. 투자 판단과 손익은 투자자 본인에게 귀속됩니다. 데이터 출처: 청약홈, 국토교통부, 한국거래소
        </div>
      </article>

      {/* 관련 글 */}
      {(related ?? []).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>관련 글</div>
          {related!.map((r: any) => (
            <Link key={r.slug} href={`/blog/${r.slug}`} style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', fontSize: 13, color: 'var(--text-primary)' }}>
              {r.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

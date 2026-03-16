import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_POSTS, CATEGORY_MAP } from '@/lib/constants';
import type { PostWithProfile, CommentWithProfile } from '@/types/database';
import { LikeButton } from '@/components/LikeButton';
import { CommentSection } from '@/components/CommentSection';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import ShareButtons from '@/components/ShareButtons'
import PostActions from './PostActions';
import { BookmarkButton } from '@/components/BookmarkButton';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.vercel.app';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);
  const SITE_URL_META = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.vercel.app';
  try {
    const sb = await createSupabaseServer();
    const { data: post } = await sb
      .from('posts')
      .select('title, content, created_at, profiles!posts_author_id_fkey(nickname)')
      .eq('id', numId)
      .eq('is_deleted', false)
      .single();
    if (!post) return {};
    const author = (post.profiles as { nickname?: string } | null)?.nickname ?? '익명';
    const description = post.content.slice(0, 160);
    const ogImageUrl = `${SITE_URL_META}/api/og?title=${encodeURIComponent(post.title)}&author=${encodeURIComponent(author)}`;
    return {
      title: post.title,
      description,
      openGraph: {
        title: post.title,
        description,
        type: 'article',
        publishedTime: post.created_at,
        authors: [author],
        url: `${SITE_URL_META}/feed/${numId}`,
        images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
      },
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description,
        images: [ogImageUrl],
      },
    };
  } catch {
    return {};
  }
}

export default async function FeedDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);

  let post: PostWithProfile | null = null;
  let comments: CommentWithProfile[] = [];
  let currentUserId: string | null = null;

  try {
    const sb = await createSupabaseServer();
    const { data: { session } } = await sb.auth.getSession();
    currentUserId = session?.user?.id ?? null;

    const { data: postData } = await sb
      .from('posts')
      .select('*, profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
      .eq('id', numId)
      .eq('is_deleted', false)
      .single();

    if (postData) {
      post = postData as PostWithProfile;
      await sb.from('posts').update({ view_count: post.view_count + 1 }).eq('id', numId);

      const { data: commentsData } = await sb
        .from('comments')
        .select('*, profiles!comments_author_id_fkey(id,nickname,avatar_url)')
        .eq('post_id', numId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(100);
      if (commentsData) comments = commentsData as CommentWithProfile[];
    }
  } catch {
    // fallback to demo
  }

  if (!post) {
    const demoPost = DEMO_POSTS.find(p => p.id === numId);
    if (!demoPost) return notFound();
    post = demoPost;
    comments = [
      {
        id: 1, post_id: numId, author_id: 'demo-a', content: '좋은 정보 감사합니다! 많이 배워갑니다.',
        is_deleted: false, created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        profiles: { id: 'demo-a', nickname: '정보킹', avatar_url: null },
      },
      {
        id: 2, post_id: numId, author_id: 'demo-b', content: '저도 비슷한 생각이에요. 특히 두 번째 포인트가 핵심이라 봅니다.',
        is_deleted: false, created_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
        profiles: { id: 'demo-b', nickname: '투자마니아', avatar_url: null },
      },
    ];
  }

  const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.content.slice(0, 160),
    datePublished: post.created_at,
    dateModified: post.updated_at ?? post.created_at,
    author: {
      '@type': 'Person',
      name: post.profiles?.nickname ?? '익명',
    },
    publisher: {
      '@type': 'Organization',
      name: '카더라',
      url: SITE_URL,
    },
    url: `${SITE_URL}/feed/${post.id}`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/feed/${post.id}`,
    },
  };

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {/* JSON-LD SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13, color: 'var(--kd-text-dim)' }}>
        <Link href="/feed" style={{ color: 'var(--kd-primary)', textDecoration: 'none' }}>피드</Link>
        <span>›</span>
        <span style={{ padding: '1px 8px', borderRadius: 999, background: cat.bg, color: cat.color, fontSize: 11, fontWeight: 700 }}>
          {cat.label}
        </span>
      </div>

      {/* Post card */}
      <article style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 16, padding: '28px 28px 24px', marginBottom: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--kd-primary), var(--kd-purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: 'var(--text-inverse)',
          }}>
            {(post.profiles?.nickname ?? 'U')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--kd-text)' }}>
                {post.profiles?.nickname ?? '익명'}
              </span>
              {post.profiles?.grade && (
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 999, background: 'rgba(255,215,0,0.15)', color: '#FFD700', fontWeight: 600 }}>
                  {post.profiles.grade}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--kd-text-dim)', marginTop: 2 }}>
              {timeAgo(post.created_at)} · 조회 {post.view_count.toLocaleString()}
            </div>
          </div>
          <PostActions postId={post.id} authorId={post.author_id ?? ''} currentUserId={currentUserId} />
        </div>

        <h1 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 800, color: 'var(--kd-text)', lineHeight: 1.4 }}>
          {post.title}
        </h1>

        <div style={{ fontSize: 15, color: 'var(--kd-text)', lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 24 }}>
          {post.content}
        </div>

        {/* Image gallery */}
        {post.images && post.images.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: post.images.length === 1 ? '1fr' : post.images.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 24,
          }}>
            {post.images.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', position: 'relative', borderRadius: 8, overflow: 'hidden',
                  aspectRatio: post.images!.length === 1 ? '16/9' : '1',
                  cursor: 'pointer',
                }}>
                <Image
                  src={url}
                  alt={`이미지 ${i + 1}`}
                  fill
                  sizes={post.images!.length === 1 ? '(max-width: 780px) 100vw, 780px' : '(max-width: 780px) 33vw, 260px'}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                  priority={i === 0}
                />
              </a>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ borderTop: '1px solid var(--kd-border)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <LikeButton postId={post.id} initialCount={post.likes_count} />`n          <BookmarkButton postId={post.id} />
          <ShareButtons title={post.title} postId={post.id} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--kd-border)', color: 'var(--kd-text-muted)', fontSize: 14 }}>
            💬 <span>{comments.length.toLocaleString()}</span>
          </div>
        </div>
      </article>

      {/* Comments */}
      <div style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 16, padding: '24px 28px' }}>
        <CommentSection postId={post.id} initialComments={comments} />
      </div>
    </div>
  );
}
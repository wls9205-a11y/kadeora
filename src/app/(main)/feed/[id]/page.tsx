import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_POSTS, CATEGORY_MAP, GRADE_EMOJI } from '@/lib/constants';

// Cache: 120s — 게시글 상세
export const revalidate = 120;
import type { PostWithProfile, CommentWithProfile } from '@/types/database';
import { LikeButton } from '@/components/LikeButton';
import { CommentSection } from '@/components/CommentSection';
import Link from 'next/link';
import Image from 'next/image';
import { notFound, permanentRedirect } from 'next/navigation';
import ShareButtons from '@/components/ShareButtons'
import { getAvatarColor } from '@/lib/avatar';
import { BookmarkButton } from '@/components/BookmarkButton';
import ReportButton from '@/components/ReportButton';
import PostActions from '@/components/PostActions';
import FontSizeControl from '@/components/FontSizeControl';
import { timeAgo } from '@/lib/format';
import Disclaimer from '@/components/Disclaimer';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

function parsePostId(param: string): number {
  const match = param.match(/-(\d+)$/);
  if (match) return parseInt(match[1]);
  const num = parseInt(param);
  if (!isNaN(num)) return num;
  return 0;
}


interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const numId = parsePostId(id);
  const SITE_URL_META = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  try {
    const sb = await createSupabaseServer();
    const { data: post } = await sb
      .from('posts')
      .select('title, content, created_at, slug, category, likes_count, comments_count, profiles!posts_author_id_fkey(nickname)')
      .eq('id', numId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (!post) return {};
    const author = (post.profiles as { nickname?: string } | null)?.nickname ?? '익명';
    const description = post.content.slice(0, 160);
    const ogImageUrl = `${SITE_URL_META}/api/og?title=${encodeURIComponent(post.title)}&author=${encodeURIComponent(author)}&category=${encodeURIComponent(post.category || '')}&likes=${post.likes_count ?? 0}&comments=${post.comments_count ?? 0}`;
    return {
      title: post.title,
      description,
      alternates: {
        canonical: `https://kadeora.app/feed/${post.slug || numId}`,
      },
      openGraph: {
        title: post.title,
        description,
        type: 'article',
        publishedTime: post.created_at,
        authors: [author],
        url: `${SITE_URL_META}/feed/${post.slug || numId}`,
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
    return {
      openGraph: {
        images: [{ url: `${SITE_URL_META}/og-image.png`, width: 1200, height: 628, alt: '카더라' }],
      },
    };
  }
}

export default async function FeedDetailPage({ params }: Props) {
  const { id } = await params;
  const numId = parsePostId(id);

  let post: PostWithProfile | null = null;
  let comments: CommentWithProfile[] = [];
  let related: any[] = [];
  let currentUserId: string | null = null;

  try {
    const sb = await createSupabaseServer();
    const { data: { user: authUser } } = await sb.auth.getUser();
    currentUserId = authUser?.id ?? null;

    const { data: postData } = await sb
      .from('posts')
      .select('*, slug, profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
      .eq('id', numId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (postData) {
      post = postData as PostWithProfile;
      sb.from('posts').update({ view_count: (post.view_count ?? 0) + 1 }).eq('id', numId).then(() => {});

      const [{ data: commentsData }, { data: relatedData }] = await Promise.all([
        sb.from('comments')
          .select('*, profiles!comments_author_id_fkey(id,nickname,avatar_url,grade)')
          .eq('post_id', numId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(100),
        sb.from('posts')
          .select('id,title,likes_count,comments_count,slug')
          .eq('category', postData.category)
          .eq('is_deleted', false)
          .neq('id', numId)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);
      if (commentsData) comments = commentsData as CommentWithProfile[];
      if (relatedData) related = relatedData;
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

  if (post?.slug && id === String(numId) && !isNaN(Number(id))) {
    permanentRedirect(`/feed/${post.slug}`);
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
    interactionStatistic: [
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: post.likes_count ?? 0 },
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: post.comments_count ?? 0 },
    ],
    inLanguage: 'ko-KR',
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px' }}>
      {/* JSON-LD SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/feed" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 피드</Link>
      </div>

      {/* Post article */}
      <article style={{ marginBottom: 0 }}>
        {/* Title */}
        <h1 style={{ margin: '0 0 16px', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.35 }}>
          {post.title}
        </h1>

        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: getAvatarColor(post.profiles?.nickname ?? '익명'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-inverse)',
          }}>
            {(post.profiles?.nickname ?? '익')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {post.profiles?.nickname ?? '익명'}
            </span>
            <span style={{ marginLeft: 4 }}>{GRADE_EMOJI[post.profiles?.grade as number] || '🌱'}</span>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              {timeAgo(post.created_at)} · 조회 {(post.view_count ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <PostActions postId={post.id} isOwner={currentUserId === post.author_id} />
            <ReportButton postId={post.id} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }} />
          </div>
        </div>

        {/* 글자 크기 조절 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <FontSizeControl />
        </div>

        {/* Content body */}
        {currentUserId ? (
          <div style={{ fontSize: 'var(--content-font-size, 16px)' as any, color: 'var(--text-primary)', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 24px' }}>
            {post.content}
          </div>
        ) : (
          <div style={{ position: 'relative', margin: '0 0 24px' }}>
            <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 120, overflow: 'hidden' }}>
              {post.content}
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(transparent, var(--bg-base))' }} />
            <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginTop: -20, position: 'relative' }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>전체 글을 보려면 로그인하세요</div>
              <Link href="/login" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 12, background: '#FEE500', color: '#191919', fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none' }}>
                카카오로 로그인
              </Link>
            </div>
          </div>
        )}

        {(post.category === 'apt' || post.category === 'stock') && (
          <Disclaimer type="feed" compact />
        )}

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

      </article>

      {/* 액션 바 — 본문과 댓글 사이 (인라인) */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '12px 0', borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)', margin: '16px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <LikeButton postId={post.id} initialCount={post.likes_count ?? 0} />
          <Link href="#comments" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            <span style={{ fontWeight: 500 }}>{comments.length}</span>
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          <ShareButtons title={post.title} postId={post.id} content={post.content} />
          <BookmarkButton postId={post.id} />
        </div>
      </div>

      {/* Comments — 로그인 여부 상관없이 댓글 목록 표시, 입력만 분기 */}
      <div style={{ marginBottom: 16 }}>
        <CommentSection postId={post.id} initialComments={comments} />
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>더 읽어보기</h3>
          {related.map((r: any, i: number) => (
            <Link key={r.id} href={`/feed/${r.slug || r.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12 }}>{r.title}</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>🤍 {r.likes_count ?? 0} · 💬 {r.comments_count ?? 0}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
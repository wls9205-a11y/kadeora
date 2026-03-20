import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_POSTS, CATEGORY_MAP } from '@/lib/constants';

// Cache: 120s — 게시글 상세
export const revalidate = 120;
import type { PostWithProfile, CommentWithProfile } from '@/types/database';
import { LikeButton } from '@/components/LikeButton';
import { CommentSection } from '@/components/CommentSection';
import Link from 'next/link';
import Image from 'next/image';
import { notFound, permanentRedirect } from 'next/navigation';
import ShareButtons from '@/components/ShareButtons'

import { BookmarkButton } from '@/components/BookmarkButton';
import ReportButton from '@/components/ReportButton';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

function parsePostId(param: string): number {
  const match = param.match(/-(\d+)$/);
  if (match) return parseInt(match[1]);
  const num = parseInt(param);
  if (!isNaN(num)) return num;
  return 0;
}

const AVATAR_COLORS = ['#FF5B36','#FF8C42','#4CAF50','#2196F3','#9C27B0','#E91E63','#FF9800','#00BCD4'];
function getAvatarColor(str: string) { return AVATAR_COLORS[str.split('').reduce((a,c)=>a+c.charCodeAt(0),0) % AVATAR_COLORS.length]; }
const GRADE_EMOJI: Record<number, string> = {1:'🌱',2:'📡',3:'🏘',4:'🏠',5:'⚡',6:'🦁',7:'🏆',8:'👑',9:'🌟',10:'⚡'};

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
    const { data: { session } } = await sb.auth.getSession();
    currentUserId = session?.user?.id ?? null;

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
          .select('*, profiles!comments_author_id_fkey(id,nickname,avatar_url)')
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
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* JSON-LD SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/feed" style={{ fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 피드</Link>
      </div>

      {/* Post article */}
      <article style={{ marginBottom: 20, paddingBottom: 80 }}>
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
            fontSize: 16, fontWeight: 700, color: '#fff',
          }}>
            {(post.profiles?.nickname ?? '익')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {post.profiles?.nickname ?? '익명'}
            </span>
            <span style={{ marginLeft: 4 }}>{GRADE_EMOJI[post.profiles?.grade as number] || '🌱'}</span>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {timeAgo(post.created_at)} · 조회 {(post.view_count ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <ReportButton postId={post.id} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }} />
          </div>
        </div>

        {/* Content body */}
        <div style={{ fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.9, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 24px' }}>
          {post.content}
        </div>

        {(post.category === '부동산' || post.category === '주식' || post.category === 'real_estate' || post.category === 'stock') && (
          <div style={{
            background: 'rgba(255,69,0,0.04)',
            border: '1px solid rgba(255,69,0,0.12)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            marginBottom: 24,
            lineHeight: 1.5,
          }}>
            📌 이 게시글은 개인의 의견이며 투자 권유가 아닙니다. 모든 투자 판단과 손익은 투자자 본인에게 귀속됩니다.
          </div>
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

        {/* Action bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <LikeButton postId={post.id} initialCount={post.likes_count ?? 0} />
          <span>💬 {comments.length}</span>
          <ShareButtons title={post.title} postId={post.id} content={post.content} />
          <BookmarkButton postId={post.id} />
        </div>
      </article>

      {/* Comments */}
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>💬 댓글 {comments.length}</h3>
        <CommentSection postId={post.id} initialComments={comments} />
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>더 읽어보기</h3>
          {related.map((r: any, i: number) => (
            <Link key={r.id} href={`/feed/${r.slug || r.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12 }}>{r.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>🤍 {r.likes_count ?? 0} · 💬 {r.comments_count ?? 0}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
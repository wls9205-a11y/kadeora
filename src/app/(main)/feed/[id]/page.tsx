import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_POSTS, CATEGORY_MAP } from '@/lib/constants';

export const revalidate = 60;
import type { PostWithProfile, CommentWithProfile } from '@/types/database';
import { LikeButton } from '@/components/LikeButton';
import { CommentSection } from '@/components/CommentSection';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import ShareButtons from '@/components/ShareButtons'

import { BookmarkButton } from '@/components/BookmarkButton';
import ReportButton from '@/components/ReportButton';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';

const GRADE_EMOJI: Record<number, string> = {1:'🌱',2:'🌿',3:'🍀',4:'🌸',5:'🌻',6:'⭐',7:'🔥',8:'💎',9:'👑',10:'🚀'};

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
  const SITE_URL_META = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  try {
    const sb = await createSupabaseServer();
    const { data: post } = await sb
      .from('posts')
      .select('title, content, created_at, profiles!posts_author_id_fkey(nickname)')
      .eq('id', numId)
      .eq('is_deleted', false)
      .maybeSingle();
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
        images: [
          { url: ogImageUrl, width: 1200, height: 630, alt: post.title },
          { url: `${SITE_URL_META}/og-image.png`, width: 1200, height: 628, alt: '카더라' },
        ],
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
  const numId = Number(id);

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
      .select('*, profiles!posts_author_id_fkey(id,nickname,avatar_url,grade)')
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
          .select('id,title,likes_count,comments_count')
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

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13, color: 'var(--text-tertiary)' }}>
        <Link href="/feed" style={{ color: 'var(--brand)', textDecoration: 'none' }}>피드</Link>
        <span>›</span>
        <span style={{ padding: '1px 8px', borderRadius: 999, background: cat.bg, color: cat.color, fontSize: 11, fontWeight: 700 }}>
          {cat.label}
        </span>
      </div>

      {/* Post card */}
      <article style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 28px 24px', marginBottom: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          {post.profiles?.avatar_url ? (
            <img src={post.profiles.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--brand), var(--info))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: 'var(--text-inverse)',
            }}>
              {(post.profiles?.nickname ?? 'U')[0].toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', wordBreak: 'keep-all' }}>
                {GRADE_EMOJI[post.profiles?.grade as number] || '🌱'} {post.profiles?.nickname ?? '익명'}
              </span>
              {post.profiles?.grade && (
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {post.profiles.grade}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap' }}>
              {timeAgo(post.created_at)} · 조회 {(post.view_count ?? 0).toLocaleString()}
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <ReportButton postId={post.id} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }} />
          </div>
        </div>

        <h1 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {post.title}
        </h1>

        <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 24 }}>
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
            marginTop: 12,
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

        {/* Actions */}
        <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, display:'flex', alignItems:'center', gap:8 }}>
          <LikeButton postId={post.id} initialCount={post.likes_count ?? 0} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'6px 12px', borderRadius:20, background:'var(--bg-hover)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:13 }}>
            💬 <span>{comments.length.toLocaleString()}</span>
          </div>
          <ShareButtons title={post.title} postId={post.id} content={post.content} />
          <div style={{ display:'flex', justifyContent:'center', padding:'6px 12px' }}>
            <BookmarkButton postId={post.id} />
          </div>
        </div>
      </article>

      {/* Comments */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px', marginBottom: 16 }}>
        <CommentSection postId={post.id} initialComments={comments} />
      </div>

      {/* 관련 글 */}
      {related.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>관련 글</h3>
          {related.map((r: any, i: number) => (
            <Link key={r.id} href={`/feed/${r.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < related.length - 1 ? '1px solid var(--border)' : 'none', textDecoration: 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12 }}>{r.title}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>❤ {r.likes_count ?? 0} · 💬 {r.comments_count ?? 0}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
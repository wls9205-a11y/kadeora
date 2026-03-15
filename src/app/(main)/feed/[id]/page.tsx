import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_POSTS, CATEGORY_MAP } from '@/lib/constants';
import type { PostWithProfile, CommentWithProfile } from '@/types/database';
import { LikeButton } from '@/components/LikeButton';
import { CommentSection } from '@/components/CommentSection';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostActions from './PostActions';

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
      .select('*, profiles(id,nickname,avatar_url,grade)')
      .eq('id', numId)
      .eq('is_deleted', false)
      .single();

    if (postData) {
      post = postData as PostWithProfile;
      // Increment view count
      await sb.from('posts').update({ view_count: post.view_count + 1 }).eq('id', numId);

      const { data: commentsData } = await sb
        .from('comments')
        .select('*, profiles(id,nickname,avatar_url)')
        .eq('post_id', numId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(100);
      if (commentsData) comments = commentsData as CommentWithProfile[];
    }
  } catch {
    // fallback to demo
  }

  // Demo fallback
  if (!post) {
    const demoPost = DEMO_POSTS.find(p => p.id === numId);
    if (!demoPost) return notFound();
    post = demoPost;
    comments = [
      {
        id: 1, post_id: numId, user_id: 'demo-a', content: '좋은 정보 감사합니다! 많이 배워갑니다.',
        is_deleted: false, created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        profiles: { id: 'demo-a', nickname: '정보킹', avatar_url: null },
      },
      {
        id: 2, post_id: numId, user_id: 'demo-b', content: '저도 비슷한 생각이에요. 특히 두 번째 포인트가 핵심이라 봅니다.',
        is_deleted: false, created_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
        profiles: { id: 'demo-b', nickname: '투자마니아', avatar_url: null },
      },
    ];
  }

  const cat = CATEGORY_MAP[post.category] ?? CATEGORY_MAP.free;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13, color: '#64748B' }}>
        <Link href="/feed" style={{ color: '#3B82F6', textDecoration: 'none' }}>피드</Link>
        <span>›</span>
        <span style={{ padding: '1px 8px', borderRadius: 999, background: cat.bg, color: cat.color, fontSize: 11, fontWeight: 700 }}>
          {cat.label}
        </span>
      </div>

      {/* Post card */}
      <article style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 16, padding: '28px 28px 24px', marginBottom: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: 'white',
          }}>
            {(post.profiles?.nickname ?? 'U')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>
                {post.profiles?.nickname ?? '익명'}
              </span>
              {post.profiles?.grade && (
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 999, background: 'rgba(255,215,0,0.15)', color: '#FFD700', fontWeight: 600 }}>
                  {post.profiles.grade}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              {timeAgo(post.created_at)} · 조회 {post.view_count.toLocaleString()}
            </div>
          </div>
          {/* Author actions (edit/delete) */}
          <PostActions postId={post.id} authorId={post.author_id ?? ''} currentUserId={currentUserId} />
        </div>

        <h1 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 800, color: '#F1F5F9', lineHeight: 1.4 }}>
          {post.title}
        </h1>

        <div style={{ fontSize: 15, color: '#CBD5E1', lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 24 }}>
          {post.content}
        </div>

        {/* Actions */}
        <div style={{ borderTop: '1px solid #1E293B', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <LikeButton postId={post.id} initialCount={post.likes_count} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid #1E293B', color: '#94A3B8', fontSize: 14 }}>
            💬 <span>{comments.length.toLocaleString()}</span>
          </div>
        </div>
      </article>

      {/* Comments */}
      <div style={{ background: '#111827', border: '1px solid #1E293B', borderRadius: 16, padding: '24px 28px' }}>
        <CommentSection postId={post.id} initialComments={comments} />
      </div>
    </div>
  );
}

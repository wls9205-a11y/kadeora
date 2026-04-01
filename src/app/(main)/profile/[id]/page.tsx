import type { Metadata } from 'next';
import { createSupabaseServer } from '@/lib/supabase-server';
import ProfileClient from './ProfileClient';
import { DeleteAccountSection } from '@/components/DeleteAccountSection';
import FeedbackButton from '@/components/FeedbackButton';

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const sb = await createSupabaseServer();
  const { data: profile } = await sb.from('profiles').select('nickname').eq('id', id).single();
  return {
    title: `${profile?.nickname ?? '프로필'}`,
    robots: { index: false, follow: false },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const sb = await createSupabaseServer();
  let authUser = null;
  try {
    const { data: { user } } = await sb.auth.getUser();
    authUser = user;
  } catch { /* 비로그인 */ }
  const isOwner = authUser?.id === id;

  const [
    { data: profile },
    { data: posts },
    { count: commentCount },
    { count: followersCount },
    { count: followingCount },
    followCheck,
    { data: recentComments },
  ] = await Promise.all([
    sb.from('profiles').select('id,nickname,avatar_url,bio,grade,grade_title,influence_score,points,posts_count,likes_count,followers_count,following_count,streak_days,is_premium,is_admin,is_banned,is_seed,residence_city,residence_district,region_text,created_at,updated_at,interests').eq('id', id).single(),
    sb.from('posts').select('id,title,category,created_at,view_count,likes_count,comments_count').eq('author_id', id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(20),
    sb.from('comments').select('*', { count: 'exact', head: true }).eq('author_id', id).eq('is_deleted', false),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', id),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
    authUser
      ? sb.from('follows').select('follower_id').eq('follower_id', authUser.id).eq('followee_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from('comments').select('id,content,created_at,post_id').eq('author_id', id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(5),
  ]);

  return (
    <>
    <ProfileClient
      profile={profile as unknown as React.ComponentProps<typeof ProfileClient>['profile']}
      posts={posts ?? []}
      isOwner={isOwner}
      commentCount={commentCount ?? 0}
      followersCount={followersCount ?? 0}
      followingCount={followingCount ?? 0}
      isFollowing={!!(followCheck as { data: unknown }).data}
    />

    {/* 활동 통계 */}
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {[
          { label: '게시글', value: profile?.posts_count || posts?.length || 0 },
          { label: '댓글', value: commentCount || 0 },
          { label: '좋아요', value: profile?.likes_count || 0 },
          { label: '출석', value: profile?.streak_days || 0 },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', padding: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>

    {/* 최근 활동 타임라인 */}
    {((posts && posts.length > 0) || (recentComments && recentComments.length > 0)) && (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>최근 활동</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', paddingLeft: 16 }}>
          <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: 'var(--border)', borderRadius: 1 }} />
          {[
            ...(posts || []).slice(0, 3).map((p: any) => ({
              type: 'post' as const, title: p.title, date: p.created_at, href: `/feed/${p.id}`,
              emoji: p.category === 'stock' ? '📈' : p.category === 'apt' ? '🏢' : '💬',
            })),
            ...(recentComments || []).slice(0, 3).map((c: any) => ({
              type: 'comment' as const, title: (c.content || '').slice(0, 40), date: c.created_at, href: `/feed/${c.post_id}#comments`,
              emoji: '💬',
            })),
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map((item, i) => (
            <a key={i} href={item.href} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0', textDecoration: 'none', color: 'inherit', position: 'relative' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.type === 'post' ? 'var(--brand)' : 'var(--accent-green)', border: '2px solid var(--bg-base)', flexShrink: 0, marginTop: 3, position: 'relative', zIndex: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.emoji} {item.title}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {item.type === 'post' ? '글 작성' : '댓글'} · {new Date(item.date).toLocaleDateString('ko-KR')}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    )}
      {isOwner && (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 20px' }}>
          <FeedbackButton />
        </div>
      )}
      {isOwner && <DeleteAccountSection />}
    </>
  );
}
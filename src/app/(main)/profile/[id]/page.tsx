import type { Metadata } from 'next';
import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import ProfileClient from './ProfileClient';
import { DeleteAccountSection } from '@/components/DeleteAccountSection';

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
  const { data: { user: authUser } } = await sb.auth.getUser();
  const isOwner = authUser?.id === id;

  const [
    { data: profile },
    { data: posts },
    { count: commentCount },
    { count: followersCount },
    { count: followingCount },
    followCheck,
  ] = await Promise.all([
    sb.from('profiles').select('*').eq('id', id).single(),
    sb.from('posts').select('id,title,category,created_at,view_count,likes_count,comments_count').eq('author_id', id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(20),
    sb.from('comments').select('*', { count: 'exact', head: true }).eq('author_id', id).eq('is_deleted', false),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', id),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
    authUser
      ? sb.from('follows').select('follower_id').eq('follower_id', authUser.id).eq('followee_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
    <ProfileClient
      profile={profile}
      posts={posts ?? []}
      isOwner={isOwner}
      commentCount={commentCount ?? 0}
      followersCount={followersCount ?? 0}
      followingCount={followingCount ?? 0}
      isFollowing={!!(followCheck as { data: unknown }).data}
    />
      {isOwner && <DeleteAccountSection />}
    </>
  );
}
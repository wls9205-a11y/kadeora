import { createSupabaseServer } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import ProfileClient from './ProfileClient';

interface Props { params: Promise<{ id: string }> }

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const sb = await createSupabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  const isOwner = session?.user?.id === id;

  const { data: profile } = await sb.from('profiles').select('*').eq('id', id).single();
  if (!profile) return notFound();

  const { data: posts } = await sb.from('posts')
    .select('id,title,category,created_at,view_count,likes_count,comments_count')
    .eq('author_id', id)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20);

  const { count: commentCount } = await sb.from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', id)
    .eq('is_deleted', false);

  return (
    <ProfileClient
      profile={profile}
      posts={posts ?? []}
      isOwner={isOwner}
      commentCount={commentCount ?? 0}
    />
  );
}
import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AdminClient from './AdminClient';

const ADMIN_IDS = [
  '265d8c3b-bd40-40c1-b7d2-bdde16a88204', // 어드민 (kakao)
  'b7b4dd42-4685-4ca6-9ee3-dfedf82e86f2', // 어드민2 (email)
];

export const metadata = { title: '관리자 대시보드' };

export default async function AdminPage() {
  const sb = await createSupabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  if (!session || !ADMIN_IDS.includes(session.user.id)) redirect('/feed');

  const [
    { count: totalUsers },
    { count: totalPosts },
    { count: totalComments },
    { data: recentUsers },
    { data: recentPosts },
    { data: reports },
  ] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('posts').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
    sb.from('comments').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
    sb.from('profiles').select('id,nickname,provider,grade,points,created_at').order('created_at', { ascending: false }).limit(10),
    sb.from('posts').select('id,title,author_id,view_count,likes_count,created_at,profiles!posts_author_id_fkey(nickname)').eq('is_deleted', false).order('created_at', { ascending: false }).limit(10),
    sb.from('content_reports').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  return (
    <AdminClient
      stats={{ totalUsers: totalUsers ?? 0, totalPosts: totalPosts ?? 0, totalComments: totalComments ?? 0 }}
      recentUsers={recentUsers ?? []}
      recentPosts={recentPosts ?? []}
      reports={reports ?? []}
    />
  );
}
import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AdminHub from './AdminHub';

export const metadata = {
  title: '카더라 컨트롤 타워',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/feed');

  return <AdminHub />;
}

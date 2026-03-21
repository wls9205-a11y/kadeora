import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AdminCommandCenter from './AdminCommandCenter';

export const metadata = {
  title: '카더라 커맨드센터',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/feed');

  // Fetch health checks for header status dots
  const { data: healthChecks } = await supabase.from('health_checks').select('service_name, status');

  return <AdminCommandCenter healthChecks={healthChecks || []} />;
}

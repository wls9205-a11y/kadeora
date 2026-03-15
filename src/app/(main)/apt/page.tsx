import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_APT } from '@/lib/constants';
import AptClient from './AptClient';

export default async function AptPage() {
  let apts = DEMO_APT;
  let isDemo = true;

  try {
    const sb = await createSupabaseServer();
    const { data } = await sb.from('apt_subscriptions').select('*').order('application_start', { ascending: true });
    if (data && data.length > 0) { apts = data; isDemo = false; }
  } catch {}

  return <AptClient apts={apts} isDemo={isDemo} />;
}

import { Suspense } from 'react';
import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_DISCUSS } from '@/lib/constants';
import DiscussClient from './DiscussClient';

export default async function DiscussPage() {
  let rooms = DEMO_DISCUSS;

  try {
    const sb = await createSupabaseServer();
    const { data } = await sb.from('discussion_rooms').select('*').eq('is_active', true).order('messages_count', { ascending: false });
    if (data && data.length > 0) { rooms = data; }
  } catch {}

  return (
    <Suspense>
      <DiscussClient rooms={rooms} />
    </Suspense>
  );
}

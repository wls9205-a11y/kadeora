import type { Metadata } from 'next';
import { Suspense } from 'react';
import { createSupabaseServer } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: '토론방',
  description: '주식·아파트 실시간 토론 — 카더라 커뮤니티',
};
import { DEMO_DISCUSS } from '@/lib/constants';
import DiscussClient from './DiscussClient';
import Disclaimer from '@/components/Disclaimer';

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
      <Disclaimer />
    </Suspense>
  );
}

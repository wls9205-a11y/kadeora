import type { Metadata } from 'next';
export const metadata: Metadata = { title: '청약 정보', description: '최신 아파트 청약 일정 및 분양 정보 — 전국 청약 한눈에 보기' };
import { createSupabaseServer } from '@/lib/supabase-server';
import { DEMO_APT } from '@/lib/constants';
import AptClient from './AptClient';

export default async function AptPage() {
  let apts = DEMO_APT;
  let isDemo = true;

  try {
    const sb = await createSupabaseServer();
    const { data } = await sb.from('apt_subscriptions').select('*').order('rcept_bgnde', { ascending: true });
    if (data && data.length > 0) { apts = data; isDemo = false; }
  } catch {}

  return <AptClient apts={apts} isDemo={isDemo} />;
}

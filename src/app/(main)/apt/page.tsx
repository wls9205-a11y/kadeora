import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '청약 정보',
  description: '전국 아파트 청약 일정 및 지역별 청약 정보 조회',
};
import { createSupabaseServer } from '@/lib/supabase-server';
import AptClient from './AptClient';

export default async function AptPage() {
  let apts: any[] = [];
  let isDemo = true;

  try {
    const sb = await createSupabaseServer();
    const { data } = await sb
      .from('apt_subscriptions')
      .select('*')
      .order('rcept_bgnde', { ascending: true });
    if (data && data.length > 0) {
      apts = data;
      isDemo = false;
    }
  } catch {}

  return <AptClient apts={apts} isDemo={isDemo} />;
}
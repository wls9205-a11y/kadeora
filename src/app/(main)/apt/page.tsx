import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '아파트 청약 일정',
  description: '2026년 전국 아파트 청약 일정과 분양 정보를 한눈에 확인하세요.',
};
export const revalidate = 300;
import { createSupabaseServer } from '@/lib/supabase-server';
import AptClient from './AptClient';
import Disclaimer from '@/components/Disclaimer';

export default async function AptPage() {
  let apts: any[] = [];
  let unsold: any[] = [];

  let alertCounts: Record<string, number> = {};

  try {
    const sb = await createSupabaseServer();
    const [aptsR, unsoldR, alertsR] = await Promise.all([
      sb.from('apt_subscriptions').select('*')
        .or(`rcept_endde.gte.${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)},rcept_bgnde.lte.${new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`)
        .order('rcept_bgnde', { ascending: false }).limit(300),
      sb.from('unsold_apts').select('*').eq('is_active', true).order('tot_unsold_hshld_co', { ascending: false }),
      sb.from('apt_alerts').select('house_manage_no'),
    ]);
    if (aptsR.data?.length) apts = aptsR.data;
    if (unsoldR.data?.length) unsold = unsoldR.data;
    (alertsR.data || []).forEach((a: any) => { alertCounts[a.house_manage_no] = (alertCounts[a.house_manage_no] || 0) + 1; });
  } catch {}

  return <><AptClient apts={apts} unsold={unsold} alertCounts={alertCounts} /><Disclaimer /></>;
}
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: '아파트 청약 일정',
  description: '2026년 전국 아파트 청약 일정과 분양 정보를 한눈에 확인하세요.',
};
import { createSupabaseServer } from '@/lib/supabase-server';
import AptClient from './AptClient';
import Disclaimer from '@/components/Disclaimer';

export default async function AptPage() {
  let apts: { id: number; house_nm: string; region_nm: string; hssply_adres: string; tot_supply_hshld_co: number; rcept_bgnde: string; rcept_endde: string; spsply_rcept_bgnde: string; spsply_rcept_endde: string; przwner_presnatn_de: string; cntrct_cncls_bgnde: string; cntrct_cncls_endde: string; mvn_prearnge_ym: string; pblanc_url: string; mdatrgbn_nm: string }[] = [];

  try {
    const sb = await createSupabaseServer();
    const { data } = await sb
      .from('apt_subscriptions')
      .select('*')
      .order('rcept_bgnde', { ascending: false });
    if (data && data.length > 0) {
      apts = data;
    }
  } catch {}

  return <><AptClient apts={apts} /><Disclaimer /></>;
}
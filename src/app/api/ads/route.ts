import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const revalidate = 1800;

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const twoWeeks = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);

    // 1) 유료 광고 (popup_ads — display_type='banner')
    let paid: R[] = [];
    try {
      const { data } = await (admin as any)
        .from('popup_ads').select('id,title,content,image_url,link_url')
        .eq('is_active', true).eq('display_type', 'banner')
        .gte('end_date', today).lte('start_date', today)
        .order('priority', { ascending: false }).limit(3);
      paid = (data || []).map((a: R) => ({
        id: `paid-${a.id}`, title: a.title, subtitle: a.content || '',
        badge: 'AD', badgeColor: '#FBBF24', region: '',
        link: a.link_url || '/apt', imageUrl: a.image_url || undefined, isPaid: true,
      }));
    } catch { /* popup_ads 조회 실패해도 무방 */ }

    // 2) 청약 예정 현장 (14일 이내)
    const { data: subs } = await (admin as any)
      .from('apt_subscriptions')
      .select('house_manage_no, house_nm, region_nm, rcept_bgnde, tot_supply_hshld_co, constructor_nm')
      .gte('rcept_bgnde', today)
      .lte('rcept_bgnde', twoWeeks)
      .order('rcept_bgnde', { ascending: true })
      .limit(8);

    const free = (subs || []).map((s: R) => {
      const bgnDate = new Date(s.rcept_bgnde);
      const diffDays = Math.ceil((bgnDate.getTime() - now.getTime()) / 86400000);
      const dDay = diffDays <= 0 ? '접수중' : `D-${diffDays}`;
      const units = s.tot_supply_hshld_co ? `${Number(s.tot_supply_hshld_co).toLocaleString()}세대` : '';
      const builder = s.constructor_nm ? String(s.constructor_nm).replace(/\(주\)|주식회사| /g, '').slice(0, 6) : '';
      const dateStr = String(s.rcept_bgnde).slice(5).replace('-', '/');
      const parts = [units, `${dateStr} 접수`, builder].filter(Boolean).join(' · ');

      return {
        id: `sub-${s.house_manage_no}`, title: s.house_nm,
        subtitle: parts, badge: `청약 ${dDay}`,
        badgeColor: diffDays <= 1 ? '#EF4444' : '#3B7BF6',
        region: s.region_nm || '', link: '/apt?tab=subscription',
        imageUrl: undefined, isPaid: false,
      };
    });

    return NextResponse.json({ ads: [...paid, ...free].slice(0, 8) }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('[ads]', err);
    return NextResponse.json({ ads: [] }, { status: 200 });
  }
}

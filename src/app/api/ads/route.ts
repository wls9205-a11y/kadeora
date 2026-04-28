import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const revalidate = 1800;
export const dynamic = 'force-dynamic'; // s168: 빌드타임 DB 호출 제거
// s206: 60s default → 10s — 느린 JOIN 으로 504 발생 시 함수 pool 보호.
export const maxDuration = 10;

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

// s206: 개별 Supabase 쿼리당 6s timeout. JOIN/파생 매핑 한 단계가 느려도 전체 함수 보호.
// supabase builder 가 thenable 이라 Promise<any> 로 캐스트 후 race.
function withTimeout(p: any, ms = 6000): Promise<any> {
  return Promise.race([
    p as Promise<any>,
    new Promise<any>((_, reject) => setTimeout(() => reject(new Error(`timeout_${ms}ms`)), ms)),
  ]);
}

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const twoWeeks = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);

    // 1) 유료 광고 (popup_ads — display_type='banner')
    let paid: R[] = [];
    try {
      const { data } = await withTimeout((admin as any)
        .from('popup_ads').select('id,title,content,image_url,link_url')
        .eq('is_active', true).eq('display_type', 'banner')
        .gte('end_date', today).lte('start_date', today)
        .order('priority', { ascending: false }).limit(3));
      paid = (data || []).map((a: R) => ({
        id: `paid-${a.id}`, title: a.title, subtitle: a.content || '',
        badge: 'AD', badgeType: 'ad' as const,
        region: '', link: a.link_url || '/apt',
        imageUrl: a.image_url || undefined, isPaid: true,
      }));
    } catch { /* 무시 */ }

    // 2) 청약 예정 현장 + apt_sites slug JOIN
    let subs: R[] = [];
    try {
      const { data } = await withTimeout((admin as any)
        .from('apt_subscriptions')
        .select('house_manage_no, house_nm, region_nm, rcept_bgnde, tot_supply_hshld_co, constructor_nm')
        .gte('rcept_bgnde', today)
        .lte('rcept_bgnde', twoWeeks)
        .order('rcept_bgnde', { ascending: true })
        .limit(8));
      subs = data || [];
    } catch { /* 무시 — 청약 데이터 없이 paid 만 반환 */ }

    // apt_sites에서 slug 매칭
    const names = subs.map((s: R) => s.house_nm);
    let slugMap: Record<string, string> = {};
    if (names.length) {
      try {
        const { data: sites } = await withTimeout((admin as any)
          .from('apt_sites').select('name, slug')
          .in('name', names));
        slugMap = Object.fromEntries((sites || []).map((s: R) => [s.name, s.slug]));
      } catch { /* slug 없이 fallback link 사용 */ }
    }

    const free = subs.map((s: R) => {
      const bgnDate = new Date(s.rcept_bgnde);
      const diffDays = Math.ceil((bgnDate.getTime() - now.getTime()) / 86400000);
      const dDay = diffDays <= 0 ? '접수중' : `D-${diffDays}`;
      const units = s.tot_supply_hshld_co ? `${Number(s.tot_supply_hshld_co).toLocaleString()}세대` : '';
      const builder = s.constructor_nm ? String(s.constructor_nm).replace(/\(주\)|주식회사| /g, '').slice(0, 6) : '';
      const dateStr = String(s.rcept_bgnde).slice(5).replace('-', '/');
      const parts = [units, `${dateStr} 접수`, builder].filter(Boolean).join(' · ');
      const slug = slugMap[s.house_nm];

      return {
        id: `sub-${s.house_manage_no}`, title: s.house_nm,
        subtitle: parts,
        badge: `청약 ${dDay}`,
        badgeType: diffDays <= 1 ? 'urgent' : 'upcoming' as string,
        region: s.region_nm || '',
        link: slug ? `/apt/${slug}` : '/apt?tab=subscription',
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

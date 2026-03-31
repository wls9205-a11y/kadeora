import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const revalidate = 60;

/** GET /api/popup — 현재 활성 팝업 조회 (경로 기반 필터) */
export async function GET(req: NextRequest) {
  const page = req.nextUrl.searchParams.get('page') || '/feed';
  const sb = getSupabaseAdmin() as any;
  const now = new Date().toISOString();

  const { data } = await sb.from('popup_ads')
    .select('id, title, content, image_url, link_url, link_label, position, display_type, dismiss_duration_hours, priority')
    .eq('is_active', true)
    .lte('start_date', now)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .or(`max_impressions.is.null,current_impressions.lt.max_impressions`)
    .order('priority', { ascending: false })
    .limit(3);

  // 경로 기반 필터
  const filtered = (data || []).filter((p: any) => {
    const targets = p.target_pages || [];
    if (targets.length === 0) return true; // 빈 배열 = 전체 페이지
    return targets.some((t: string) => page.startsWith(t));
  });

  // 노출 카운트 증가 (비동기 — 응답 블로킹 안 함)
  for (const p of filtered) {
    sb.rpc('increment_popup_impression', { popup_id: p.id }).catch(() => {});
  }

  return NextResponse.json({ popups: filtered }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}

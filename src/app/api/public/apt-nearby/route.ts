import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "api"); if (!rl.success) return rl.response;
  const sp = req.nextUrl.searchParams;
  const apt = sp.get('apt');
  const sigungu = sp.get('sigungu');
  if (!apt || !sigungu) return NextResponse.json({ error: 'apt and sigungu required' }, { status: 400 });
  /* ⚠️ `p_region` 을 «반드시» 넘긴다. 시군구 이름은 전국에서 유일하지 않다 —
   *    174개 중 66개(38%)가 복수 시도에 걸치고, 부산 핵심 자치구가 전부 거기 든다
   *    (동구 7 · 서구 6 · 중구 6 · 남구 5 · 북구 5 · 강서구 3).
   *    안 넘기면 부산 북구 단지의 「주변 단지」에 대구 북구 단지가 섞인다(실측).
   *    RPC 는 DEFAULT NULL 이라 «빼먹어도 에러가 안 난다» — 조용히 옛 동작으로 돌아간다.
   *    그래서 없으면 400 으로 막는다. 조용한 오염보다 낫다. */
  const region = sp.get('region');
  if (!region) return NextResponse.json({ error: 'region required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('get_nearby_apt_compare', {
    p_apt_name: apt, p_sigungu: sigungu, p_limit: 5, p_region: region,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

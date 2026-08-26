import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(req, "api"); if (!rl.success) return rl.response;
  const sp = req.nextUrl.searchParams;
  const apt = sp.get('apt');
  if (!apt) return NextResponse.json({ error: 'apt required' }, { status: 400 });
  const sigungu = sp.get('sigungu') || null;
  const sb = getSupabaseAdmin();
  /* ⚠️ `p_region` 을 «요구» 한다. 시군구 이름은 전국에서 유일하지 않다 —
   *    174개 중 66개가 복수 시도에 걸치고(동구 7 · 서구 6 · 중구 6 · 남구 5 · 북구 5),
   *    부산 핵심 자치구가 전부 거기 든다. 인자는 DEFAULT NULL 이라 «빼먹어도 에러가 안 나고»
   *    조용히 전국을 섞은 값이 나간다. 쓰는 쪽은 그게 섞인 값인지 알 수 없으므로 400 이 낫다.
   *    (내부 소비처 0곳 — 외부 사용자가 있다면 이 두 줄만 지우면 예전처럼 동작한다.) */
  const region = sp.get('region');
  if (!region) return NextResponse.json({ error: 'region required' }, { status: 400 });

  const { data, error } = await (sb as any).rpc('get_apt_jeonse_trend', {
    p_apt_name: apt, p_sigungu: sigungu, p_months: 24, p_region: region,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

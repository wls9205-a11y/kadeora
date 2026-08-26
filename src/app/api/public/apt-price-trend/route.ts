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
  /* ⚠️ 부르는 함수가 바뀌었다: `get_apt_price_trend` → `get_apt_price_trend_monthly`.
   *    옛 3인자 오버로드가 «월별 집계» 를 내던 자리다. 지금 `get_apt_price_trend` 는
   *    개별 거래를 내므로(차트가 쓰는 쪽) 여기서 부르면 반환 형태가 통째로 달라진다.
   * ⚠️ `region` 을 «요구» 한다. 이름을 정확일치로 봐도 같은 이름이 여러 시도에 있다
   *    (`현대` 는 서울 16 · 경기 14 · 부산 9개 시군구). 안 받으면 조용히 합쳐진 값이 나가고,
   *    쓰는 쪽은 그게 합쳐진 값인지 알 방법이 없다. 400 이 낫다.
   *    (내부 소비처는 0곳이다 — 외부 사용자가 있다면 이 줄을 지우면 예전처럼 동작한다.) */
  const region = sp.get('region');
  if (!region) return NextResponse.json({ error: 'region required' }, { status: 400 });
  const sigungu = sp.get('sigungu') || null;
  const months = Math.min(parseInt(sp.get('months') || '24'), 36);
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('get_apt_price_trend_monthly', {
    p_apt_name: apt, p_region: region, p_sigungu: sigungu, p_months: months,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

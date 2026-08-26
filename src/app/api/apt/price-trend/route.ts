import { errMsg } from '@/lib/error-utils';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req); if (!rl) return rateLimitResponse();
  try {
    const sb = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const aptName = searchParams.get('name');
    const region = searchParams.get('region');
    const sigungu = searchParams.get('sigungu');
    const prefix = searchParams.get('prefix') === '1';

    if (!aptName) return NextResponse.json({ error: 'name 파라미터 필요' }, { status: 400 });

    /* RPC 먼저 시도.
     * ⚠️ `p_sigungu` 를 «빼먹지 말 것». 시군구 이름이 전국에서 유일하지 않고(174개 중 66개가
     *    복수 시도), 같은 시도 안에도 같은 이름 단지가 여럿이다 — `현대` 는 부산에만
     *    9개 시군구 180건이다. 인자는 DEFAULT NULL 이라 빼먹어도 «에러가 안 난다». */
    const { data: rpcData, error: rpcErr } = await sb.rpc('get_apt_price_trend', {
      p_apt_name: aptName,
      p_region: region || undefined,
      p_sigungu: sigungu || undefined,
      p_prefix: prefix,
    });

    if (!rpcErr && rpcData?.length) {
      // 통계 계산
      const prices = rpcData.map((r: any) => r.price).filter((p: number) => p > 0);
      const stats = {
        count: prices.length,
        max: Math.max(...prices),
        min: Math.min(...prices),
        avg: Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length),
        latest: prices[0] || 0,
      };

      return NextResponse.json({ trend: rpcData, stats }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    /* RPC 실패 시 직접 쿼리.
     *
     * ⚠️ **`ilike('%이름%')` 로 되돌리지 말 것.** 예전 코드가 그랬고, 그건 RPC 가 방금
     *    걷어낸 바로 그 결함이다 — 부분 문자열 매칭은 부산 「현대」 차트 하나에 서로 다른
     *    단지 59곳·13개 시군구·2,311건을 합쳐 넣었다. 게다가 이 폴백은 지역 조건이
     *    «아예 없어» RPC 보다도 넓었다.
     *
     * ⚠️ 이 분기는 RPC 가 «0건을 내도» 탄다(`rpcData?.length` 검사). RPC 가 이름을
     *    정확일치로 보게 된 뒤로 0건이 잦아졌으므로, 폴백이 넓으면 그 자리마다
     *    전국 뭉텅이가 대신 들어간다. 폴백은 RPC 와 «같은 좁기» 여야 한다.
     *
     * 그래서 정확일치 + 지역으로 맞춘다. 못 찾으면 빈 차트가 맞다 — 틀린 그래프보다 낫다. */
    let q = sb.from('apt_transactions')
      .select('deal_date, deal_amount, exclusive_area, apt_name, region_nm');
    // 접두 플래그가 켜진 단지만 접두로 본다 (RPC 와 같은 규칙).
    q = prefix ? q.like('apt_name', `${aptName.replace(/\s+/g, '')}%`) : q.eq('apt_name', aptName);
    if (region) q = q.eq('region_nm', region);
    if (sigungu) q = q.eq('sigungu', sigungu);
    const { data, error } = await q
      .order('deal_date', { ascending: false })
      .limit(100);

    if (error) throw error;

    const trend = ((data || []) as Record<string, unknown>[]).map((t: Record<string, any>) => ({
      deal_date: t.deal_date,
      price: t.deal_amount,
      area: t.exclusive_area,
      price_per_pyeong: t.exclusive_area > 0
        ? Math.round(t.deal_amount / (t.exclusive_area / 3.3058))
        : 0,
    }));

    const prices = trend.map(t => t.price).filter(p => p > 0);
    const stats = prices.length > 0 ? {
      count: prices.length,
      max: Math.max(...prices),
      min: Math.min(...prices),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      latest: prices[0] || 0,
    } : { count: 0, max: 0, min: 0, avg: 0, latest: 0 };

    return NextResponse.json({ trend, stats }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}

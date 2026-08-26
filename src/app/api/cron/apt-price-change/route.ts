import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  /* ⚠️ **이 라우트는 실행되지 않는다. 되살리지 말 것.** (2026-08-26)
   *
   * 이게 부르던 `recalc_price_change_1y()` 는 `GROUP BY apt_name, sigungu` 뿐이라
   * **평형이 없다**. price_change_1y 는 이제 「대표 평형 1개 기준」 값이고 근거 3개
   * (price_change_area · n_recent · n_past)와 «짝» 으로만 의미가 있다.
   *
   * 이 RPC 를 돌리면 최악의 조합이 나온다:
   *   ① price_change_1y 만 평형 섞인 값으로 덮어쓰고
   *   ② 근거 3개는 «옛 평형 그대로» 남는다
   * → 화면 게이트(canShowPriceChange)가 통과하고, 섞인 %가 «엉뚱한 평형 라벨» 을 달고 나간다.
   *   지금(2026-08-26) vercel.json 에 이 크론은 등록돼 있지 않다. 정본은
   *   `/api/cron/price-change-calc`(`calc_apt_price_change_1y`, 월요일 06:30) 하나다.
   *
   * DB 쪽에서 `recalc_price_change_1y()` 를 지우면 이 파일도 같이 지울 것. */
  const result = {
    success: true as const,
    processed: 0,
    created: 0,
    failed: 0,
    metadata: {
      disabled: true,
      reason: 'recalc_price_change_1y() 는 평형 미고정이라 근거 컬럼과 어긋난다',
      use_instead: '/api/cron/price-change-calc',
    },
  };
  console.warn('[apt-price-change] 비활성 라우트가 호출됐다 — /api/cron/price-change-calc 를 쓸 것');

  return NextResponse.json({ ok: true, ...result });
}

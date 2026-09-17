import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/stats/social-proof
 * 
 * 실제 DB 기반 소셜프루프 숫자 제공
 * 1시간 캐시 (revalidate: 3600)
 * 
 * 반환 예시:
 * {
 *   dailyVisitors: 1373,      // DAU 7일 평균
 *   peakVisitors: 3935,       // DAU 최고치
 *   todayVisitors: 1208,      // 오늘 DAU
 *   totalViews: 692287,       // 블로그 누적 조회수
 *   blogCount: 7623,          // published 블로그 수
 *   stockCount: 1846,         // 주식 종목 수
 *   complexCount: 34537,      // 아파트 단지 수
 *   subscriptionCount: 2713,  // 분양 단지 수
 *   tradeDataCount: 2619875,  // 실거래+전세 데이터 합산
 *   totalDataPoints: 3355919, // 전체 데이터포인트
 *   userCount: 86,            // 실유저
 * }
 */

export const revalidate = 3600; // 1시간 ISR 캐시
export const dynamic = 'force-dynamic'; // s168: 빌드타임 DB 호출 제거

export async function GET() {
  try {
    const sb = getSupabaseAdmin();

    /**
     * ⛔ K-10 ② (2026-09-17) — 여기 있던 «exact count 7발» 이 2026-09-16 장애의 발화원이었다.
     *
     * apt_rent_transactions 240만 · apt_transactions 80만 행에 대한 exact count 는 전체 스캔이라
     * 플래너가 parallel worker 2개를 붙인다. max_worker_processes=6 인 인스턴스에서 그 워커들이
     * 슬롯을 먹자 pg_cron 이 background worker 를 fork 하지 못했고 —
     *   job startup timeout 연쇄 → kill-slow-queries(방어) 붕괴 → 느린 질의 누적
     *   → statement timeout 폭증 → 프로덕션 504
     * 로 이어졌다. 실패는 전부 「실행 후 실패」가 아니라 «시작조차 못 함» 이었다 — 잡은 피해자다.
     *
     * ⚠️ 소셜프루프는 «정의상 정밀이 필요 없다». 「240만+」를 보여주는 자리에 240만 행을
     *    매 요청 정확히 세는 것은 근거가 없었다. reltuples 추정으로 충분하고, RPC 한 번이라
     *    왕복도 7회 → 1회로 준다.
     * ⛔ 정확한 수가 필요해지면 이 자리에 exact 를 되돌리지 말고 «크론 캐시» 를 쓴다.
     *    핫패스에서 대형 표를 세는 구조 자체가 재발 경로다.
     */
    const [blogStats, counts, dauStats] = await Promise.all([
      // 블로그: RPC로 정확한 count + sum (Supabase 1000행 limit 회피)
      (sb as any).rpc('get_blog_stats'),
      // 규모 카운트: reltuples 추정 + profiles 만 exact (작은 표·조건부·의미상 정확 필요)
      (sb as any).rpc('get_social_proof_counts'),
      // DAU 통계 (최근 14일)
      (sb as any).from('daily_stats')
        .select('dau, stat_date')
        .order('stat_date', { ascending: false })
        .limit(14),
    ]);
    const c = counts?.data?.[0] ?? {};

    // 블로그 집계 (RPC 결과: [{blog_count, total_views}])
    const blogRow = blogStats.data?.[0] || { blog_count: 0, total_views: 0 };
    const blogCount = Number(blogRow.blog_count) || 0;
    const totalViews = Number(blogRow.total_views) || 0;

    // DAU 집계
    const dauData = (dauStats.data || []).map((d: any) => d.dau || 0);
    const todayVisitors = dauData[0] || 0;
    const peakVisitors = Math.max(...dauData, 0);
    const recentDau = dauData.slice(0, 7);
    const dailyVisitors = recentDau.length > 0
      ? Math.round(recentDau.reduce((a: number, b: number) => a + b, 0) / recentDau.length)
      : 0;

    // 카운트 집계 — 추정값이라 NULL 이면 0 이 아니라 «모름» 이지만, 소셜프루프 표시상 0 으로 접는다.
    //   ⚠️ reltuples 가 -1(미분석)이면 RPC 가 NULL 을 준다. 그때 큰 수를 지어내지 않는 쪽이 맞다.
    const stocks = Number(c.stock_count) || 0;
    const complexes = Number(c.complex_count) || 0;
    const subscriptions = Number(c.subscription_count) || 0;
    const trades = Number(c.trade_count) || 0;
    const rents = Number(c.rent_count) || 0;
    const prices = Number(c.price_history_count) || 0;
    const users = Number(c.user_count) || 0;

    const tradeDataCount = trades + rents;
    const totalDataPoints = trades + rents + prices + totalViews;

    return NextResponse.json({
      dailyVisitors,
      peakVisitors,
      todayVisitors,
      totalViews,
      blogCount,
      stockCount: stocks,
      complexCount: complexes,
      subscriptionCount: subscriptions,
      tradeDataCount,
      totalDataPoints,
      userCount: users,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[social-proof]', e);
    // 폴백: 에러 시에도 합리적인 숫자 반환
    return NextResponse.json({
      dailyVisitors: 1300,
      peakVisitors: 3900,
      todayVisitors: 1200,
      totalViews: 690000,
      blogCount: 7600,
      stockCount: 1800,
      complexCount: 34500,
      subscriptionCount: 2700,
      tradeDataCount: 2600000,
      totalDataPoints: 3300000,
      userCount: 80,
      updatedAt: new Date().toISOString(),
      fallback: true,
    });
  }
}

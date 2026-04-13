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

export async function GET() {
  try {
    const sb = getSupabaseAdmin();

    const [
      blogStats,
      stockCount,
      complexCount,
      subscriptionCount,
      tradeCount,
      rentCount,
      priceHistoryCount,
      userCount,
      dauStats,
    ] = await Promise.all([
      // 블로그: RPC로 정확한 count + sum (Supabase 1000행 limit 회피)
      sb.rpc('get_blog_stats'),
      // 주식 종목 수
      (sb as any).from('stock_quotes')
        .select('symbol', { count: 'exact', head: true }),
      // 아파트 단지
      (sb as any).from('apt_complex_profiles')
        .select('id', { count: 'exact', head: true }),
      // 분양 단지
      (sb as any).from('apt_subscriptions')
        .select('id', { count: 'exact', head: true }),
      // 실거래
      (sb as any).from('apt_transactions')
        .select('id', { count: 'exact', head: true }),
      // 전세
      (sb as any).from('apt_rent_transactions')
        .select('id', { count: 'exact', head: true }),
      // 주가 데이터
      (sb as any).from('stock_price_history')
        .select('id', { count: 'exact', head: true }),
      // 실유저
      sb.from('profiles')
        .select('id', { count: 'exact', head: true })
        .neq('is_seed', true)
        .neq('is_deleted', true),
      // DAU 통계 (최근 14일)
      (sb as any).from('daily_stats')
        .select('dau, stat_date')
        .order('stat_date', { ascending: false })
        .limit(14),
    ]);

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

    // 카운트 집계
    const stocks = stockCount.count || 0;
    const complexes = complexCount.count || 0;
    const subscriptions = subscriptionCount.count || 0;
    const trades = tradeCount.count || 0;
    const rents = rentCount.count || 0;
    const prices = priceHistoryCount.count || 0;
    const users = userCount.count || 0;

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

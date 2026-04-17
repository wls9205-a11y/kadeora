export const maxDuration = 60;
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

/**
 * 주식 히어로 캐러셀 슬라이드 일일 자동 갱신
 * 매일 09:30 KST (장 개장 후) + 15:40 (마감 후) 실행
 * 
 * 슬라이드 7종:
 * 1. 오늘의 급등주 TOP 5
 * 2. 오늘의 급락주 TOP 5
 * 3. 거래량 TOP 5
 * 4. 52주 신고가 종목
 * 5. 테마 시황
 * 6. 수급 시그널
 * 7. 이번 주 공모주
 */

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-hero-refresh', async () => {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const kstDate = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);

    // 기존 슬라이드 비활성화
    await (supabase as any).from('stock_hero_slides')
      .update({ is_active: false })
      .lt('active_from', new Date(now.getTime() - 24 * 3600000).toISOString());

    // 주식 데이터 가져오기
    const { data: stocks } = await supabase
      .from('stock_quotes')
      .select('symbol, name, price, change_pct, change_amt, volume, market_cap, sector, market')
      .eq('is_active', true)
      .order('market_cap', { ascending: false })
      .limit(2000);

    const allStocks = (stocks || []).filter(s => {
      const pct = Number(s.change_pct ?? 0);
      return pct >= -35 && pct <= 35;
    });

    const slides: Array<{
      slide_order: number;
      title_ko: string;
      subtitle_ko: string;
      slide_type: string;
      link_url: string;
      data: any;
    }> = [];

    // 1. 급등주
    const gainers = [...allStocks]
      .filter(s => Number(s.change_pct ?? 0) > 0)
      .sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0))
      .slice(0, 5);
    if (gainers.length) {
      slides.push({
        slide_order: 1,
        title_ko: `${gainers[0].name} +${Number(gainers[0].change_pct).toFixed(1)}% 외 ${gainers.length - 1}종목 강세`,
        subtitle_ko: `오늘의 급등주 TOP ${gainers.length}`,
        slide_type: 'gainers',
        link_url: '/stock/movers',
        data: { items: gainers.map(s => ({ symbol: s.symbol, name: s.name, change_pct: Number(s.change_pct) })) },
      });
    }

    // 2. 급락주
    const losers = [...allStocks]
      .filter(s => Number(s.change_pct ?? 0) < 0)
      .sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0))
      .slice(0, 5);
    if (losers.length) {
      slides.push({
        slide_order: 2,
        title_ko: `${losers[0].name} ${Number(losers[0].change_pct).toFixed(1)}% 외 ${losers.length - 1}종목 약세`,
        subtitle_ko: `오늘의 급락주 TOP ${losers.length}`,
        slide_type: 'losers',
        link_url: '/stock/movers',
        data: { items: losers.map(s => ({ symbol: s.symbol, name: s.name, change_pct: Number(s.change_pct) })) },
      });
    }

    // 3. 거래량 TOP
    const volumeTop = [...allStocks]
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, 5);
    if (volumeTop.length) {
      slides.push({
        slide_order: 3,
        title_ko: `거래량 TOP — ${volumeTop[0].name} 외 ${volumeTop.length - 1}종목`,
        subtitle_ko: '시장의 관심이 집중되는 종목',
        slide_type: 'volume',
        link_url: '/stock/movers',
        data: { items: volumeTop.map(s => ({ symbol: s.symbol, name: s.name, change_pct: Number(s.change_pct), volume: s.volume })) },
      });
    }

    // 4. 테마 시황 (stock_theme_history 조회)
    const { data: themes } = await supabase
      .from('stock_theme_history')
      .select('theme_name, avg_change_rate')
      .eq('recorded_date', kstDate)
      .order('avg_change_rate', { ascending: false })
      .limit(5);

    if (themes?.length) {
      slides.push({
        slide_order: 4,
        title_ko: `${themes[0].theme_name} 테마 +${Number(themes[0].avg_change_rate).toFixed(1)}%`,
        subtitle_ko: `오늘 강세 테마 TOP ${themes.length}`,
        slide_type: 'theme',
        link_url: '/stock/themes',
        data: { items: themes.map(t => ({ name: t.theme_name, change_pct: Number(t.avg_change_rate) })) },
      });
    }

    // 5. 수급 시그널
    const { data: signals } = await (supabase as any).from('flow_signals')
      .select('signal_type, symbol, strength')
      .eq('signal_date', kstDate)
      .order('strength', { ascending: false })
      .limit(5);

    if (signals?.length) {
      slides.push({
        slide_order: 5,
        title_ko: `수급 시그널 ${signals.length}건 감지`,
        subtitle_ko: '외국인·기관 수급 이상 신호',
        slide_type: 'signals',
        link_url: '/stock/signals',
        data: { items: signals },
      });
    }

    // 6. IPO
    const { data: ipos } = await (supabase as any).from('ipo_events')
      .select('company_name, subscription_start, subscription_end, status')
      .in('status', ['upcoming', 'subscribing'])
      .order('subscription_start', { ascending: true })
      .limit(3);

    if (ipos?.length) {
      slides.push({
        slide_order: 6,
        title_ko: `공모주 — ${ipos[0].company_name} 외 ${ipos.length - 1}건`,
        subtitle_ko: '이번 주 청약 일정',
        slide_type: 'ipo',
        link_url: '/ipo',
        data: { items: ipos },
      });
    }

    // 슬라이드 저장
    let created = 0;
    for (const slide of slides) {
      const { error } = await (supabase as any).from('stock_hero_slides').insert({
        ...slide,
        is_active: true,
        active_from: now.toISOString(),
        active_until: new Date(now.getTime() + 24 * 3600000).toISOString(),
      });
      if (!error) created++;
    }

    return {
      processed: slides.length,
      created,
      failed: slides.length - created,
      metadata: { slide_types: slides.map(s => s.slide_type) },
    };
  });

  return NextResponse.json({ success: true, ...result });
}

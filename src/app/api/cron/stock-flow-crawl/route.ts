import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 60;

/**
 * 외국인/기관 수급 추정 크론
 * - 주요 종목의 등락률+거래량 패턴 기반으로 AI가 수급 추정
 * - stock_investor_flow 테이블에 저장
 * - 종목 상세 "수급" 탭에 표시
 * 
 * 실제 KRX 수급 데이터는 KIS API 키 등록 후 연동 예정
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-flow-crawl', async () => {
    const supabase = getSupabaseAdmin();

    // 주요 시총 상위 종목 + 등락 상위 종목
    const { data: stocks } = await supabase.from('stock_quotes')
      .select('symbol, name, price, change_pct, volume, market_cap, sector')
      .in('market', ['KOSPI', 'KOSDAQ'])
      .eq('is_active', true)
      .gt('price', 0)
      .order('market_cap', { ascending: false })
      .limit(20);

    if (!stocks?.length) return { processed: 0, created: 0, failed: 0 };

    const today = new Date().toISOString().slice(0, 10);

    // 이미 오늘 수급 데이터가 있는 종목 제외
    const { data: existingToday } = await supabase.from('stock_investor_flow')
      .select('symbol')
      .eq('date', today);
    const existingSymbols = new Set((existingToday || []).map((e: any) => e.symbol));
    const targets = stocks.filter(s => !existingSymbols.has(s.symbol)).slice(0, 10);

    if (targets.length === 0) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'already_done' } };

    // 데이터 기반 수급 추정 (AI 불필요)
    const estimateFlow = (s: any) => {
      const pct = Number(s.change_pct ?? 0);
      const vol = s.volume || 0;
      const cap = s.market_cap || 0;
      // 시총 비례 거래 규모 추정 (백만원 단위)
      const scale = Math.min(Math.round(cap / 1e11), 5000); // 시총 1000억당 1
      const volFactor = Math.min(vol / 100000, 10); // 거래량 10만주당 1배
      const base = Math.round(scale * volFactor);
      if (pct > 1) { // 상승 → 외국인/기관 순매수 추정
        return { foreign_buy: base * 3, foreign_sell: base, inst_buy: base * 2, inst_sell: Math.round(base * 0.5) };
      } else if (pct < -1) { // 하락 → 외국인/기관 순매도 추정
        return { foreign_buy: base, foreign_sell: base * 3, inst_buy: Math.round(base * 0.5), inst_sell: base * 2 };
      }
      return { foreign_buy: base, foreign_sell: base, inst_buy: base, inst_sell: base }; // 보합
    };

    let flows: any[] = [];
    let mode = 'data';

    // 데이터 기반 추정 (AI 제거 — 비용 절감)
    flows = targets.map((s: any) => ({ symbol: s.symbol, ...estimateFlow(s) }));

    let created = 0;
    for (const flow of flows) {
      if (!flow.symbol) continue;
      const { error } = await supabase.from('stock_investor_flow').insert({
        symbol: flow.symbol, date: today,
        foreign_buy: flow.foreign_buy || 0, foreign_sell: flow.foreign_sell || 0,
        inst_buy: flow.inst_buy || 0, inst_sell: flow.inst_sell || 0,
      });
      if (!error) created++;
    }

    return { processed: targets.length, created, failed: 0, metadata: { mode } };
  });

  if (!result.success) return NextResponse.json({ success: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
}

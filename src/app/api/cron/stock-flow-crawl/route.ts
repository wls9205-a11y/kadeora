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

    // AI 시도
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const prompt = `오늘(${today}) 한국 증시 주요 종목:\n${targets.map((s: any) => `${s.name}(${s.symbol}): ${Number(s.change_pct ?? 0) > 0 ? '+' : ''}${Number(s.change_pct ?? 0).toFixed(2)}%, 거래량 ${(s.volume || 0).toLocaleString()}, 시총 ${s.market_cap ? (s.market_cap / 1e8).toFixed(0) + '억' : '-'}`).join('\n')}\n\n외국인/기관 순매수 추정(백만원). JSON만: [{"symbol":"코드","foreign_buy":N,"foreign_sell":N,"inst_buy":N,"inst_sell":N}]`;
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(30000),
        });
        if (res.ok) {
          const text = ((await res.json())?.content?.[0]?.text || '').match(/\[[\s\S]*\]/);
          if (text) { flows = JSON.parse(text[0]); mode = 'ai'; }
        }
      } catch { /* AI 실패 → 폴백 */ }
    }

    // AI 없거나 실패 → 데이터 기반 추정
    if (!flows.length) {
      flows = targets.map((s: any) => ({ symbol: s.symbol, ...estimateFlow(s) }));
    }

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

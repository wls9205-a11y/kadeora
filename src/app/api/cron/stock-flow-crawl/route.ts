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

    if (!process.env.ANTHROPIC_API_KEY) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_api_key' } };
    }

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

    const prompt = `오늘(${today}) 한국 증시 주요 종목 데이터:
${targets.map(s => `${s.name}(${s.symbol}): ${Number(s.change_pct ?? 0) > 0 ? '+' : ''}${s.change_pct?.toFixed(2)}%, 거래량 ${(s.volume || 0).toLocaleString()}, 시총 ${s.market_cap ? (s.market_cap / 1e8).toFixed(0) + '억' : '-'}`).join('\n')}

각 종목에 대해 오늘의 외국인/기관 순매수(양수)/순매도(음수) 금액을 추정하세요.
- 상승 + 대량거래 = 외국인/기관 매수 가능성 높음
- 하락 + 대량거래 = 외국인/기관 매도 가능성 높음
- 시총이 클수록 기관 거래 비중 높음

JSON 배열만 응답:
[{"symbol":"종목코드","foreign_buy":숫자,"foreign_sell":숫자,"inst_buy":숫자,"inst_sell":숫자}]
금액 단위: 백만원. 합리적인 범위로 추정. JSON만 출력.`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        if (res.status === 529 || res.status === 402) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'anthropic_credit_exhausted' } };
        const errText = await res.text().catch(() => '');
        if (errText.includes('credit balance')) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'anthropic_credit_exhausted' } };
        return { processed: 0, created: 0, failed: 1, metadata: { reason: 'api_error', status: res.status, detail: errText.slice(0, 200) } };
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return { processed: 0, created: 0, failed: 1 };

      const flows = JSON.parse(match[0]);
      let created = 0;

      for (const flow of flows) {
        if (!flow.symbol) continue;

        const { error } = await supabase.from('stock_investor_flow').insert({
          symbol: flow.symbol,
          date: today,
          foreign_buy: flow.foreign_buy || 0,
          foreign_sell: flow.foreign_sell || 0,
          inst_buy: flow.inst_buy || 0,
          inst_sell: flow.inst_sell || 0,
        });
        if (!error) created++;
      }

      return { processed: targets.length, created, failed: 0, metadata: { api_name: 'anthropic', api_calls: 1 } };
    } catch (e) {
      return { processed: 0, created: 0, failed: 1, metadata: { reason: 'exception', error: String(e).slice(0, 200) } };
    }
  });

  if (!result.success) return NextResponse.json({ success: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
}

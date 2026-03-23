import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 60;

/**
 * 주식 뉴스/분석 자동 생성 크론
 * - 당일 주요 등락 종목 기반 AI 시장 분석 노트 생성
 * - stock_news 테이블에 저장 → 종목 상세 뉴스 탭에 표시
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-news-crawl', async () => {
    const supabase = getSupabaseAdmin();

    if (!process.env.ANTHROPIC_API_KEY) {
      return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_api_key' } };
    }

    // 1. 당일 주요 등락 종목 조회
    const { data: stocks } = await supabase.from('stock_quotes')
      .select('symbol, name, price, change_pct, change_amt, volume, sector, market')
      .in('market', ['KOSPI', 'KOSDAQ'])
      .eq('is_active', true)
      .gt('price', 0)
      .order('change_pct', { ascending: false });

    if (!stocks?.length) return { processed: 0, created: 0, failed: 0 };

    const topGainers = stocks.slice(0, 5);
    const topLosers = [...stocks].sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0)).slice(0, 5);
    const topVolume = [...stocks].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 5);

    // 2. AI로 종목별 시장 분석 노트 생성
    const targetSymbols = [...new Set([
      ...topGainers.map(s => s.symbol),
      ...topLosers.map(s => s.symbol),
      ...topVolume.slice(0, 3).map(s => s.symbol),
    ])].slice(0, 10);

    const targetStocks = stocks.filter(s => targetSymbols.includes(s.symbol));

    const prompt = `오늘 한국 증시 주요 종목 데이터:
${targetStocks.map(s => `- ${s.name}(${s.symbol}): ${s.price?.toLocaleString()}원, ${Number(s.change_pct ?? 0) > 0 ? '+' : ''}${s.change_pct?.toFixed(2)}%, 거래량 ${(s.volume || 0).toLocaleString()}, 섹터: ${s.sector || '기타'}`).join('\n')}

각 종목에 대해 1-2문장의 시장 분석 노트를 작성하세요. 가격 변동 이유 추정, 섹터 흐름, 투자자 참고 사항 등.

JSON 배열만 응답:
[{"symbol":"종목코드","title":"제목(20자이내)","ai_summary":"분석(80자이내)","sentiment":"positive|negative|neutral","source":"AI 시장분석"}]`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) return { processed: 0, created: 0, failed: 1, metadata: { reason: 'api_error' } };

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return { processed: 0, created: 0, failed: 1, metadata: { reason: 'parse_error' } };

      const notes = JSON.parse(match[0]);
      const today = new Date().toISOString().slice(0, 10);
      let created = 0;

      for (const note of notes) {
        if (!note.symbol || !note.title) continue;

        // 오늘 이미 같은 종목 노트가 있으면 스킵
        const { data: existing } = await supabase.from('stock_news')
          .select('id')
          .eq('symbol', note.symbol)
          .gte('published_at', `${today}T00:00:00Z`)
          .limit(1);

        if (existing?.length) continue;

        const { error } = await supabase.from('stock_news').insert({
          symbol: note.symbol,
          title: note.title,
          ai_summary: note.ai_summary || '',
          sentiment: note.sentiment || 'neutral',
          source: note.source || 'AI 시장분석',
          url: `${SITE_URL}/stock/${note.symbol}`,
          published_at: new Date().toISOString(),
        });

        if (!error) created++;
      }

      return { processed: targetStocks.length, created, failed: 0, metadata: { api_name: 'anthropic', api_calls: 1 } };
    } catch {
      return { processed: 0, created: 0, failed: 1, metadata: { reason: 'exception' } };
    }
  });

  if (!result.success) return NextResponse.json({ success: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
}

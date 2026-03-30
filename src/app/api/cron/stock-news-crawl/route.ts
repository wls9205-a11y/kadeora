import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { SITE_URL } from '@/lib/constants';

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

    const targetSymbols = [...new Set([
      ...topGainers.map((s: any) => s.symbol),
      ...topLosers.map((s: any) => s.symbol),
      ...topVolume.slice(0, 3).map((s: any) => s.symbol),
    ])].slice(0, 10);
    const targetStocks = stocks.filter((s: any) => targetSymbols.includes(s.symbol));

    // 데이터 기반 자동 노트 생성 (AI 불필요)
    const generateDataNote = (s: any): { symbol: string; title: string; ai_summary: string; sentiment: string; source: string } => {
      const pct = Number(s.change_pct ?? 0);
      const sentiment = pct > 2 ? 'positive' : pct < -2 ? 'negative' : 'neutral';
      const direction = pct > 0 ? '상승' : pct < 0 ? '하락' : '보합';
      const title = `${s.name} ${Math.abs(pct).toFixed(1)}% ${direction}`;
      const volLabel = (s.volume || 0) > 1000000 ? `거래량 ${Math.round(s.volume / 10000).toLocaleString()}만주` : `거래량 ${(s.volume || 0).toLocaleString()}주`;
      const ai_summary = `${s.name}(${s.symbol})이 ${Math.abs(pct).toFixed(1)}% ${direction}. ${s.sector || '기타'} 섹터. ${volLabel}. 현재가 ${Number(s.price).toLocaleString()}원.`;
      return { symbol: s.symbol, title, ai_summary, sentiment, source: '시장 데이터' };
    };

    let notes: any[] = [];
    let mode = 'data';

    // AI 시도
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const prompt = `오늘 한국 증시 주요 종목 데이터:\n${targetStocks.map((s: any) => `- ${s.name}(${s.symbol}): ${Number(s.price || 0).toLocaleString()}원, ${Number(s.change_pct ?? 0) > 0 ? '+' : ''}${Number(s.change_pct ?? 0).toFixed(2)}%, 거래량 ${(s.volume || 0).toLocaleString()}, 섹터: ${s.sector || '기타'}`).join('\n')}\n\n각 종목 1-2문장 시장 분석. JSON만: [{"symbol":"코드","title":"제목(20자)","ai_summary":"분석(80자)","sentiment":"positive|negative|neutral","source":"AI 시장분석"}]`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          const text = ((await res.json())?.content?.[0]?.text || '').match(/\[[\s\S]*\]/);
          if (text) { notes = JSON.parse(text[0]); mode = 'ai'; }
        }
      } catch { /* AI 실패 → 폴백 */ }
    }

    // AI 없거나 실패 → 데이터 기반 자동 생성
    if (!notes.length) {
      notes = targetStocks.map(generateDataNote);
    }

    const today = new Date().toISOString().slice(0, 10);
    let created = 0;

    for (const note of notes) {
      if (!note.symbol || !note.title) continue;
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
        source: note.source || '시장 데이터',
        url: `${SITE_URL}/stock/${note.symbol}`,
        published_at: new Date().toISOString(),
      });
      if (!error) created++;
    }

    return { processed: targetStocks.length, created, failed: 0, metadata: { mode } };
  });

  if (!result.success) return NextResponse.json({ success: true, error: result.error });
  return NextResponse.json({ ok: true, ...result });
}

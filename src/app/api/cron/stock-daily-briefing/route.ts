import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('stock-daily-briefing', async () => {
    const supabase = getSupabaseAdmin();

    // Get today's top movers
    const { data: stocks } = await supabase.from('stock_quotes')
      .select('symbol, name, price, change_pct, change_amt, volume, sector, market')
      .in('market', ['KOSPI', 'KOSDAQ'])
      .order('change_pct', { ascending: false });

    const allStocks = stocks || [];
    const topGainers = allStocks.slice(0, 5);
    const topLosers = [...allStocks].sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0)).slice(0, 5);

    // Get theme data
    const { data: themeHistory } = await supabase.from('stock_theme_history')
      .select('theme_name, avg_change_rate')
      .eq('history_date', new Date().toISOString().slice(0, 10));

    // Calculate sector performance
    const sectorMap: Record<string, { total: number; count: number }> = {};
    for (const s of allStocks) {
      const sec = s.sector || '기타';
      if (!sectorMap[sec]) sectorMap[sec] = { total: 0, count: 0 };
      sectorMap[sec].total += s.change_pct || 0;
      sectorMap[sec].count++;
    }
    const sectorPerf = Object.entries(sectorMap).map(([name, v]) => ({ name, avg_pct: +(v.total / v.count).toFixed(2) })).sort((a, b) => b.avg_pct - a.avg_pct);

    // Generate AI briefing via Anthropic
    let title = '오늘의 시황';
    let summary = '';
    let sentiment = 'neutral';
    const sectorAnalysis: any[] = sectorPerf.slice(0, 6);
    let apiCalls = 0;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const prompt = `오늘 한국 증시 데이터:
상승 TOP5: ${topGainers.map(s => `${s.name}(${Number(s.change_pct ?? 0) > 0 ? '+' : ''}${Number(s.change_pct ?? 0).toFixed(1)}%)`).join(', ')}
하락 TOP5: ${topLosers.map(s => `${s.name}(${Number(s.change_pct ?? 0).toFixed(1)}%)`).join(', ')}
섹터: ${sectorPerf.slice(0, 5).map(s => `${s.name}(${s.avg_pct > 0 ? '+' : ''}${s.avg_pct}%)`).join(', ')}
${themeHistory?.length ? `테마: ${themeHistory.map(t => `${t.theme_name}(${Number(t.avg_change_rate ?? 0) > 0 ? '+' : ''}${Number(t.avg_change_rate ?? 0).toFixed(1)}%)`).join(', ')}` : ''}

200자 이내로 시황을 요약하세요. JSON만 응답: {"title":"제목(20자이내)","summary":"요약","sentiment":"bullish|neutral|bearish"}`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(15000),
        });
        apiCalls = 1;
        if (res.ok) {
          const data = await res.json();
          const match = (data.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.title) title = parsed.title;
            if (parsed.summary) summary = parsed.summary;
            if (parsed.sentiment) sentiment = parsed.sentiment;
          }
        }
      } catch {}
    }

    if (!summary) {
      const upPct = allStocks.filter(s => Number(s.change_pct ?? 0) > 0).length / (allStocks.length || 1) * 100;
      sentiment = upPct > 55 ? 'bullish' : upPct < 45 ? 'bearish' : 'neutral';
      title = sentiment === 'bullish' ? '강세장 지속' : sentiment === 'bearish' ? '약세장 흐름' : '혼조세 마감';
      summary = `상승 ${allStocks.filter(s => Number(s.change_pct ?? 0) > 0).length}종목, 하락 ${allStocks.filter(s => Number(s.change_pct ?? 0) < 0).length}종목.`;
    }

    const today = new Date().toISOString().slice(0, 10);
    const movers = { gainers: topGainers.map(s => ({ symbol: s.symbol, name: s.name, change_pct: s.change_pct })), losers: topLosers.map(s => ({ symbol: s.symbol, name: s.name, change_pct: s.change_pct })) };

    await supabase.from('stock_daily_briefing').upsert({
      briefing_date: today,
      market: 'KR',
      title,
      summary,
      sentiment,
      key_movers: movers,
      sector_analysis: sectorAnalysis,
    }, { onConflict: 'briefing_date,market' });

    return { processed: allStocks.length, created: 1, failed: 0, metadata: { api_name: 'anthropic', api_calls: apiCalls } };
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}

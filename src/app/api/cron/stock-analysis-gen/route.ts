import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('stock-analysis-gen', async () => {
    const admin = getSupabaseAdmin();

    const { data: stocks } = await (admin as any).from('stock_quotes')
      .select('symbol, name, market, price, change_pct, volume, market_cap, sector, currency, description, per, pbr, dividend_yield, high_52w, low_52w, eps, roe')
      .is('analysis_text', null)
      .eq('is_active', true)
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(5);

    if (!stocks || stocks.length === 0) return { processed: 0, metadata: { reason: 'all_done' } };

    let processed = 0;

    for (const s of stocks) {
      try {
        const { data: news } = await admin.from('stock_news')
          .select('title, sentiment_label')
          .eq('symbol', s.symbol)
          .order('published_at', { ascending: false })
          .limit(3);

        const isUS = s.currency === 'USD';
        const p = isUS ? `$${Number(s.price).toFixed(2)}` : `${Number(s.price).toLocaleString()}원`;
        const ch = `${Number(s.change_pct) >= 0 ? '+' : ''}${Number(s.change_pct).toFixed(2)}%`;
        const cap = s.market_cap ? `${(Number(s.market_cap)/100000000).toFixed(0)}억` : '';
        const nStr = (news || []).map((n: any) => `- ${n.title} (${n.sentiment_label||'중립'})`).join('\n');

        const prompt = `한국 주식 전문 분석가로서 "${s.name} (${s.symbol})" 종합 분석 1,500자+ 작성.

데이터: 시장=${s.market}, 현재가=${p} ${ch}, 거래량=${Number(s.volume).toLocaleString()}, 시총=${cap}, 섹터=${s.sector||'미분류'}, PER=${s.per||'-'}, PBR=${s.pbr||'-'}, 배당률=${s.dividend_yield?Number(s.dividend_yield).toFixed(2)+'%':'-'}, 52주고저=${s.high_52w||'-'}/${s.low_52w||'-'}, ROE=${s.roe?Number(s.roe).toFixed(1)+'%':'-'}
설명: ${s.description||'없음'}
뉴스:\n${nStr||'없음'}

필수 4섹션(## 소제목): 기업개요, 투자포인트([시세보기→](/stock) [비교→](/stock/compare) 링크), 밸류에이션, FAQ(### Q. 5개).
규칙: 마크다운, 목차금지, ##안에 볼드금지, 면책문구 마지막.`;

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
        });

        if (!res.ok) continue;
        const data = await res.json();
        const text = data.content?.[0]?.text;
        if (!text || text.length < 400) continue;

        await (admin as any).from('stock_quotes')
          .update({ analysis_text: text, analysis_generated_at: new Date().toISOString() })
          .eq('symbol', s.symbol);
        processed++;
      } catch { /* skip */ }
    }

    return { processed, metadata: { total: stocks.length } };
  });

  return NextResponse.json(result);
}

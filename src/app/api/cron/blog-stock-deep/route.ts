import { diversifyPrompt } from '@/lib/blog-prompt-diversity';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-stock-deep', async () => {
    const supabase = getSupabaseAdmin();
    if (!process.env.ANTHROPIC_API_KEY) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_api_key' } };

    const [topCapR, topMoverR] = await Promise.all([
      supabase.from('stock_quotes')
        .select('symbol, name, price, change_pct, market_cap, sector, market, volume')
        .in('market', ['KOSPI', 'KOSDAQ']).gt('price', 0).eq('is_active', true)
        .order('market_cap', { ascending: false }).limit(30),
      supabase.from('stock_quotes')
        .select('symbol, name, price, change_pct, market_cap, sector, market, volume')
        .in('market', ['KOSPI', 'KOSDAQ']).gt('price', 0).eq('is_active', true)
        .order('change_pct', { ascending: false }).limit(10),
    ]);

    const allStocks = [...(topCapR.data || []), ...(topMoverR.data || [])];
    const uniqueStocks = [...new Map(allStocks.map(s => [s.symbol, s])).values()];

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: existingBlogs } = await supabase.from('blog_posts')
      .select('title').eq('is_published', true).eq('category', 'stock')
      .gte('published_at', weekAgo);
    const existingNames = new Set((existingBlogs || []).map(b => b.title));

    const candidates = uniqueStocks.filter(s =>
      !Array.from(existingNames).some(t => t?.includes(s.name))
    );
    const targets = candidates.sort(() => Math.random() - 0.5).slice(0, 2);
    let created = 0;

    for (const stock of targets) {
      const cap = stock.market_cap ?? 0;
      const fmtCap = cap > 1e12 ? `${(cap / 1e12).toFixed(1)}조원` : `${(cap / 1e8).toFixed(0)}억원`;
      const fmtPrice = (stock.price ?? 0).toLocaleString();
      const pct = (stock.change_pct ?? 0).toFixed(2);

      const prompt = diversifyPrompt(`한국 주식 투자 정보 플랫폼 '카더라'의 종목 심층 분석 블로그를 작성하세요.
종목: ${stock.name} (${stock.symbol}), 현재가 ${fmtPrice}원 (${Number(pct) > 0 ? '+' : ''}${pct}%), 시총 ${fmtCap}, 섹터 ${stock.sector || '기타'}, ${stock.market}, 거래량 ${(stock.volume || 0).toLocaleString()}주

규칙: 위 실제 데이터 본문에 포함, 1800자 이상, h2 4개(기업개요/최근동향/투자포인트/리스크), "본 글은 투자 추천이 아닙니다" 문구 포함, 마크다운.
JSON만: {"title":"제목(40자이내)","content":"마크다운본문","excerpt":"요약(100자이내)","tags":["태그1","태그2"]}`);

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3500, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) continue;
        const parsed = JSON.parse(match[0]);
        if (!parsed.title || !parsed.content) continue;

        const content = ensureMinLength(parsed.content, 'stock', 1800);
        const slug = `${stock.name.replace(/\s/g, '-').toLowerCase()}-analysis-${Date.now().toString(36)}`;

        const inserted = await safeBlogInsert(supabase, {
          title: parsed.title, slug, content,
          excerpt: parsed.excerpt || parsed.title,
          category: 'stock',
          tags: parsed.tags || [stock.name, '종목분석'],
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords('stock', parsed.tags),
          source_type: 'ai',
          source_ref: `stock-deep-${stock.symbol}`,
        });
        if (inserted.success) created++;
      } catch { /* continue */ }
    }
    return { processed: targets.length, created, failed: 0 };
  });

  return NextResponse.json({ ok: true, ...result });
}

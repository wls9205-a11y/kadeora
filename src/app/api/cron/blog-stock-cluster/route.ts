import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { safeBlogInsert } from '@/lib/blog-safe-insert';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TEMPLATES = [
  { sfx: '투자 전략 완전분석', slug: 'strategy', kw: '투자 전략 매수 매도' },
  { sfx: '배당금 분석 — 수익률 계산', slug: 'dividend', kw: '배당금 수익률 배당일' },
  { sfx: '실적 전망 — 목표가 분석', slug: 'target', kw: '실적 전망 목표가 EPS' },
];

function toSlug(name: string, symbol: string, sfx: string): string {
  return `${symbol.toLowerCase()}-${sfx}-2026`.slice(0, 80);
}

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-stock-cluster', async () => {
    const admin = getSupabaseAdmin();

    const { data: stocks } = await (admin as any).from('stock_quotes')
      .select('symbol, name, market, price, change_pct, market_cap, sector, per, pbr, dividend_yield, roe')
      .eq('is_active', true)
      .not('analysis_text', 'is', null)
      .order('volume', { ascending: false, nullsFirst: false })
      .limit(2);

    if (!stocks || stocks.length === 0) return { processed: 0 };

    let created = 0;
    for (const s of stocks) {
      for (const t of TEMPLATES) {
        try {
          const title = `${s.name}(${s.symbol}) ${t.sfx} 2026`;
          const slug = toSlug(s.name, s.symbol, t.slug);
          const { data: dup } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
          if (dup) continue;

          const isUS = s.market === 'NYSE' || s.market === 'NASDAQ';
          const p = isUS ? `$${Number(s.price).toFixed(2)}` : `${Number(s.price).toLocaleString()}원`;

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4000,
              messages: [{ role: 'user', content: `"${title}" 블로그 2500자+.\n${s.name}(${s.symbol}), ${s.market}, ${p}, 시총=${s.market_cap?(Number(s.market_cap)/1e8).toFixed(0)+'억':'-'}, ${s.sector||'-'}, PER=${s.per||'-'}, PBR=${s.pbr||'-'}, 배당=${s.dividend_yield||'-'}%, ROE=${s.roe||'-'}%\n## 4~6개, 링크: [시세→](/stock/${s.symbol}) [비교→](/stock/compare) [블로그→](/blog). FAQ ### Q. 3개. 마크다운,목차금지,##볼드금지,면책.` }],
            }),
          });
          if (!res.ok) continue;
          const content = (await res.json()).content?.[0]?.text;
          if (!content || content.length < 1500) continue;

          const r = await safeBlogInsert(admin as any, {
            slug, title, content, category: 'stock',
            tags: [s.name, s.symbol, s.sector, t.kw].filter(Boolean),
            source_type: 'stock-cluster', source_ref: s.symbol,
          });
          if (r.success) created++;
        } catch { /* skip */ }
      }
    }
    return { processed: stocks.length, created };
  });
  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';

export const maxDuration = 60;

const ADR_THEMES = [
  { title: '인도 주식 직접 투자 방법 — INFY vs WIT vs HDB ADR 2026', symbols: ['INFY','WIT','HDB'], region: '인도' },
  { title: '중국 플랫폼 ADR 투자 — BABA vs PDD vs JD 비교 2026', symbols: ['BABA','PDD','JD'], region: '중국' },
  { title: '동남아 플랫폼 주식 — SE vs GRAB vs GOTO 비교 2026', symbols: ['SE','GRAB','GOTO'], region: '동남아' },
  { title: '중국 전기차 ADR 투자 — NIO vs XPEV vs LI 비교 2026', symbols: ['NIO','XPEV','LI'], region: '중국EV' },
  { title: '인도 IT기업 ADR — INFY vs WIT 10년 성과 비교 2026', symbols: ['INFY','WIT','IBN'], region: '인도IT' },
  { title: '우주항공 소형주 투자 — RKLB vs SPCE vs ASTR 비교 2026', symbols: ['RKLB','SPCE','ASTR'], region: '우주항공' },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-adr-compare', async () => {
    const supabase = getSupabaseAdmin();
    if (!process.env.ANTHROPIC_API_KEY) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_api_key' } };

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: existing } = await supabase.from('blog_posts')
      .select('title').eq('is_published', true).gte('published_at', weekAgo);
    const existingTitles = new Set((existing || []).map((b: any) => b.title));

    const candidates = ADR_THEMES.filter(t => !existingTitles.has(t.title));
    if (!candidates.length) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'all_exist' } };

    const target = candidates[Math.floor(Math.random() * Math.min(candidates.length, 2))];

    const { data: stocks } = await supabase.from('stock_quotes')
      .select('symbol, name, price, change_pct, market_cap, sector, market, currency')
      .in('symbol', target.symbols);
    const stockStr = (stocks || []).map((s: any) =>
      `${s.name}(${s.symbol}): $${Number(s.price).toFixed(2)} ${Number(s.change_pct??0)>0?'+':''}${Number(s.change_pct??0).toFixed(2)}% 시총 $${((s.market_cap||0)/1e9).toFixed(0)}B`
    ).join(', ');

    const prompt = `한국 투자자를 위한 해외 ADR/성장주 비교 분석 블로그를 한국어로 작성하세요.
주제: ${target.region} 지역 주요 종목 비교
종목 데이터: ${stockStr}

규칙: 1800자 이상, h2 4개(지역투자개요/종목별분석/비교표/투자전략), 한국 투자자 관점, 환율 위험 언급, "본 글은 투자 추천이 아닙니다" 포함, 마크다운.
JSON만: {"title":"${target.title}","content":"마크다운본문","excerpt":"요약(100자이내)","tags":["태그1","태그2","태그3"]}`;

    let created = 0;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 5000, messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) { if (res.status === 529 || res.status === 402) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'anthropic_credit_exhausted' } }; return { processed: 0, created: 0, failed: 1, metadata: { reason: 'anthropic_error', status: res.status } }; }
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.title && parsed.content) {
            const body = ensureMinLength(parsed.content, 'stock', 1800);
            const ins = await safeBlogInsert(supabase, {
              title: parsed.title,
              slug: `adr-compare-${target.region.toLowerCase()}-${Date.now().toString(36)}`,
              content: body,
              excerpt: parsed.excerpt || parsed.title,
              category: 'stock',
              tags: parsed.tags || ['ADR', '해외주식', target.region],
              meta_description: generateMetaDesc(body),
              meta_keywords: generateMetaKeywords('stock', parsed.tags),
              source_type: 'ai',
              source_ref: 'blog-adr-compare',
            });
            if (ins.success) created++;
          }
        }
      }
    } catch {}

    return { processed: target.symbols.length, created, failed: 0 };
  });

  return NextResponse.json({ ok: true, ...result });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';

export const maxDuration = 300;

// ETF 비교 테마 목록
const ETF_THEMES = [
  { title: 'S&P 500 ETF 완전 비교 — SPY vs VOO vs IVV 2026', symbols: ['SPY','QQQ','IVV'], desc: 'S&P500 추종 ETF 3대장 비교' },
  { title: '반도체 ETF 투자 가이드 — SOXX vs SMH vs SOXS 2026', symbols: ['AMAT','LRCX','MU'], desc: '반도체 ETF 섹터 분석' },
  { title: '국내 ETF 완전 정리 — KODEX vs TIGER vs KINDEX 비교 2026', symbols: ['069500','379800','229200'], desc: '국내 대표 ETF 비교' },
  { title: '미국 배당 ETF 추천 — SCHD vs VYM vs DVY 비교 2026', symbols: ['KO','PEP','MCD'], desc: '배당 ETF 비교 분석' },
  { title: '글로벌 리츠 ETF 투자법 — AMT vs PLD vs EQIX 2026', symbols: ['AMT','PLD','EQIX'], desc: '데이터센터·물류 리츠 ETF' },
  { title: '방산 ETF 뜨는 이유 — LMT vs RTX vs NOC 비교 2026', symbols: ['LMT','RTX','NOC'], desc: '미국 방산 빅3 ETF 분석' },
  { title: '재생에너지 ETF 투자 가이드 — ENPH vs FSLR vs NEE 2026', symbols: ['ENPH','FSLR','NEE'], desc: '클린에너지 ETF 비교' },
  { title: '인공지능 ETF 총정리 — PLTR vs CRWD vs AI 비교 2026', symbols: ['PLTR','CRWD','AI'], desc: 'AI 테마 ETF 분석' },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-etf-compare', async () => {
    const supabase = getSupabaseAdmin();
    if (!process.env.ANTHROPIC_API_KEY) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_api_key' } };

    // 이미 생성된 ETF 비교 글 제목 확인
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: existing } = await supabase.from('blog_posts')
      .select('title').eq('is_published', true).eq('category', 'stock')
      .gte('published_at', weekAgo);
    const existingTitles = new Set((existing || []).map(b => b.title));

    const candidates = ETF_THEMES.filter(t => !existingTitles.has(t.title));
    if (!candidates.length) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'all_exist' } };

    // 종목 데이터 조회
    const allSymbols = [...new Set(candidates.flatMap(c => c.symbols))];
    const { data: stocks } = await supabase.from('stock_quotes')
      .select('symbol, name, price, change_pct, market_cap, sector, market, currency')
      .in('symbol', allSymbols);
    const stockMap = new Map((stocks || []).map(s => [s.symbol, s]));

    const target = candidates[Math.floor(Math.random() * Math.min(candidates.length, 2))];
    let created = 0;

    const stockData = target.symbols.map(sym => stockMap.get(sym)).filter(Boolean);
    const stockStr = stockData.map(s => {
      const isUS = s!.currency === 'USD';
      return `${s!.name}(${s!.symbol}): ${isUS ? '$' : '₩'}${Number(s!.price).toFixed(isUS ? 2 : 0)} ${Number(s!.change_pct ?? 0) > 0 ? '+' : ''}${Number(s!.change_pct ?? 0).toFixed(2)}%`;
    }).join(', ');

    const prompt = `한국 투자자를 위한 ETF/종목 비교 분석 블로그를 한국어로 작성하세요.
주제: ${target.desc}
관련 종목 데이터: ${stockStr}

규칙: 1800자 이상, h2 4개(개요비교/성과분석/투자전략/결론), 실제 데이터 인용, "본 글은 투자 추천이 아닙니다" 포함, 마크다운.
JSON만: {"title":"${target.title}","content":"마크다운본문","excerpt":"요약(100자이내)","tags":["태그1","태그2","태그3"]}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
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
            const slug = `etf-compare-${Date.now().toString(36)}`;
            const ins = await safeBlogInsert(supabase, {
              title: parsed.title, slug, content: body,
              excerpt: parsed.excerpt || parsed.title,
              category: 'stock',
              tags: parsed.tags || ['ETF', '투자', '비교분석'],
              meta_description: generateMetaDesc(body),
              meta_keywords: generateMetaKeywords('stock', parsed.tags),
              source_type: 'ai',
              source_ref: `blog-etf-compare`,
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

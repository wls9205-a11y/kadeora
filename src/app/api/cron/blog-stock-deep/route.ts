import { AI_MODEL_HAIKU, ANTHROPIC_VERSION } from '@/lib/constants';
import { diversifyPrompt } from '@/lib/blog-prompt-diversity';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-stock-deep', async () => {
    const supabase = getSupabaseAdmin();
    if (!process.env.ANTHROPIC_API_KEY) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_api_key' } };

    const [topCapKR, topMoverKR, topCapUS, topMoverUS] = await Promise.all([
      supabase.from('stock_quotes')
        .select('symbol, name, price, change_pct, market_cap, sector, market, volume, currency')
        .in('market', ['KOSPI', 'KOSDAQ']).gt('price', 0).eq('is_active', true)
        .order('market_cap', { ascending: false }).limit(40),
      supabase.from('stock_quotes')
        .select('symbol, name, price, change_pct, market_cap, sector, market, volume, currency')
        .in('market', ['KOSPI', 'KOSDAQ']).gt('price', 0).eq('is_active', true)
        .order('change_pct', { ascending: false }).limit(10),
      supabase.from('stock_quotes')
        .select('symbol, name, price, change_pct, market_cap, sector, market, volume, currency')
        .in('market', ['NYSE', 'NASDAQ']).gt('price', 0).eq('is_active', true)
        .order('market_cap', { ascending: false }).limit(30),
      supabase.from('stock_quotes')
        .select('symbol, name, price, change_pct, market_cap, sector, market, volume, currency')
        .in('market', ['NYSE', 'NASDAQ']).gt('price', 0).eq('is_active', true)
        .order('change_pct', { ascending: false }).limit(10),
    ]);

    const allStocks = [
      ...(topCapKR.data || []), ...(topMoverKR.data || []),
      ...(topCapUS.data || []), ...(topMoverUS.data || []),
    ];
    const uniqueStocks = [...new Map(allStocks.map(s => [s.symbol, s])).values()];

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: existingBlogs } = await supabase.from('blog_posts')
      .select('title').eq('is_published', true).eq('category', 'stock')
      .gte('published_at', weekAgo);
    const existingNames = new Set((existingBlogs || []).map(b => b.title));

    const candidates = uniqueStocks.filter(s =>
      !Array.from(existingNames).some(t => t?.includes(s.name))
    );
    const targets = candidates.sort(() => Math.random() - 0.5).slice(0, 4);
    let created = 0;

    for (const stock of targets) {
      const cap = stock.market_cap ?? 0;
      const isUS = stock.market === 'NYSE' || stock.market === 'NASDAQ';
      const fmtCap = isUS
        ? (cap > 1e12 ? `$${(cap / 1e12).toFixed(1)}T` : `$${(cap / 1e9).toFixed(0)}B`)
        : (cap > 1e12 ? `${(cap / 1e12).toFixed(1)}조원` : `${(cap / 1e8).toFixed(0)}억원`);
      const fmtPrice = isUS ? `$${(stock.price ?? 0).toFixed(2)}` : `₩${(stock.price ?? 0).toLocaleString()}`;
      const pct = (stock.change_pct ?? 0).toFixed(2);
      const marketLabel = isUS ? `${stock.market} (미국)` : stock.market;

      const prompt = diversifyPrompt(isUS
        ? `한국 주식 투자 정보 플랫폼 '카더라'의 미국 종목 심층 분석 블로그를 한국어로 작성하세요.
종목: ${stock.name} (${stock.symbol}), 현재가 ${fmtPrice} (${Number(pct) > 0 ? '+' : ''}${pct}%), 시총 ${fmtCap}, 섹터 ${stock.sector || '기타'}, ${marketLabel}

필수 요구사항:
- 2500자 이상 상세 분석
- h2 5~6개: 기업 개요/사업 모델 분석/최근 실적·이슈/투자 포인트/리스크 요인/향후 전망
- 한국 투자자 관점: 원화 환산 시총, ADR 여부, 환율 리스크 언급
- 구체적 수치와 데이터 활용 (매출, 영업이익률, 경쟁사 비교)
- "본 글은 투자 추천이 아닙니다" 문구 포함

FAQ 섹션(h2):
- "## 자주 묻는 질문" 섹션을 본문 마지막에 포함
- Q/A 3개: "Q. 종목명 주가 전망은?" / "Q. 종목명 적정주가는?" / "Q. 종목명 배당금은?"
- 각 답변 2~3문장

JSON만 응답:
{"title":"제목(50자이내,연도포함)","content":"마크다운본문(2500자+)","excerpt":"요약(120자이내)","tags":["태그1","태그2","태그3","태그4"]}`
        : `한국 주식 투자 정보 플랫폼 '카더라'의 종목 심층 분석 블로그를 작성하세요.
종목: ${stock.name} (${stock.symbol}), 현재가 ${fmtPrice} (${Number(pct) > 0 ? '+' : ''}${pct}%), 시총 ${fmtCap}, 섹터 ${stock.sector || '기타'}, ${marketLabel}, 거래량 ${(stock.volume || 0).toLocaleString()}주

필수 요구사항:
- 2500자 이상 상세 분석
- h2 5~6개: 기업 개요/최근 실적·동향/투자 포인트/리스크 요인/동종업계 비교/향후 전망
- 위 실제 시세 데이터를 본문에 자연스럽게 포함
- 구체적 수치와 데이터 활용 (PER, PBR, ROE 추정, 동종업계 비교)
- "본 글은 투자 추천이 아닙니다" 문구 포함

FAQ 섹션(h2):
- "## 자주 묻는 질문" 섹션을 본문 마지막에 포함
- Q/A 3개: "Q. 종목명 주가 전망은?" / "Q. 종목명 적정주가는 얼마인가요?" / "Q. 종목명 배당 정보는?"
- 각 답변 2~3문장

JSON만 응답:
{"title":"제목(50자이내,연도포함)","content":"마크다운본문(2500자+)","excerpt":"요약(120자이내)","tags":["태그1","태그2","태그3","태그4"]}`)

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': ANTHROPIC_VERSION },
          body: JSON.stringify({ model: AI_MODEL_HAIKU, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) {
          // 529 크레딧 부족 → 나머지 반복 낭비 없이 즉시 종료
          if (res.status === 529 || res.status === 402) break;
          continue;
        }
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) continue;
        const parsed = JSON.parse(match[0]);
        if (!parsed.title || !parsed.content) continue;

        const content = parsed.content;
        const stockSlug = isUS ? stock.symbol.toLowerCase() : stock.name.replace(/\s/g, '-').toLowerCase();
        const slug = `${stockSlug}-analysis-${Date.now().toString(36)}`;

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

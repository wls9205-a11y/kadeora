import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-sector-rotation', async () => {
    const supabase = getSupabaseAdmin();
    if (!process.env.ANTHROPIC_API_KEY) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_api_key' } };

    // 섹터별 등락률 집계
    const { data: stocks } = await supabase.from('stock_quotes')
      .select('symbol, name, price, change_pct, sector, market, market_cap')
      .in('market', ['KOSPI', 'KOSDAQ', 'NYSE', 'NASDAQ'])
      .gt('price', 0).not('sector', 'is', null);

    const allStocks = stocks || [];
    type SectorEntry = { total: number; count: number; names: string[]; isKR: boolean };
    const sectorMap: Record<string, SectorEntry> = {};
    for (const s of allStocks) {
      const sec = s.sector!;
      const isKR = s.market === 'KOSPI' || s.market === 'KOSDAQ';
      if (!sectorMap[sec]) sectorMap[sec] = { total: 0, count: 0, names: [], isKR };
      sectorMap[sec].total += s.change_pct ?? 0;
      sectorMap[sec].count++;
      if (sectorMap[sec].names.length < 3) sectorMap[sec].names.push(s.name);
    }

    const ranked = Object.entries(sectorMap)
      .map(([name, v]) => ({ name, avg: +(v.total / v.count).toFixed(2), count: v.count, names: v.names }))
      .filter(s => s.count >= 3)
      .sort((a, b) => b.avg - a.avg);

    const topSectors = ranked.slice(0, 5);
    const bottomSectors = ranked.slice(-3);
    const now = new Date();
    const weekNum = Math.ceil(now.getDate() / 7);
    const slug = `sector-rotation-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-w${weekNum}`;

    const { data: exists } = await supabase.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (exists) return { processed: 0, created: 0, failed: 0 };

    const prompt = `한국 투자 블로그용 섹터 로테이션 분석 글을 한국어로 작성하세요.

현재 섹터 등락률 데이터:
강세 섹터: ${topSectors.map(s => `${s.name}(평균 ${s.avg>0?'+':''}${s.avg}%, 대표종목: ${s.names.join('·')})`).join(', ')}
약세 섹터: ${bottomSectors.map(s => `${s.name}(평균 ${s.avg}%, 대표종목: ${s.names.join('·')})`).join(', ')}

규칙: 1800자 이상, h2 4개(섹터로테이션개념/현재강세섹터분석/약세섹터전망/투자전략), 실제 데이터 포함, "본 글은 투자 추천이 아닙니다" 포함, 마크다운.
JSON만: {"title":"섹터 로테이션 완벽분석 — ${now.getFullYear()}년 ${now.getMonth()+1}월 주목 섹터","content":"마크다운본문","excerpt":"요약(100자이내)","tags":["섹터로테이션","주식투자","${topSectors[0]?.name||'반도체'}"]}`;

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
        const d = await res.json();
        const text = d.content?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.title && parsed.content) {
            const body = ensureMinLength(parsed.content, 'stock', 1800);
            const ins = await safeBlogInsert(supabase, {
              title: parsed.title, slug, content: body,
              excerpt: parsed.excerpt || parsed.title, category: 'stock',
              tags: parsed.tags || ['섹터로테이션', '주식투자'],
              meta_description: generateMetaDesc(body),
              meta_keywords: generateMetaKeywords('stock', parsed.tags),
              source_type: 'ai', source_ref: 'blog-sector-rotation',
            });
            if (ins.success) created++;
          }
        }
      }
    } catch {}

    return { processed: allStocks.length, created, failed: 0 };
  });

  return NextResponse.json({ ok: true, ...result });
}

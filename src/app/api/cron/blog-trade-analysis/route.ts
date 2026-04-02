import { diversifyPrompt } from '@/lib/blog-prompt-diversity';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

const REGIONS = ['서울','경기','부산','인천','대구','광주','대전','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-trade-analysis', async () => {
    const supabase = getSupabaseAdmin();
    if (!process.env.ANTHROPIC_API_KEY) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'no_api_key' } };

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const prevMonthStr = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;

    const targets = [...REGIONS].sort(() => Math.random() - 0.5).slice(0, 2);
    let created = 0;

    for (const region of targets) {
      const [thisMonthR, prevMonthR] = await Promise.all([
        supabase.from('apt_transactions')
          .select('apt_name, deal_amount, exclusive_area, floor, deal_date, sigungu, dong')
          .eq('region_nm', region)
          .gte('deal_date', `${monthStr}-01`)
          .order('deal_amount', { ascending: false })
          .limit(100),
        supabase.from('apt_transactions')
          .select('deal_amount')
          .eq('region_nm', region)
          .gte('deal_date', `${prevMonthStr}-01`)
          .lt('deal_date', `${monthStr}-01`)
          .limit(200),
      ]);

      const trades = thisMonthR.data || [];
      const prevTrades = prevMonthR.data || [];
      if (trades.length < 3) continue;

      const avgPrice = Math.round(trades.reduce((s, t) => s + (t.deal_amount || 0), 0) / trades.length);
      const maxTrade = trades[0];
      const prevAvg = prevTrades.length > 0 ? Math.round(prevTrades.reduce((s, t) => s + (t.deal_amount || 0), 0) / prevTrades.length) : 0;
      const changePct = prevAvg > 0 ? ((avgPrice - prevAvg) / prevAvg * 100).toFixed(1) : '0';
      const topAreas = [...new Set(trades.slice(0, 10).map(t => t.dong || t.sigungu))].filter(Boolean).slice(0, 5);

      const { data: existing } = await supabase.from('blog_posts')
        .select('id').eq('is_published', true)
        .ilike('title', `%${region}%실거래%${month}월%`).limit(1);
      if (existing?.length) continue;

      const prompt = diversifyPrompt(`한국 부동산 투자 정보 플랫폼 '카더라'의 블로그 글을 작성하세요.
주제: ${region} ${month}월 아파트 실거래가 분석
실제 데이터:
- 이번 달 거래 ${trades.length}건, 평균 ${(avgPrice / 10000).toFixed(1)}억원
- 최고가: ${maxTrade?.apt_name} ${((maxTrade?.deal_amount || 0) / 10000).toFixed(1)}억원 (${maxTrade?.exclusive_area}㎡, ${maxTrade?.floor}층)
- 전월 대비: ${changePct}% ${Number(changePct) > 0 ? '상승' : '하락'}
- 활발 거래 지역: ${topAreas.join(', ')}

작성 규칙: 실제 데이터 수치 본문에 반드시 포함, 1500자 이상, h2 3개 이상(## 형식), 투자 주의문구 포함, 마크다운.
JSON만 출력: {"title":"제목(40자이내)","content":"마크다운본문","excerpt":"요약(100자이내)","tags":["태그1","태그2"]}`);

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok) {
          if (res.status === 529 || res.status === 402) break;
          continue;
        }
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) continue;
        const parsed = JSON.parse(match[0]);
        if (!parsed.title || !parsed.content) continue;

        const content = ensureMinLength(parsed.content, 'apt', 1500);
        const slug = `${region.toLowerCase()}-apt-trade-${monthStr}-${Date.now().toString(36)}`;

        const inserted = await safeBlogInsert(supabase, {
          title: parsed.title, slug, content,
          excerpt: parsed.excerpt || parsed.title,
          category: 'apt',
          tags: parsed.tags || [region, '실거래가'],
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords('apt', parsed.tags),
          source_type: 'ai',
          source_ref: `trade-analysis-${region}-${monthStr}`,
          data_date: monthStr,
        });
        if (inserted.success) created++;
      } catch { /* continue */ }
    }
    return { processed: targets.length, created, failed: 0, metadata: { regions: targets } };
  });

  return NextResponse.json({ ok: true, ...result });
}

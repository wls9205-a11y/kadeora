import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';

export const maxDuration = 300;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-dividend-etf', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    let created = 0;

    // 고배당 종목 조회
    const { data: divStocks } = await (sb as any).from('stock_quotes')
      .select('symbol,name,price,sector,dividend_yield,market_cap')
      .not('dividend_yield', 'is', null)
      .gt('dividend_yield', 2)
      .eq('is_active', true)
      .order('dividend_yield', { ascending: false })
      .limit(20);

    if (divStocks && divStocks.length >= 5) {
      const slug = `high-dividend-stocks-${month}`;
      const { data: ex } = await sb.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
      if (!ex) {
        const title = `고배당주 TOP ${Math.min(divStocks.length, 10)} — ${month} 배당수익률 순위`;
        const stockList = divStocks.slice(0, 10).map((s: any, i: number) =>
`### ${i + 1}. ${s.name} (${s.symbol})
- **배당수익률**: ${s.dividend_yield?.toFixed(2)}%
- **현재가**: ${typeof s.price === 'number' ? s.price.toLocaleString() : s.price}원
- **섹터**: ${s.sector || '기타'}
- [종목 상세보기](${SITE_URL}/stock/${s.symbol})`
        ).join('\n\n');

        const avgYield = (divStocks.slice(0, 10).reduce((a: number, s: any) => a + (s.dividend_yield || 0), 0) / Math.min(divStocks.length, 10)).toFixed(2);
      // AI 생성 (하드코딩 → 완성형)
      const links = [
        '[무료 계산기 모음 →](/calc)',
        '[부동산 정보 →](/apt)',
        '[카더라 블로그 →](/blog?category=finance)',
        '[커뮤니티 →](/feed)',
        '[주식 시세 →](/stock)',
      ];
      const prompt = buildFinancePrompt(title, 'finance', links);
      const aiResult = await generateAndValidate(prompt, 'finance');
      if (!aiResult) return;

        const res = await safeBlogInsert(sb, {
          slug,
          title,
          content: aiResult.content,
          category: 'stock',
          tags: ['고배당주', '배당수익률', '배당금', '배당투자', month],
          source_type: 'dividend-etf',
          cron_type: 'blog-dividend-etf',
          data_date: today,
          meta_description: generateMetaDesc(aiResult.content, title, 'stock'),
          meta_keywords: generateMetaKeywords('stock', ['배당주', '배당수익률']),
        is_published: true,
        });
        if (res.success) created++;
      }
    }

    return { created };
  });
  return NextResponse.json(result, { status: 200 });
}

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
        const content = `## ${month} 고배당주 순위

배당수익률 기준으로 상위 종목을 정리했습니다. 평균 배당수익률 ${avgYield}%입니다.

## TOP 10 고배당 종목

${stockList}

## 배당 투자 체크리스트

1. **배당수익률만 보지 말 것** — 높은 배당률은 주가 하락의 결과일 수 있습니다
2. **배당 지속성 확인** — 3년 이상 꾸준히 배당한 종목이 안정적입니다
3. **배당락일 확인** — 배당을 받으려면 배당락일 전에 매수해야 합니다
4. **세금 고려** — 배당소득세 15.4%, 연 2천만원 초과 시 종합과세

## 관련 정보

- [배당금 계산기](${SITE_URL}/calc/investment/dividend-calc)
- [종목 비교](${SITE_URL}/stock/compare)
- [배당주 페이지](${SITE_URL}/stock/dividend)
`;

        const res = await safeBlogInsert(sb, {
          slug,
          title,
          content,
          category: 'stock',
          tags: ['고배당주', '배당수익률', '배당금', '배당투자', month],
          source_type: 'dividend-etf',
          cron_type: 'blog-dividend-etf',
          data_date: today,
          meta_description: generateMetaDesc(content, title, 'stock'),
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

import { diversifyPrompt } from '@/lib/blog-prompt-diversity';
export const maxDuration = 60;
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-monthly-market', async () => {
    const supabase = getSupabaseAdmin();

    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;;
    const slug = `monthly-market-review-${monthKey}`;

    const { data: exists } = await supabase.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (exists) return { processed: 0, created: 0, failed: 0 };

    const [stocksRes, tradeRes, unsoldRes, _blogCountRes] = await Promise.all([
      supabase.from('stock_quotes').select('name, change_pct, market').in('market', ['KOSPI', 'KOSDAQ']),
      supabase.from('apt_trade_monthly_stats').select('region,stat_month,trade_count,avg_price,avg_area,avg_price_per_pyeong').eq('stat_month', monthKey),
      supabase.from('unsold_monthly_stats').select('region,stat_month,total_unsold,after_completion').eq('stat_month', monthKey),
      supabase.from('blog_posts').select('id', { count: 'exact', head: true }).gte('created_at', prevMonth.toISOString()),
    ]);

    const stocks = stocksRes.data || [];
    const trades = tradeRes.data || [];
    const unsoldData = unsoldRes.data || [];
    const totalUnsold = unsoldData.reduce((s: number, u: any) => s + (u.unsold_count || 0), 0);
    const totalTrades = trades.reduce((s: number, t: any) => s + (t.trade_count || 0), 0);

    const title = `${monthKey} 월간 시장 종합 리뷰`;
    let content = '';
    let apiCalls = 0;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const prompt = diversifyPrompt(`${monthKey} 한국 투자 시장 월간 종합 리뷰를 작성하세요.
데이터: 주식 ${stocks.length}종목, 실거래 ${totalTrades}건, 미분양 ${totalUnsold}건
마크다운 형식, 2000자 이상. 제목 별도 X.
섹션: ## 주식 시장 월간 동향, ## 부동산 시장 월간 동향, ## 미분양 현황, ## 투자 시사점, ## 다음 달 전망`);

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(45000),
        });
        apiCalls = 1;
        if (!res.ok) { if (res.status === 529 || res.status === 402) return { processed: 0, created: 0, failed: 0, metadata: { reason: 'anthropic_credit_exhausted' } }; return { processed: 0, created: 0, failed: 1, metadata: { reason: 'anthropic_error', status: res.status } }; }
      if (res.ok) {
          const data = await res.json();
          content = data.content?.[0]?.text || '';
        }
      } catch {}
    }

    if (!content) {
      content = `## ${monthKey} 주식 시장\n\n국내 증시 ${stocks.length}종목이 거래되었습니다.\n\n## 부동산 시장\n\n실거래 ${totalTrades}건, 미분양 ${totalUnsold}건.\n\n> 정보 제공 목적이며 투자 권유가 아닙니다.`;
    }

    const tags = ['월간리뷰', 'market-review', monthKey];
    const _r = await safeBlogInsert(supabase, {
      slug, title,
      content: ensureMinLength(content, 'stock'),
      excerpt: `${monthKey} 월간 시장 종합 리뷰`,
      category: 'stock', tags, cron_type: 'monthly-market',
      cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(title)}&type=blog`,
      image_alt: generateImageAlt('stock', title),
      meta_description: generateMetaDesc(content),
      meta_keywords: generateMetaKeywords('stock', tags),
    });

    return { processed: 1, created: _r.success ? 1 : 0, failed: _r.success ? 0 : 1, metadata: { api_name: 'anthropic', api_calls: apiCalls } };
  });

  if (!result.success) return NextResponse.json({ error: result.error }, { status: 200 });
  return NextResponse.json({ ok: true, ...result });
}

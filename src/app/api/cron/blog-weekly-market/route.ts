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

  const result = await withCronLogging('blog-weekly-market', async () => {
    const supabase = getSupabaseAdmin();

    const now = new Date();
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const weekStr = `${now.getFullYear()}-W${String(Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, '0')}`;;
    const slug = `weekly-market-review-${weekStr}`;

    // Check if already exists
    const { data: exists } = await supabase.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (exists) return { processed: 0, created: 0, failed: 0 };

    // Gather data
    const [stocksRes, aptsRes, unsoldRes] = await Promise.all([
      supabase.from('stock_quotes').select('name, change_pct, sector, market').in('market', ['KOSPI', 'KOSDAQ']),
      supabase.from('apt_subscriptions').select('house_nm, region_nm, rcept_bgnde').gte('rcept_bgnde', weekAgo.toISOString().slice(0, 10)).limit(10),
      supabase.from('unsold_apts').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    const stocks = stocksRes.data || [];
    const upCount = stocks.filter(s => (s.change_pct || 0) > 0).length;
    const avgPct = stocks.length ? (stocks.reduce((s, st) => s + (st.change_pct || 0), 0) / stocks.length).toFixed(2) : '0';
    const newApts = aptsRes.data || [];
    const unsoldCount = unsoldRes.count || 0;

    let title = `주간 시장 리뷰 (${weekStr})`;
    let content = '';
    let apiCalls = 0;

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const prompt = diversifyPrompt(`한국 투자 시장 주간 리뷰를 작성하세요.
데이터: 주식 ${stocks.length}종목 중 상승 ${upCount}개, 평균등락 ${avgPct}%
신규 청약 ${newApts.length}건, 미분양 ${unsoldCount}건
마크다운 형식, 1500자 이상. 제목은 별도로 주지 마세요.
섹션: ## 주식 시장, ## 부동산 시장, ## 투자 전략, ## 다음 주 전망`);

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
          signal: AbortSignal.timeout(30000),
        });
        apiCalls = 1;
        if (res.ok) {
          const data = await res.json();
          content = data.content?.[0]?.text || '';
          // Extract title if AI provided one
          const titleMatch = content.match(/^#\s+(.+)/m);
          if (titleMatch) {
            title = titleMatch[1];
            content = content.replace(/^#\s+.+\n?/, '');
          }
        }
      } catch {}
    }

    if (!content) {
      content = `## 주식 시장\n\n이번 주 국내 증시는 ${stocks.length}개 종목 중 ${upCount}개가 상승하며 평균 ${avgPct}% 등락을 기록했습니다.\n\n## 부동산 시장\n\n신규 청약 ${newApts.length}건이 접수되었으며, 전국 미분양은 ${unsoldCount}건입니다.\n\n## 다음 주 전망\n\n시장 동향을 주시하며 신중한 투자 결정이 필요합니다.\n\n> 본 콘텐츠는 정보 제공 목적이며 투자 권유가 아닙니다.`;
    }

    const tags = ['주간리뷰', 'market-review', weekStr];
    const _r = await safeBlogInsert(supabase, {
      slug, title,
      content: ensureMinLength(content, 'stock'),
      excerpt: `${weekStr} 주간 시장 리뷰 — 주식/부동산 종합 분석`,
      category: 'stock', tags, cron_type: 'weekly-market',
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

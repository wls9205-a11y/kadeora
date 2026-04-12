import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-dividend-etf', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    const slug = `high-dividend-stocks-${month}`;

    const { data: ex } = await sb.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (ex) return { created: 0 };

    const title = `고배당주 TOP 10 — ${month} 배당수익률 순위`;
    const links = [
      '[종합 시세 →](/stock)', '[종목 비교 →](/stock/compare)',
      '[배당주 순위 →](/stock/dividend)', '[카더라 블로그 →](/blog?category=stock)',
      '[커뮤니티 →](/feed)',
    ];
    const prompt = buildFinancePrompt(title, 'stock', links);
    const aiResult = await generateAndValidate(prompt, 'stock');
    if (!aiResult) return { created: 0 };

    const res = await safeBlogInsert(sb, {
      slug, title, content: aiResult.content, category: 'stock',
      tags: ['고배당주', '배당수익률', '배당금', '배당투자', month],
      source_type: 'dividend-etf', cron_type: 'blog-dividend-etf', data_date: today,
      meta_description: generateMetaDesc(aiResult.content, title, 'stock'),
      meta_keywords: generateMetaKeywords('stock', ['배당주', '배당수익률']),
      is_published: true,
    });
    return { created: res.success ? 1 : 0 };
  });
  return NextResponse.json(result, { status: 200 });
}

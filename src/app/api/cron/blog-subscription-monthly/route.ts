import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-subscription-monthly', async () => {
    const sb = getSupabaseAdmin();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const slug = `subscription-schedule-${year}-${String(month).padStart(2, '0')}`;

    const { data: ex } = await sb.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (ex) return { created: 0 };

    const title = `${year}년 ${month}월 청약 일정 총정리 — 주요 단지·접수기간·당첨 발표일`;
    const links = [
      '[전체 청약 일정 →](/apt)', '[청약 가점 계산 →](/apt/diagnose)',
      '[취득세 계산기 →](/calc/real-estate/acquisition-tax)',
      '[카더라 블로그 →](/blog?category=apt)', '[커뮤니티 →](/feed)',
    ];
    const prompt = buildFinancePrompt(title, 'apt', links);
    const aiResult = await generateAndValidate(prompt, 'apt');
    if (!aiResult) return { created: 0 };

    const res = await safeBlogInsert(sb, {
      slug, title, content: aiResult.content, category: 'apt',
      tags: ['청약', `${month}월 청약`, '청약 일정', '아파트 분양', String(year)],
      source_type: 'subscription-monthly', cron_type: 'blog-subscription-monthly',
      data_date: now.toISOString().slice(0, 10),
      meta_description: generateMetaDesc(aiResult.content, title, 'apt'),
      meta_keywords: generateMetaKeywords('apt', ['청약', `${month}월`, '일정']),
      is_published: true,
    });
    return { created: res.success ? 1 : 0 };
  });
  return NextResponse.json(result, { status: 200 });
}

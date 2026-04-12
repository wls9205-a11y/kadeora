import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';
import { CALC_REGISTRY } from '@/lib/calc/registry';
import { SITE_URL } from '@/lib/constants';

export const maxDuration = 300;

const BATCH = 3;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-calculator-guide', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    let created = 0;

    // 이미 발행된 계산기 가이드 슬러그 조회
    const { data: existing } = await sb.from('blog_posts').select('slug').like('slug', 'calc-guide-%');
    const existingSlugs = new Set((existing || []).map((r: any) => r.slug));

    // 아직 가이드가 없는 계산기 찾기
    const candidates = CALC_REGISTRY.filter(c => !existingSlugs.has(`calc-guide-${c.slug}-2026`));
    const batch = candidates.slice(0, BATCH);

    for (const calc of batch) {
      const slug = `calc-guide-${calc.slug}-2026`;
      const title = `${calc.title} 사용법 완벽 가이드 — 2026년 최신 기준`;
      const url = `${SITE_URL}/calc/${calc.category}/${calc.slug}`;

      // AI 생성 (하드코딩 → 완성형)
      const links = [
        '[무료 계산기 모음 →](/calc)',
        '[부동산 정보 →](/apt)',
        '[카더라 블로그 →](/blog?category=finance)',
        '[커뮤니티 →](/feed)',
        '[주식 시세 →](/stock)',
      ];
      const prompt = buildFinancePrompt(calc.title, 'finance', links);
      const aiResult = await generateAndValidate(prompt, 'finance');
      if (!aiResult) continue;

      const res = await safeBlogInsert(sb, {
        slug,
        title,
        content: aiResult.content,
        category: 'finance',
        tags: [...calc.keywords.slice(0, 5), '계산기', '무료', '카더라'],
        source_type: 'calc-guide',
        cron_type: 'blog-calculator-guide',
        data_date: today,
        meta_description: generateMetaDesc(aiResult.content, title, 'finance'),
        meta_keywords: generateMetaKeywords('finance', calc.keywords),
        is_published: true,
      });
      if (res.success) created++;
    }

    return { created, remaining: candidates.length - BATCH };
  });
  return NextResponse.json(result, { status: 200 });
}

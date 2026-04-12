import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

const CALC_REGISTRY = [
  { slug: 'acquisition-tax', title: '취득세 계산기', category: 'real-estate', keywords: ['취득세', '부동산 세금', '주택 취득세'] },
  { slug: 'capital-gains-housing', title: '양도소득세 계산기', category: 'property-tax', keywords: ['양도세', '양도소득세', '부동산 양도'] },
  { slug: 'dsr-calc', title: 'DSR 계산기', category: 'real-estate', keywords: ['DSR', '대출한도', '총부채원리금'] },
  { slug: 'loan-repayment', title: '대출 상환 계산기', category: 'loan', keywords: ['대출상환', '원리금균등', '원금균등'] },
  { slug: 'brokerage-fee', title: '중개수수료 계산기', category: 'real-estate', keywords: ['중개수수료', '복비', '부동산 수수료'] },
  { slug: 'comprehensive-property-tax', title: '종합부동산세 계산기', category: 'property-tax', keywords: ['종부세', '종합부동산세', '공시가격'] },
  { slug: 'jeonse-loan', title: '전세대출 계산기', category: 'loan', keywords: ['전세대출', '전세자금', '버팀목'] },
];
const BATCH = 2;

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-calculator-guide', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    let created = 0;

    const slugs = CALC_REGISTRY.map(c => `calc-guide-${c.slug}-2026`);
    const { data: existing } = await sb.from('blog_posts').select('slug').in('slug', slugs);
    const existingSlugs = new Set((existing || []).map((r: any) => r.slug));
    const candidates = CALC_REGISTRY.filter(c => !existingSlugs.has(`calc-guide-${c.slug}-2026`));

    for (const calc of candidates.slice(0, BATCH)) {
      const slug = `calc-guide-${calc.slug}-2026`;
      const title = `${calc.title} 사용법 완벽 가이드 — 2026년 최신 기준`;
      const links = [
        `[${calc.title} 바로가기 →](/calc/${calc.category}/${calc.slug})`,
        '[무료 계산기 모음 →](/calc)', '[부동산 정보 →](/apt)',
        '[카더라 블로그 →](/blog?category=finance)', '[커뮤니티 →](/feed)',
      ];
      const prompt = buildFinancePrompt(title, 'finance', links);
      const aiResult = await generateAndValidate(prompt, 'finance');
      if (!aiResult) continue;

      const res = await safeBlogInsert(sb, {
        slug, title, content: aiResult.content, category: 'finance',
        tags: [...calc.keywords.slice(0, 5), '계산기', '무료', '카더라'],
        source_type: 'calc-guide', cron_type: 'blog-calculator-guide', data_date: today,
        meta_description: generateMetaDesc(aiResult.content, title, 'finance'),
        meta_keywords: generateMetaKeywords('finance', calc.keywords),
        is_published: true,
      });
      if (res.success) created++;
    }
    return { created };
  });
  return NextResponse.json(result, { status: 200 });
}

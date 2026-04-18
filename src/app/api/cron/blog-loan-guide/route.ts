import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

const TOPICS = [
  { slug: 'mortgage-rate-compare-2026', title: '2026 주택담보대출 금리 비교 — 은행별 최저 금리 총정리', tags: ['주담대', '금리 비교', '주택담보대출', '최저금리'], calc: '/calc/loan/loan-repayment' },
  { slug: 'jeonse-loan-guide-2026', title: '2026 전세대출 조건 총정리 — 한도·금리·자격 완벽 가이드', tags: ['전세대출', '전세자금대출', '버팀목', '한도'], calc: '/calc/loan/jeonse-loan' },
  { slug: 'dsr-guide-2026', title: 'DSR 계산법 2026 — 나도 대출받을 수 있을까?', tags: ['DSR', 'DSR 계산기', '대출한도', '스트레스DSR'], calc: '/calc/real-estate/dsr-calc' },
  { slug: 'newlywed-loan-2026', title: '신혼부부 대출 혜택 총정리 2026 — 디딤돌·보금자리·특례', tags: ['신혼부부', '디딤돌', '보금자리론', '신혼대출'], calc: '/calc/loan/loan-repayment' },
  { slug: 'ltv-dti-dsr-difference-2026', title: 'LTV DTI DSR 차이점 한방 정리 — 2026년 규제 현황', tags: ['LTV', 'DTI', 'DSR', '대출규제', '담보비율'], calc: '/calc/real-estate/ltv-calc' },
  { slug: 'prepayment-fee-guide-2026', title: '중도상환수수료 계산법 2026 — 면제 조건·절약 방법', tags: ['중도상환', '수수료', '면제', '조기상환'], calc: '/calc/loan/prepayment-fee' },
  { slug: 'refinance-guide-2026', title: '대환대출 가이드 2026 — 금리 낮추는 갈아타기 전략', tags: ['대환대출', '갈아타기', '금리인하', '리파이낸싱'], calc: '/calc/loan/refinance-compare' },
];

export async function GET(_req: NextRequest) {
  // 세션 136: 7일 간 43회 실행 / 0 processed / ~83분 누적 — 모든 토픽 기생성됨.
  // 재활성 시 이 early-return 제거. 복구 방법: blog_posts에서 해당 slug들 삭제 후 재주행.
  return NextResponse.json({ ok: true, disabled: true, reason: 'session-136: 0 processed in 7d, topics exhausted' });

  // eslint-disable-next-line no-unreachable
  const result = await withCronLogging('blog-loan-guide', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    let created = 0;

    const { data: existing } = await sb.from('blog_posts').select('slug').in('slug', TOPICS.map(t => t.slug));
    const existingSlugs = new Set((existing || []).map((r: any) => r.slug));
    let aiCalls = 0;
    const MAX_AI_CALLS = 3;

    for (const topic of TOPICS) {
      if (created >= 3 || aiCalls >= MAX_AI_CALLS) break;
      if (existingSlugs.has(topic.slug)) continue;
      // AI 생성 (하드코딩 → 완성형)
      const links = [
        `[${topic.title.split('—')[0].trim()} 계산기 →](${topic.calc || '/calc'})`,
        '[무료 계산기 모음 →](/calc)',
        '[부동산 정보 →](/apt)',
        '[카더라 블로그 →](/blog?category=finance)',
        '[커뮤니티 →](/feed)',
      ];
      const prompt = buildFinancePrompt(topic.title, 'finance', links);
      aiCalls++;
      const aiResult = await generateAndValidate(prompt, 'finance');
      if (!aiResult) continue;

      const res = await safeBlogInsert(sb, {
        slug: topic.slug,
        title: topic.title,
        content: aiResult.content,
        category: 'finance',
        tags: topic.tags,
        source_type: 'loan-guide',
        cron_type: 'blog-loan-guide',
        data_date: today,
        meta_description: generateMetaDesc(aiResult.content, topic.title, 'finance'),
        meta_keywords: generateMetaKeywords('finance', topic.tags),
        is_published: true,
      });
      if (res.success) created++;
      if (created >= 3) break;
    }

    return { created };
  });
  return NextResponse.json(result, { status: 200 });
}

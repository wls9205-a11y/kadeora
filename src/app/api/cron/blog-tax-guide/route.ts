import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';
import { buildFinancePrompt, generateAndValidate } from '@/lib/blog-prompt-templates';

export const maxDuration = 300;

const TOPICS = [
  { slug: 'transfer-tax-guide-2026', title: '2026 양도소득세 완벽 가이드 — 1주택 비과세 조건부터 중과세율까지', tags: ['양도세', '비과세', '1주택', '다주택자', '양도소득세'], calc: '/calc/property-tax/capital-gains-housing', cat: '부동산 세금' },
  { slug: 'acquisition-tax-guide-2026', title: '2026 취득세 계산법 총정리 — 주택 수별 세율·감면 혜택', tags: ['취득세', '취득세율', '주택 취득세', '감면'], calc: '/calc/property-tax/acquisition-tax', cat: '부동산 세금' },
  { slug: 'comprehensive-property-tax-2026', title: '2026 종합부동산세 얼마나 내나? — 세율·공제·계산 시뮬레이션', tags: ['종부세', '종합부동산세', '공시가격', '세율'], calc: '/calc/property-tax/comprehensive-property-tax', cat: '부동산 세금' },
  { slug: 'isa-tax-saving-2026', title: 'ISA 계좌 절세 전략 2026 — 비과세 한도 확대·활용법 총정리', tags: ['ISA', '비과세', '절세', '연금저축', 'ETF'], calc: '/calc/finance-tax/isa-tax-free', cat: '금융 세금' },
  { slug: 'year-end-tax-settlement-2026', title: '2026 연말정산 환급 극대화 전략 — 소득공제·세액공제 핵심 정리', tags: ['연말정산', '소득공제', '세액공제', '환급'], calc: '/calc/year-end/year-end-refund', cat: '연말정산' },
  { slug: 'comprehensive-income-tax-2026', title: '2026 종합소득세 신고 가이드 — 프리랜서·사업자 필독', tags: ['종합소득세', '5월 신고', '프리랜서', '사업소득'], calc: '/calc/income-tax/comprehensive-income-tax', cat: '소득세' },
  { slug: 'gift-tax-guide-2026', title: '2026 증여세 가이드 — 면제 한도·세율·절세 방법', tags: ['증여세', '증여 면제', '가족 증여', '절세'], calc: '/calc/inheritance/gift-tax', cat: '상속/증여' },
  { slug: 'rental-income-tax-2026', title: '2026 임대소득세 완벽 정리 — 과세 기준·신고 방법·절세 팁', tags: ['임대소득세', '주택임대', '분리과세', '종합과세'], calc: '/calc/property-tax/rental-income-tax', cat: '부동산 세금' },
  { slug: 'overseas-stock-tax-2026', title: '해외주식 양도세 계산법 2026 — 250만원 공제·절세 전략', tags: ['해외주식', '양도소득세', '250만원', '해외ETF'], calc: '/calc/finance-tax/overseas-cgt', cat: '금융 세금' },
  { slug: 'multi-house-tax-2026', title: '다주택자 세금 총정리 2026 — 양도세·종부세·취득세 한 번에', tags: ['다주택자', '세금', '중과', '양도세 유예'], calc: '/calc/property-tax/multi-house-sim', cat: '부동산 세금' },
];

export async function GET(_req: NextRequest) {
  const result = await withCronLogging('blog-tax-guide', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    let created = 0;

    const { data: existing } = await sb.from('blog_posts').select('slug').in('slug', TOPICS.map(t => t.slug));
    const existingSlugs = new Set((existing || []).map((r: any) => r.slug));
    let aiCalls = 0;
    const MAX_AI_CALLS = 3;

    for (const topic of TOPICS) {
      if (created >= 2 || aiCalls >= MAX_AI_CALLS) break;
      if (existingSlugs.has(topic.slug)) continue;

      // AI 생성 (하드코딩 템플릿 → 완성형 콘텐츠)
      const links = [
        `[${topic.title.split('—')[0].trim()} 계산기 →](${topic.calc})`,
        '[무료 계산기 모음 →](/calc)',
        '[부동산 정보 →](/apt)',
        '[카더라 블로그 →](/blog?category=finance)',
        '[커뮤니티 →](/feed)',
      ];
      const prompt = buildFinancePrompt(topic.title, 'finance', links);
      aiCalls++;
      const result = await generateAndValidate(prompt, 'finance');

      if (!result) {
        console.warn(`[blog-tax-guide] AI generation failed for ${topic.slug}`);
        continue;
      }

      const res = await safeBlogInsert(sb, {
        slug: topic.slug,
        title: topic.title,
        content: result.content,
        category: 'finance',
        tags: topic.tags,
        source_type: 'tax-guide',
        cron_type: 'blog-tax-guide',
        data_date: today,
        meta_description: generateMetaDesc(result.content, topic.title, 'finance'),
        meta_keywords: generateMetaKeywords('finance', topic.tags),
        is_published: true,
      });
      if (res.success) created++;
      if (created >= 2) break; // API 비용 제한
    }

    return { created };
  });
  return NextResponse.json(result, { status: 200 });
}

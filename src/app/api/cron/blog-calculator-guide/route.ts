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

      const content = `## ${calc.title}란?

${calc.description} 카더라에서 제공하는 무료 온라인 계산기로, 2026년 최신 기준이 반영되어 있습니다.

## 사용 방법

1. [${calc.title} 바로가기](${url})에 접속합니다
2. 필요한 정보를 입력합니다
3. 계산 결과를 확인합니다

## ${calc.categoryLabel} 카테고리 안내

${calc.categoryLabel} 분야의 다양한 계산기를 카더라에서 무료로 이용할 수 있습니다. 회원가입 없이 즉시 사용 가능합니다.

## 알아두면 좋은 점

- **무료 이용**: 회원가입이나 로그인 없이 바로 사용할 수 있습니다
- **최신 기준 반영**: 2026년 최신 세법과 기준이 반영되어 있습니다
- **모바일 최적화**: 스마트폰에서도 편리하게 이용할 수 있습니다
${calc.legalBasis ? `- **법적 근거**: ${calc.legalBasis}` : ''}

## 관련 계산기

${calc.relatedCalcs.map((s: string) => {
  const r = CALC_REGISTRY.find(x => x.slug === s);
  return r ? `- [${r.title}](${SITE_URL}/calc/${r.category}/${r.slug})` : '';
}).filter(Boolean).join('\n')}

## 자주 묻는 질문

**Q. 이 계산기는 무료인가요?**
A. 네, 카더라의 모든 계산기는 완전 무료입니다. 회원가입도 필요 없습니다.

**Q. 계산 결과가 정확한가요?**
A. 2026년 최신 세법과 기준을 반영하고 있으며, 참고용으로 활용해 주세요. 정확한 세금 신고는 세무사와 상담을 권장합니다.

---

👉 [${calc.title} 바로 사용하기](${url})
`;

      const res = await safeBlogInsert(sb, {
        slug,
        title,
        content,
        category: 'finance',
        tags: [...calc.keywords.slice(0, 5), '계산기', '무료', '카더라'],
        source_type: 'calc-guide',
        cron_type: 'blog-calculator-guide',
        data_date: today,
        meta_description: generateMetaDesc(content, title, 'finance'),
        meta_keywords: generateMetaKeywords('finance', calc.keywords),
        is_published: true,
      });
      if (res.success) created++;
    }

    return { created, remaining: candidates.length - BATCH };
  });
  return NextResponse.json(result, { status: 200 });
}

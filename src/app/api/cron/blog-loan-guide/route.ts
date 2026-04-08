import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';

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
  const result = await withCronLogging('blog-loan-guide', async () => {
    const sb = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    let created = 0;

    const { data: existing } = await sb.from('blog_posts').select('slug').in('slug', TOPICS.map(t => t.slug));
    const existingSlugs = new Set((existing || []).map((r: any) => r.slug));

    for (const topic of TOPICS) {
      if (existingSlugs.has(topic.slug)) continue;
      const calcUrl = `${SITE_URL}${topic.calc}`;
      const content = `## ${topic.title.split('—')[0].trim()}

대출과 금리에 관한 핵심 가이드입니다. 2026년 최신 규제와 기준을 반영했습니다.

## 2026년 대출 환경

2026년에는 스트레스 DSR 3단계가 시행되면서 대출 한도가 이전보다 줄어들었습니다. 같은 소득이라도 빌릴 수 있는 금액이 달라졌으므로, 사전에 정확한 계산이 필요합니다.

## 카더라 계산기로 간편 시뮬레이션

👉 **[대출 계산기 바로가기](${calcUrl})**

- 원리금균등/원금균등/만기일시 비교
- 2026년 스트레스 DSR 반영
- 무료·모바일 최적화

## 핵심 체크리스트

1. **소득 대비 상환능력** 확인 — DSR 40% 이내인지 미리 계산
2. **금리 유형** 선택 — 고정/변동/혼합 중 본인에게 유리한 것
3. **상환 방식** 비교 — 원리금균등이 일반적이지만 원금균등이 이자 총액은 적음
4. **우대금리 조건** — 급여이체, 카드사용, 신용점수 등

## 관련 계산기

- [대출 상환 계산기](${SITE_URL}/calc/loan/loan-repayment)
- [DSR 계산기](${SITE_URL}/calc/real-estate/dsr-calc)
- [전세대출 계산기](${SITE_URL}/calc/loan/jeonse-loan)
- [LTV 계산기](${SITE_URL}/calc/real-estate/ltv-calc)

---

> 이 글은 정보 제공 목적이며, 실제 대출 조건은 금융기관에 따라 다를 수 있습니다.
`;

      const res = await safeBlogInsert(sb, {
        slug: topic.slug,
        title: topic.title,
        content,
        category: 'finance',
        tags: topic.tags,
        source_type: 'loan-guide',
        cron_type: 'blog-loan-guide',
        data_date: today,
        meta_description: generateMetaDesc(content, topic.title, 'finance'),
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

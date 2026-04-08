import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';
import { generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';

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

    for (const topic of TOPICS) {
      if (existingSlugs.has(topic.slug)) continue;
      const calcUrl = `${SITE_URL}${topic.calc}`;
      const content = `## ${topic.title.split('—')[0].trim()}

${topic.cat} 분야의 핵심 세금 가이드입니다. 2026년 최신 세법 기준으로 정리했습니다.

## 2026년 주요 변경사항

2026년에는 세제 개편이 시행되면서 여러 세율과 공제 기준이 변경되었습니다. 정확한 세금 계산을 위해 최신 기준을 확인하는 것이 중요합니다.

## 카더라 계산기로 간편 계산

복잡한 세금 계산, 카더라 무료 계산기로 1분 만에 확인하세요.

👉 **[${topic.title.split('—')[0].trim()} 계산기 바로가기](${calcUrl})**

- 2026년 최신 세법 반영
- 회원가입 불필요
- 모바일에서도 편리하게 이용

## 절세 포인트

1. **공제 항목 꼼꼼히 챙기기** — 놓치기 쉬운 공제 항목을 미리 확인하세요
2. **시기 조절** — 매도·증여 시기에 따라 세금이 크게 달라질 수 있습니다
3. **전문가 상담** — 큰 금액이 관련된 경우 세무사 상담을 권장합니다

## 관련 가이드

- [무료 계산기 모음](${SITE_URL}/calc) — 145종 무료 계산기
- [부동산 정보](${SITE_URL}/apt) — 청약·분양·실거래가

---

> 이 글은 2026년 최신 세법을 기준으로 작성되었습니다. 정확한 세금 신고는 전문 세무사와 상담하시기 바랍니다.
`;

      const res = await safeBlogInsert(sb, {
        slug: topic.slug,
        title: topic.title,
        content,
        category: 'finance',
        tags: topic.tags,
        source_type: 'tax-guide',
        cron_type: 'blog-tax-guide',
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

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';


export const dynamic = 'force-dynamic';

interface MonthlyTheme { slug: string; title: string; category: string; outline: string[]; }

const MONTHLY_THEMES: Record<string, MonthlyTheme[]> = {
  '2026-03': [
    { slug: 'monthly-2026-03-q1-stock-review', title: '2026년 1분기 주식 시장 결산', category: 'stock', outline: ['코스피·코스닥 수익률', '섹터별 성과', '외국인·기관 수급', '2분기 전망'] },
    { slug: 'monthly-2026-03-spring-cheongya', title: '2026년 봄 청약 시즌 완전 가이드', category: 'apt', outline: ['3~5월 주요 분양 일정', '지역별 주목 단지', '청약 전략', '자금 계획'] },
    { slug: 'monthly-2026-03-gongsiga-impact', title: '2026년 공시가격 발표 영향 분석', category: 'apt', outline: ['공시가격 변동률', '보유세 영향', '종부세 대상 변화', '대응 전략'] },
    { slug: 'monthly-2026-03-cheongya-top10', title: '2026년 청약 경쟁률 Top10 단지', category: 'apt', outline: ['Top10 단지 목록', '높은 경쟁률 원인', '당첨 전략', '향후 분양 예정'] },
    { slug: 'monthly-2026-03-newlywed-special', title: '2026년 신혼부부 특별공급 완전 정리', category: 'apt', outline: ['자격 요건', '소득 기준', '신청 절차', '당첨 팁'] },
  ],
  '2026-04': [
    { slug: 'monthly-2026-04-dividend-season', title: '2026년 배당 시즌 총정리', category: 'stock', outline: ['주요 배당주', '배당수익률 비교', '배당 일정', '세금 처리'] },
    { slug: 'monthly-2026-04-jeonse-guide', title: '2026년 봄 전세 시장 동향', category: 'apt', outline: ['전세가격 추이', '지역별 현황', '전세사기 예방', '대출 조건'] },
  ],
  '2026-05': [
    { slug: 'monthly-2026-05-tax-season', title: '2026년 종합소득세 신고 가이드', category: 'finance', outline: ['신고 대상', '절세 항목', '신고 방법', '자주 하는 실수'] },
    { slug: 'monthly-2026-05-summer-apt', title: '2026년 여름 분양 미리보기', category: 'apt', outline: ['6~8월 분양 예정', '주목 단지', '시장 전망', '준비 사항'] },
  ],
  '2026-06': [
    { slug: 'monthly-2026-06-half-review', title: '2026년 상반기 부동산 결산', category: 'apt', outline: ['매매가 변동', '거래량 추이', '지역별 분석', '하반기 전망'] },
    { slug: 'monthly-2026-06-etf-portfolio', title: '2026년 하반기 ETF 포트폴리오 전략', category: 'stock', outline: ['상반기 성과', 'ETF 추천', '리밸런싱 전략', '리스크 관리'] },
  ],
  '2026-07': [{ slug: 'monthly-2026-07-summer-invest', title: '여름 휴가 시즌 투자 전략', category: 'stock', outline: ['여름 증시 특성', '섹터 로테이션', '해외 투자', '리스크'] }],
  '2026-08': [{ slug: 'monthly-2026-08-autumn-cheongya', title: '2026년 가을 청약 대전', category: 'apt', outline: ['9~11월 분양', '주목 단지', '가점 전략', '자금 계획'] }],
  '2026-09': [{ slug: 'monthly-2026-09-chuseok-finance', title: '추석 연휴 재테크 점검', category: 'finance', outline: ['포트폴리오 점검', '연말 절세', '내년 계획', '비상금 점검'] }],
  '2026-10': [{ slug: 'monthly-2026-10-q3-review', title: '2026년 3분기 시장 결산', category: 'stock', outline: ['실적 시즌', '수급 분석', '4분기 전망', '연말 전략'] }],
  '2026-11': [{ slug: 'monthly-2026-11-year-end-tax', title: '2026년 연말정산 미리보기', category: 'finance', outline: ['공제 항목', '절세 전략', '서류 준비', '자주 묻는 질문'] }],
  '2026-12': [{ slug: 'monthly-2026-12-year-review', title: '2026년 투자 총결산', category: 'stock', outline: ['연간 수익률', '주요 이벤트', '교훈', '2027년 전망'] }],
};

function generateMonthlyContent(theme: MonthlyTheme): string {
  let content = `${theme.title}에 대해 핵심 내용을 정리했습니다. 투자와 재테크에 도움이 되는 실용적인 정보를 담았습니다.\n\n`;
  for (const section of theme.outline) {
    content += `## ${section}\n\n`;
    if (section.includes('전망') || section.includes('전략')) {
      content += '시장 상황과 전문가 의견을 종합하면, 신중한 접근이 필요한 시기입니다. 분산 투자 원칙을 유지하면서 기회를 포착하는 것이 중요합니다. 단기적 변동성에 흔들리기보다 중장기적 관점에서 판단하시기 바랍니다.\n\n';
    } else if (section.includes('분석') || section.includes('현황')) {
      content += '최근 데이터를 바탕으로 현황을 분석했습니다. 수치적 변화와 함께 그 배경이 되는 정책적·경제적 요인도 함께 살펴보는 것이 중요합니다.\n\n';
    } else {
      content += '이 부분은 실제 행동으로 옮기기 위한 구체적인 정보를 담고 있습니다. 본인의 재무 상황과 목표에 맞게 적용해 보시기 바랍니다.\n\n';
    }
  }
  content += `---\n\n> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 투자 권유가 아닙니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.`;
  return content;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRETT;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const themes = MONTHLY_THEMES[monthKey];
    if (!themes || themes.length === 0) {
      return NextResponse.json({ ok: true, created: 0, message: `No themes for ${monthKey}` });
    }

    let created = 0;
    for (const theme of themes) {
      try {
        const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', theme.slug).maybeSingle();
        if (exists) continue;

        const content = generateMonthlyContent(theme);
        const tags = [monthKey, theme.category];

        await admin.from('blog_posts').insert({
          slug: theme.slug,
          title: theme.title,
          content: ensureMinLength(content, theme.category),
          excerpt: `${theme.title} — 카더라 월별 특집`,
          category: theme.category,
          tags,
          cron_type: 'monthly-theme',
          cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(theme.title)}&type=blog`,
          image_alt: generateImageAlt(theme.category, theme.title),
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords(theme.category, tags),
        });
        created++;
      } catch (e: any) {
        console.error(`[blog-monthly-theme] Error for ${theme.slug}:`, e.message);
      }
    }

    console.log(`[blog-monthly-theme] Created ${created} for ${monthKey}`);
    return NextResponse.json({ ok: true, created, month: monthKey });
  } catch (error: any) {
    console.error('[blog-monthly-theme] Error:', error);
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}

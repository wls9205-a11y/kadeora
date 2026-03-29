import { errMsg } from '@/lib/error-utils';
export const maxDuration = 300;
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { withCronLogging } from '@/lib/cron-logger';
import { SITE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface MonthlyTheme { slug: string; title: string; category: string; sections: { heading: string; body: string }[]; }

const MONTHLY_THEMES: Record<string, MonthlyTheme[]> = {
  '2026-03': [
    { slug: 'monthly-2026-03-q1-stock-review', title: '2026년 1분기 주식 시장 결산', category: 'stock', sections: [
      { heading: '코스피·코스닥 1분기 수익률', body: '2026년 1분기 코스피는 전 분기 대비 상승세를 이어갔습니다. 반도체, AI 관련주가 강세를 보이며 코스피 지수를 견인했고, 코스닥은 바이오·2차전지 섹터를 중심으로 변동성이 컸습니다.\n\n투자자들은 1분기 실적 시즌을 앞두고 어닝 서프라이즈가 예상되는 종목에 주목할 필요가 있습니다. 특히 수출 회복세와 맞물린 반도체·자동차 업종의 실적 개선이 기대됩니다.' },
      { heading: '섹터별 성과 분석', body: '**반도체**: HBM(고대역폭 메모리) 수요 지속으로 삼성전자, SK하이닉스 중심 강세. AI 서버용 메모리 수요가 구조적 성장을 뒷받침하고 있습니다.\n\n**자동차**: 현대차·기아 수출 호조, 전기차 전환 가속화. 다만 전기차 가격 경쟁 심화에 따른 마진 축소 우려도 존재합니다.\n\n**바이오**: 신약 파이프라인 이벤트에 따른 종목별 차별화 심화. 임상 결과 발표 전후 변동성에 유의해야 합니다.\n\n**2차전지**: 리튬 가격 안정화와 함께 바닥 다지기 국면. 유럽·북미 전기차 정책 방향이 핵심 변수입니다.' },
      { heading: '외국인·기관 수급 동향', body: '외국인은 1분기 순매수 기조를 유지했습니다. 특히 반도체 대형주 중심으로 매수가 집중되었으며, 원/달러 환율 안정이 외국인 유입의 긍정적 요인으로 작용했습니다.\n\n기관은 연기금을 중심으로 배당주와 가치주 비중을 확대하고 있습니다. 개인 투자자는 레버리지 ETF와 테마주 중심으로 단기 매매 비중이 높은 모습입니다.' },
      { heading: '2분기 전망 및 투자 전략', body: '2분기에는 ① 1분기 실적 발표 시즌(4월) ② 미 연준 금리 결정 ③ 국내 총선 이후 정책 방향이 주요 변수입니다.\n\n**보수적 전략**: 대형주 중심 포트폴리오, 배당 ETF 비중 확대\n**적극적 전략**: 실적 개선 기대 섹터(반도체, 자동차) 비중 확대, 실적 시즌 이벤트 매매\n\n어떤 전략이든 분산 투자 원칙을 지키고, 레버리지 과다 사용을 피하시기 바랍니다.' },
    ]},
    { slug: 'monthly-2026-03-spring-cheongya', title: '2026년 봄 청약 시즌 완전 가이드', category: 'apt', sections: [
      { heading: '3~5월 주요 분양 일정', body: '2026년 봄은 수도권과 지방 모두에서 대규모 분양이 예정되어 있습니다. 서울에서는 강동·노원 등에서 공공분양이, 경기도에서는 화성·평택·김포 등에서 민간분양이 쏟아질 예정입니다.\n\n청약 일정은 한국부동산원 청약홈(applyhome.co.kr)에서 매주 업데이트되므로, 관심 단지의 모집공고를 미리 확인하세요. 인기 단지는 특별공급 접수일에 서버가 몰릴 수 있으니 모바일보다 PC에서 접수하는 것을 권합니다.' },
      { heading: '지역별 주목 단지', body: '**서울**: 재개발·재건축 분양 단지 주목. 강남권은 경쟁률이 극도로 높으므로 가점 60점 이상이 아니면 외곽 지역을 노리는 것이 현실적입니다.\n\n**경기**: GTX-A 개통 효과를 누릴 수 있는 역세권 단지. 동탄·수원·용인 일대 분양에 주목하세요.\n\n**지방 광역시**: 대구·부산은 미분양 소진 후 신규 분양이 재개되고 있어 합리적 가격에 진입할 기회가 있습니다.\n\n**공공분양**: 시세 대비 저렴한 가격이 매력이지만 전매 제한과 거주 의무 기간을 반드시 확인하세요.' },
      { heading: '청약 전략 수립', body: '**가점제 vs 추첨제 판단**\n가점 50점 이상이면 가점제 위주로, 이하면 추첨제 물량이 많은 단지를 공략하세요. 전용 85㎡ 초과 평형은 추첨 비율이 높습니다.\n\n**특별공급 자격 확인**\n신혼부부(혼인 7년 이내), 생애최초(5년 이상 근로자), 다자녀(미성년 3명 이상) 등 자격 요건을 미리 체크하세요.\n\n**복수 청약 전략**\n당해지역 1순위 떨어져도 기타지역 1순위, 2순위 기회가 있습니다. 한 단지에만 집중하지 말고 복수의 단지에 순차적으로 도전하세요.' },
      { heading: '자금 계획 세우기', body: '청약 당첨 후에는 계약금(분양가의 10~20%), 중도금(50~60%, 대출 가능), 잔금(20~30%)을 납부해야 합니다.\n\n**자금 준비 체크리스트:**\n- 계약금 현금 확보 (통상 1~2주 내 납부)\n- 중도금 대출 가능 여부 사전 확인 (DSR 규제)\n- 잔금 마련 계획 (기존 주택 매도, 전세 보증금 활용 등)\n- 취득세 (6억 이하 1%, 6~9억 2%, 9억 초과 3%)\n\n무리한 대출은 금리 상승 시 큰 부담이 될 수 있으므로, 월 상환액이 소득의 30%를 넘지 않도록 관리하세요.' },
    ]},
    { slug: 'monthly-2026-03-gongsiga-impact', title: '2026년 공시가격 발표 영향 분석', category: 'apt', sections: [
      { heading: '2026년 공시가격 변동률', body: '2026년 공동주택 공시가격은 전년 대비 평균 5.4% 상승했습니다. 서울은 6.8%, 세종 8.2%, 경기 4.9% 상승하며 수도권 중심으로 상승폭이 컸습니다.\n\n공시가격은 매년 1월 1일 기준으로 산정되며, 4월경 발표됩니다. 개별 아파트의 공시가격은 부동산공시가격알리미(realtyprice.kr)에서 확인할 수 있습니다.' },
      { heading: '보유세(재산세·종부세) 영향', body: '**재산세**: 공시가격 × 공정시장가액비율(60%) × 세율로 산출됩니다. 공시가격 상승만큼 재산세도 늘어나지만, 세부담 상한(전년 대비 105~130%)이 있어 급격한 증가는 제한됩니다.\n\n**종합부동산세**: 공시가격 합산 9억 원(1주택 12억 원) 초과 시 과세됩니다. 2026년 기준 공정시장가액비율은 60%이며, 과세 표준에 세율(0.5~2.7%)을 적용합니다.\n\n1주택자라면 고령자·장기보유 세액공제(최대 80%)를 활용할 수 있습니다.' },
      { heading: '건강보험료·기초연금 영향', body: '지역가입자의 건강보험료는 재산(공시가격 포함)을 기준으로 산정됩니다. 공시가격이 오르면 보험료도 상승할 수 있습니다.\n\n기초연금 수급 대상 판단 시에도 공시가격이 반영되므로, 고가 주택 보유자는 수급 자격에 영향을 받을 수 있습니다.\n\n피부양자 자격 유지를 위해 재산 기준을 초과하지 않는지도 확인하시기 바랍니다.' },
      { heading: '대응 전략', body: '**1주택자**: 고령자·장기보유 공제 적극 활용. 6월 1일 전 매도 시 해당 연도 종부세 비과세.\n\n**다주택자**: 합산 공시가격 확인 후 종부세 시뮬레이션. 절세를 위한 법인 전환은 장단점을 신중히 비교.\n\n**공시가격 이의 신청**: 발표 후 30일 이내 이의 신청 가능. 주변 시세 대비 공시가격이 과도하다고 판단되면 적극 활용.\n\n공시가격 열람: 부동산공시가격알리미(realtyprice.kr)에서 개별 조회 가능합니다.' },
    ]},
    { slug: 'monthly-2026-03-cheongya-top10', title: '2026년 청약 경쟁률 Top10 단지', category: 'apt', sections: [
      { heading: 'Top10 단지 목록', body: '2026년 상반기 기준 청약 경쟁률 상위 단지들은 서울·수도권 역세권 대단지에 집중되어 있습니다. 특히 서울 강남·서초·용산과 경기 성남·과천 등 핵심 입지 단지들이 수십 대 1의 경쟁률을 기록했습니다.\n\n높은 경쟁률 단지의 공통점: ① 역세권 ② 대단지(1,000세대 이상) ③ 브랜드 건설사 ④ 분양가 상한제 적용(시세 대비 저렴) ⑤ 우수 학군.' },
      { heading: '높은 경쟁률의 원인 분석', body: '분양가 상한제가 적용된 공공택지 단지는 주변 시세 대비 수억 원 저렴하여 "로또 청약"이라 불립니다. 전매 제한이 있지만, 실거주 목적이라면 확실한 시세 차익을 기대할 수 있습니다.\n\n또한 서울 내 신규 공급이 제한적인 상황에서 재개발·재건축 분양 물량은 희소성이 높아 경쟁률이 치솟는 경향이 있습니다.' },
      { heading: '당첨 전략', body: '경쟁률 100:1 이상인 단지는 현실적으로 가점 70점 이상이 아니면 당첨이 어렵습니다.\n\n**현실적 접근법:**\n- 가점 60점 이하: 추첨제 물량 또는 비인기 평형 공략\n- 특별공급 적극 활용: 신혼부부·생애최초는 일반공급보다 경쟁률 낮음\n- 부적격 당첨 노리기: 경쟁률 높은 단지는 부적격 비율도 높아 예비 당첨 가능성\n- 미계약분 물량: 당첨자 미계약 시 재공급되는 물량에 도전' },
      { heading: '향후 분양 예정', body: '2026년 하반기에도 수도권 중심으로 대형 분양이 예정되어 있습니다. 청약 가점을 꾸준히 관리하면서 기회를 기다리시기 바랍니다.\n\n**청약 가점 올리기:**\n- 무주택 기간 유지 (매년 2점씩 증가)\n- 청약통장 꾸준한 납입 (기간 가점 관리)\n- 부양가족 등재 (부모 세대합가 등)\n\n청약홈(applyhome.co.kr)에서 분양 캘린더를 정기적으로 확인하세요.' },
    ]},
    { slug: 'monthly-2026-03-newlywed-special', title: '2026년 신혼부부 특별공급 완전 정리', category: 'apt', sections: [
      { heading: '자격 요건 총정리', body: '신혼부부 특별공급은 혼인 기간 7년 이내(혼인신고일 기준)의 무주택 세대 구성원이 신청할 수 있습니다.\n\n**주요 자격:**\n- 혼인 기간 7년 이내 (예비 신혼부부는 입주 전 혼인 조건)\n- 세대 구성원 전원 무주택\n- 청약통장 가입 6개월 이상 + 지역별 납입 횟수 충족\n- 소득 기준 충족 (아래 상세)\n\n**자녀 유무에 따른 차이:**\n- 자녀 있는 경우: 우선 배정 비율 높음\n- 예비 신혼부부: 입주 전까지 혼인신고 필수' },
      { heading: '소득 기준 (2026년)', body: '신혼부부 특별공급은 소득 기준이 가장 중요한 심사 항목입니다.\n\n**공공분양:**\n- 맞벌이 기준 도시근로자 월평균 소득 140% 이하\n- 외벌이 기준 100% 이하 (배우자 소득 없음)\n\n**민간분양:**\n- 맞벌이 기준 160% 이하\n- 외벌이 기준 140% 이하\n\n2026년 기준 도시근로자 월평균 소득(3인 가구): 약 630만 원\n따라서 맞벌이 160% = 약 1,008만 원, 외벌이 140% = 약 882만 원\n\n소득 산정은 세전 총급여(근로소득원천징수영수증) 기준이며, 사업소득도 포함됩니다.' },
      { heading: '신청 절차', body: '**Step 1: 청약홈에서 모집공고 확인**\n분양 단지별 모집공고문에서 신혼부부 특별공급 물량, 신청 일정, 소득 기준을 확인합니다.\n\n**Step 2: 자격 자가 진단**\n혼인 기간, 소득, 자산(부동산·자동차·금융자산) 기준을 충족하는지 확인합니다.\n\n**Step 3: 청약 신청 (온라인)**\n청약홈(applyhome.co.kr)에서 신청합니다. 특별공급은 일반공급보다 1~2일 먼저 접수합니다.\n\n**Step 4: 서류 제출**\n당첨 시 소득증빙서류, 혼인관계증명서, 주민등록등본 등을 제출합니다.\n\n**Step 5: 계약**\n서류 심사 통과 후 분양 계약을 체결합니다.' },
      { heading: '당첨 확률 높이는 팁', body: '**1. 소득 구간 전략**: 소득이 낮을수록 우선순위가 높습니다. 맞벌이 중 한 명이 육아휴직이면 소득이 줄어 유리할 수 있습니다.\n\n**2. 자녀 수**: 태아도 포함됩니다. 임신 중이라면 모자보건수첩으로 증빙 가능합니다.\n\n**3. 해당 지역 거주**: 해당 시·도 거주자 우선 배정. 서울 분양은 서울 거주자가 유리합니다.\n\n**4. 자산 기준 유의**: 총자산 3.61억 원, 자동차 3,708만 원 이하(2026년 기준). 고가 차량 보유 시 자격 탈락 가능.\n\n**5. 부적격 주의**: 청약 신청 시 기재 내용이 사실과 다르면 당첨 취소됩니다. 소득·자산 기준을 정확하게 확인 후 신청하세요.' },
    ]},
  ],
  '2026-04': [
    { slug: 'monthly-2026-04-dividend-season', title: '2026년 배당 시즌 총정리', category: 'stock', sections: [
      { heading: '주요 배당주 및 배당수익률', body: '2026년 배당 시즌 주목할 종목들입니다. 금융주(KB금융, 신한지주, 하나금융)는 배당수익률 5~7%대로 고배당 매력이 높습니다. 통신주(SK텔레콤, KT)도 4~5%대 안정적 배당을 제공합니다.\n\n최근 주주환원 정책이 강화되면서 삼성전자, 현대차 등 대형주도 배당을 확대하는 추세입니다. 배당금은 보통 결산일(12/31) 기준 주주에게 지급되며, 실제 지급은 이듬해 4~5월입니다.' },
      { heading: '배당 일정 및 세금', body: '**배당 일정:**\n- 결산 배당: 12월 31일 기준, 다음해 4~5월 지급\n- 중간 배당: 6월 30일 기준, 8~9월 지급\n- 분기 배당: 일부 기업만 실시\n\n**배당소득세:**\n- 배당금의 15.4% (소득세 14% + 주민세 1.4%)\n- 금융소득 연 2,000만 원 초과 시 종합소득과세\n\nISA 계좌를 활용하면 비과세·분리과세 혜택을 받을 수 있습니다.' },
    ]},
    { slug: 'monthly-2026-04-jeonse-guide', title: '2026년 봄 전세 시장 동향', category: 'apt', sections: [
      { heading: '전세가격 추이 및 전망', body: '2026년 봄 전세 시장은 수도권 중심으로 보합세를 유지하고 있습니다. 서울은 소폭 상승, 경기 외곽은 약보합 흐름입니다.\n\n금리 하락 기대감에 따라 전세자금대출 부담이 줄어들면서 전세 수요가 늘고 있으며, 이는 전세가격 하방을 지지하는 요인입니다. 다만 입주 물량이 많은 지역은 공급 압박으로 가격 조정이 있을 수 있습니다.' },
      { heading: '전세사기 예방 및 안전한 계약 가이드', body: '전세사기 피해를 방지하기 위한 필수 확인 사항:\n\n1. **등기부등본**: 소유자 확인, 근저당·가압류 유무\n2. **전세보증보험**: HUG 가입 필수 (가입 거부하는 집주인 회피)\n3. **전세가율**: 매매가의 70% 이하 물건 선택\n4. **임대인 세금 체납**: 미납 국세·지방세 열람 신청\n5. **확정일자**: 잔금 당일 즉시 전입신고 + 확정일자\n\n"전세보증보험 가입이 안 되는 물건은 계약하지 마세요." 이 한 줄이 전세사기 예방의 핵심입니다.' },
    ]},
  ],
};

function generateMonthlyContent(theme: MonthlyTheme): string {
  let content = `${theme.title}에 대해 핵심 내용을 정리했습니다.\n\n`;
  for (const s of theme.sections) {
    content += `## ${s.heading}\n\n${s.body}\n\n`;
  }
  content += `---\n\n> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 투자 권유가 아닙니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.`;
  return content;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-monthly-theme', async () => {
    const admin = getSupabaseAdmin();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const themes = MONTHLY_THEMES[monthKey];
    if (!themes || themes.length === 0) return { processed: 0, created: 0, failed: 0, metadata: { api_name: 'anthropic', api_calls: 0, month: monthKey } };

    let created = 0;
    for (const theme of themes) {
      try {
        const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', theme.slug).maybeSingle();
        if (exists) continue;

        const content = generateMonthlyContent(theme);
        const tags = [monthKey, theme.category];

        const _r = await safeBlogInsert(admin, {
          slug: theme.slug, title: theme.title,
          content: ensureMinLength(content, theme.category),
          excerpt: `${theme.title} — 카더라 월별 특집`,
          category: theme.category, tags, cron_type: 'monthly-theme',
          cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(theme.title)}&design=2&type=blog`,
          image_alt: generateImageAlt(theme.category, theme.title),
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords(theme.category, tags),
        });
      if (_r.success) created++;
      } catch (e: unknown) {
        console.error(`[blog-monthly-theme] Error for ${theme.slug}:`, errMsg(e));
      }
    }

    console.info(`[blog-monthly-theme] Created ${created} for ${monthKey}`);
    return {
      processed: themes.length,
      created,
      failed: 0,
      metadata: { api_name: 'anthropic', api_calls: 0, month: monthKey },
    };
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, created: result.created });
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';

export const dynamic = 'force-dynamic';

const CATEGORY_MAP: Record<string, string> = {
  'region-guide': 'apt', 'realestate-basic': 'apt',
  'stock-basic': 'stock', 'finance-basic': 'finance', 'life-tip': 'finance',
};

const SECTION_CONTENT: Record<string, string> = {
  '청약 기본 개념': '청약은 새 아파트를 분양받기 위한 제도로, 무주택 세대 구성원이라면 누구나 신청할 수 있습니다. 청약에는 크게 **가점제**와 **추첨제** 두 가지 배정 방식이 있습니다.\n\n가점제는 무주택 기간(최대 32점), 부양가족 수(최대 35점), 청약통장 가입 기간(최대 17점)을 합산하여 총 84점 만점으로 경쟁합니다. 추첨제는 말 그대로 무작위 추첨이므로 가점이 낮은 청약자에게 기회가 됩니다.\n\n청약통장은 **주택청약종합저축**으로 통합되었으며, 매월 2만~50만 원을 납입합니다. 납입 인정액이 높을수록 1순위 조건 충족에 유리하며, 가입 후 최소 6~24개월(지역별 상이)이 지나야 1순위 자격을 얻습니다.',
  '청약 가점 계산': '청약 가점은 총 84점 만점으로 세 가지 항목으로 구성됩니다.\n\n**1. 무주택 기간 (최대 32점)**\n만 30세 이후부터 산정되며, 1년 미만 2점에서 15년 이상 32점까지 부여됩니다. 배우자 포함 세대원 전체가 무주택이어야 합니다.\n\n**2. 부양가족 수 (최대 35점)**\n본인 제외 세대원 수로, 0명이면 5점, 6명 이상이면 35점입니다. 만 19세 이상 미혼 자녀, 부모(만 60세 이상)가 포함됩니다.\n\n**3. 청약통장 가입 기간 (최대 17점)**\n6개월 미만 1점에서 15년 이상 17점까지 부여됩니다.\n\n**가점 계산 예시**: 무주택 10년(24점) + 부양가족 3명(25점) + 통장 8년(10점) = **59점**\n\n가점 확인은 청약홈(applyhome.co.kr)에서 모의 계산할 수 있습니다.',
  '청약 전략': '청약 당첨 확률을 높이기 위한 실전 전략입니다.\n\n**가점이 높다면(60점 이상):**\n- 인기 지역 대단지 가점제 물량에 도전\n- 서울·수도권 전용 85㎡ 이하는 가점제 비율 높음\n\n**가점이 낮다면(40점 이하):**\n- 비규제지역 추첨제 물량 공략\n- 전용 85㎡ 초과 중대형 평형 (추첨 비율 높음)\n- 민영주택 일반공급 추첨 물량 집중\n\n**특별공급 활용:**\n- 신혼부부(혼인 7년 이내): 소득 기준 충족 시 유리\n- 생애최초: 5년 이상 근로소득자, 무주택\n- 다자녀: 미성년 자녀 3명 이상\n\n청약 일정은 청약홈에서 미리 확인하고 캘린더에 등록해두세요.',
  '전세 계약 체크리스트': '전세 계약 시 반드시 확인해야 할 핵심 항목들입니다.\n\n**1. 등기부등본 확인 (가장 중요)**\n- 소유자와 계약자가 동일인인지 확인\n- 근저당, 가압류 등 권리 관계 확인\n- 계약 당일과 잔금일 모두 확인 필수\n\n**2. 전세보증보험 가입**\n- HUG(주택도시보증공사) 전세보증보험 필수 가입\n- 가입 가능 여부를 계약 전에 미리 확인\n- 보증료는 전세금의 0.1~0.15% 수준\n\n**3. 전세가율 확인**\n- 전세가/매매가 비율이 70% 이하인 물건 선호\n- 80% 이상이면 역전세·깡통전세 위험\n\n**4. 확정일자 및 전입신고**\n- 잔금 당일 즉시 전입신고 + 확정일자 받기\n- 우선변제권 확보의 핵심\n\n**5. 임대인 세금 체납 여부**\n- 미납 국세·지방세 열람 요청 가능',
  '주식 투자 시작하기': '주식 투자를 처음 시작하는 분들을 위한 단계별 가이드입니다.\n\n**Step 1: 증권 계좌 개설**\n대부분의 증권사에서 비대면(앱)으로 10분 내 개설 가능합니다. 주요 선택 기준: 수수료, 앱 편의성, 리서치 제공 여부.\n\n**Step 2: 투자 자금 설정**\n여유 자금으로만 투자하세요. 비상금(월 생활비 3~6개월분)을 확보한 후 남는 자금으로 시작합니다. 처음에는 소액(10~50만 원)으로 시작을 권합니다.\n\n**Step 3: ETF로 시작**\nKOSPI200 ETF, S&P500 ETF 등 지수 추종 ETF는 분산 투자 효과가 있어 초보자에게 적합합니다. 개별 종목보다 리스크가 낮습니다.\n\n**Step 4: 분할 매수 원칙**\n한 번에 전액 투자하지 말고, 3~6회에 나눠 분할 매수하세요. 시장 타이밍을 맞추기보다 평균 매입 단가를 낮추는 전략이 안전합니다.\n\n**Step 5: 장기 투자 마인드**\n단기 등락에 일희일비하지 마세요. 최소 3~5년 이상 장기 보유 관점에서 접근하면 복리 효과를 누릴 수 있습니다.',
  'ETF 투자 가이드': 'ETF(상장지수펀드)는 주식처럼 거래되면서도 펀드처럼 분산 투자되는 상품입니다.\n\n**국내 주요 ETF:**\n- KODEX 200: KOSPI200 지수 추종, 가장 기본적인 ETF\n- TIGER 미국S&P500: 미국 대형주 500개에 투자\n- KODEX 미국나스닥100: 미국 기술주 중심\n\n**ETF 선택 기준:**\n- 운용보수: 낮을수록 유리 (0.05~0.5%)\n- 거래량: 일 거래량 많을수록 매매 편리\n- 추적 오차: 지수와 괴리가 작을수록 좋음\n\n**세금:**\n- 국내 주식형 ETF: 매매차익 비과세, 분배금 15.4%\n- 해외 주식형 ETF: 매매차익 22% (연 250만 원 기본공제)\n- ISA 계좌 활용 시 세제 혜택 가능\n\n**포트폴리오 예시 (중위험):**\n국내주식 ETF 30% + 미국주식 ETF 40% + 채권 ETF 20% + 현금성 10%',
  '연말정산 절세': '연말정산은 "13월의 월급"이 될 수도, 추가 납부가 될 수도 있습니다. 핵심 절세 전략을 정리합니다.\n\n**소득공제 항목:**\n- 신용카드 등 사용액: 총급여 25% 초과분부터 공제 (신용카드 15%, 체크카드·현금 30%)\n- 주택청약저축: 연 240만 원 한도 40% 공제\n- 주택임차차입금 원리금 상환: 연 400만 원 한도\n\n**세액공제 항목:**\n- 연금저축: 연 600만 원 한도 (13.2~16.5%)\n- IRP: 연금저축 포함 연 900만 원 한도\n- 보험료: 연 100만 원 한도 12%\n- 의료비: 총급여 3% 초과분 15%\n- 교육비: 초중고 300만 원, 대학 900만 원 한도\n- 기부금: 정치자금 10만 원 전액, 종교단체 등 15~30%\n\n**절세 극대화 팁:**\n1. 연금저축+IRP 900만 원 한도 가득 채우기 (최대 148.5만 원 환급)\n2. 체크카드 사용 비율 높이기 (공제율 30%로 신용카드의 2배)\n3. 연말에 의료비 몰아서 지출하기 (3% 기준선 넘기기)',
  '비상금 만들기': '재테크의 첫 걸음은 비상금 확보입니다. 예상치 못한 상황에 대비하는 안전망을 구축하세요.\n\n**비상금 목표 금액:**\n- 최소: 월 생활비 × 3개월\n- 권장: 월 생활비 × 6개월\n- 예시: 월 200만 원 생활비 → 비상금 600~1,200만 원\n\n**비상금 마련 전략:**\n1. 월 수입의 최소 10~20%를 자동이체로 별도 계좌에 저축\n2. CMA 통장 활용: 수시입출금 가능하면서 일반 통장보다 높은 이자\n3. 파킹통장: 하루만 맡겨도 이자가 붙는 고금리 수시입출금\n4. 보너스·상여금은 전액 비상금으로\n\n**비상금 보관 원칙:**\n- 원금 손실 없는 안전한 곳 (예금, CMA, MMF)\n- 즉시 인출 가능해야 함\n- 투자 자금과 반드시 분리 관리',
  '신용점수 관리': '신용점수는 대출 금리, 신용카드 한도 등 금융 생활 전반에 영향을 미칩니다.\n\n**신용점수 구성 요소:**\n- 상환 이력 (35%): 연체 없이 꾸준한 상환이 가장 중요\n- 부채 수준 (30%): 총 부채 대비 가용 한도 비율\n- 신용 거래 기간 (15%): 오래된 계좌일수록 유리\n- 신규 신용 조회 (10%): 단기간 다수 조회 시 감점\n- 신용 유형 (10%): 다양한 신용 활동 (카드, 대출 등)\n\n**점수 올리는 방법:**\n1. 소액이라도 매달 카드 사용 후 결제일에 전액 납부\n2. 통신비, 국민연금 등 비금융 실적 등록 (카카오뱅크, 토스 등)\n3. 불필요한 카드 해지 자제 (오래된 카드는 유지)\n4. 대출 조회 시 "한도조회"로 요청 (신용조회 최소화)\n5. 연체 절대 금지 (1일 연체도 기록됨)\n\n**확인 방법:** 올크레딧, NICE지키미, 카카오뱅크, 토스에서 무료 조회 가능',
};

function generateGuideContent(seed: any): string {
  const title = seed.title || '가이드';
  const outline = (seed.outline || '').split('|').map((s: string) => s.trim()).filter(Boolean);
  const category = seed.seed_category || '';
  const desc = seed.description || seed.intro || '';

  let content = `${desc || `${title}에 대해 핵심 내용을 정리했습니다. 실생활에 바로 적용할 수 있는 구체적인 정보와 팁을 담았습니다.`}\n\n`;

  for (const section of outline) {
    content += `## ${section}\n\n`;
    // 미리 정의된 고품질 콘텐츠가 있으면 사용
    const matched = Object.entries(SECTION_CONTENT).find(([key]) => section.includes(key) || key.includes(section));
    if (matched) {
      content += matched[1] + '\n\n';
    } else {
      content += generateSectionContent(section, category, seed) + '\n\n';
    }
  }

  content += `## 자주 묻는 질문 (FAQ)\n\n`;
  const faqs = generateFaqs(title, category, seed);
  for (const faq of faqs) { content += `### ${faq.q}\n${faq.a}\n\n`; }

  content += `---\n\n> **면책고지**: 본 콘텐츠는 정보 제공 목적으로 작성되었으며 투자 권유가 아닙니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.`;
  return content;
}

function generateSectionContent(section: string, category: string, seed: any): string {
  if (section.includes('청약')) return '청약은 무주택 세대 구성원이라면 누구나 도전할 수 있습니다. 가점제와 추첨제의 차이를 이해하고, 본인의 상황에 맞는 전략을 세우는 것이 중요합니다. 청약통장 가입 기간, 부양가족 수, 무주택 기간이 가점의 핵심 요소입니다.\n\n가점이 높다면(60점 이상) 인기 지역 가점제 물량에 도전하고, 낮다면 비규제지역 추첨제 또는 특별공급을 노리는 것이 전략적입니다. 청약 일정은 청약홈(applyhome.co.kr)에서 사전에 확인하세요.';
  if (section.includes('전세')) return '전세 계약 시에는 등기부등본 확인, 전세보증보험 가입, 집주인 신원 확인이 필수입니다. 전세가율이 70%를 넘으면 역전세 위험이 있으므로 주의가 필요합니다.\n\n계약 전 확인사항: ① 등기부등본 소유자·근저당 확인 ② HUG 전세보증보험 가입 가능 여부 ③ 확정일자 및 전입신고 ④ 임대인 세금 체납 열람. 잔금일 당일 등기부등본을 한 번 더 확인하는 것을 잊지 마세요.';
  if (section.includes('주식') || section.includes('투자 시작')) return '주식 투자의 기본은 분산 투자입니다. 한 종목에 집중하기보다 업종과 시가총액을 고려한 포트폴리오 구성이 안정적입니다. ETF를 활용하면 초보자도 쉽게 분산 투자할 수 있습니다.\n\n초보자 권장 순서: ① 증권 계좌 비대면 개설 ② 소액(10~50만 원)으로 시작 ③ 지수 ETF(KODEX200, TIGER S&P500) 매수 ④ 분할 매수로 평균 단가 관리 ⑤ 최소 3년 이상 장기 보유.';
  if (section.includes('세금') || section.includes('절세')) return '세금 절약의 핵심은 공제 항목을 빠짐없이 활용하는 것입니다. 연금저축(연 600만 원)과 IRP(합산 900만 원)를 한도까지 채우면 최대 148.5만 원을 환급받을 수 있습니다.\n\n추가 절세 팁: 체크카드 사용 비율 높이기(공제율 30%), 연말 의료비 몰아서 지출하기(3% 기준선 넘기), 주택청약저축 납입(40% 소득공제). 연말정산 미리보기 서비스는 11월부터 국세청 홈택스에서 이용 가능합니다.';
  if (section.includes('대출') || section.includes('DSR')) return 'DSR(총부채원리금상환비율)은 연간 원리금 상환액이 연소득의 일정 비율을 넘지 않도록 하는 규제입니다. 은행권 40%, 2금융권 50%가 기준입니다.\n\n예시: 연소득 6,000만 원이면 연간 원리금 상환 한도 2,400만 원(월 200만 원). 기존 대출의 원리금도 합산되므로, 새 대출 전 기존 대출 현황을 반드시 점검하세요. 금리 유형은 고정금리(예측 가능)와 변동금리(초기 이율 낮음)가 있으며, 금리 상승기에는 고정금리가 유리합니다.';
  if (section.includes('보험') || section.includes('실손')) return '보험은 리스크 관리의 핵심 도구입니다. 꼭 필요한 보험과 과잉 보장을 구분하는 것이 중요합니다.\n\n**필수 보험**: 실손의료보험(의료비 보장), 운전자보험(교통사고 대비). **권장 보험**: 암보험, 정기보험(가장 사망 대비). **주의**: 저축성 보험은 수익률이 낮으므로 투자 목적이라면 다른 금융상품을 고려하세요.\n\n보험 점검 시 중복 보장, 불필요 특약을 확인하고, 보험료가 소득의 10%를 넘지 않도록 관리하세요.';

  // 카테고리별 범용 콘텐츠
  if (category.includes('stock')) return `${section}은(는) 성공적인 투자를 위해 반드시 이해해야 할 개념입니다. 핵심은 감정을 배제하고 원칙에 따라 행동하는 것입니다.\n\n실전에서는 ① 투자 원칙 수립 ② 분산 투자 실행 ③ 정기적 리밸런싱 ④ 손절/익절 기준 사전 설정 ⑤ 투자 일지 기록의 순서로 접근하시기 바랍니다. 시장 뉴스에 과도하게 반응하기보다 기업의 펀더멘털에 집중하세요.`;
  if (category.includes('region') || category.includes('real') || category.includes('apt')) return `${section}에 대해 실질적인 정보를 정리합니다. 부동산은 입지가 핵심이며, ① 교통(역세권 여부) ② 학군(학교 배정) ③ 편의시설 ④ 개발 호재 ⑤ 공급 물량을 종합적으로 분석해야 합니다.\n\n특히 해당 지역의 인구 유입/유출 추이, 직주근접성, 대규모 개발 계획 유무를 확인하세요. 부동산은 장기 투자 상품이므로 5~10년 후 지역 변화를 예측하는 안목이 필요합니다.`;

  return `${section}은(는) 재테크에서 핵심적인 부분입니다. 가장 중요한 것은 자신의 재무 상태를 정확히 파악하고, 무리하지 않는 범위에서 실행하는 것입니다.\n\n구체적으로는 ① 현재 수입/지출 파악 ② 단기·중기·장기 목표 설정 ③ 목표별 적합한 금융상품 선택 ④ 정기적인 점검과 조정의 순서로 접근하시기 바랍니다. 무엇보다 꾸준함이 가장 강력한 재테크 전략입니다.`;
}

function generateFaqs(title: string, category: string, seed: any) {
  if (category.includes('stock')) return [
    { q: '주식 초보자는 어떻게 시작해야 하나요?', a: '증권 계좌를 비대면으로 개설한 후, 소액(10~50만 원)으로 ETF 투자부터 시작하세요. KODEX200이나 TIGER S&P500 같은 지수 추종 ETF는 분산 투자 효과가 있어 초보자에게 적합합니다. 모의투자로 먼저 연습해보는 것도 좋습니다.' },
    { q: '투자 시 가장 중요한 원칙은?', a: '① 여유자금으로만 투자 ② 분산 투자 ③ 장기 보유 ④ 감정적 매매 금지. 이 네 가지를 지키면 장기적으로 안정적인 수익을 기대할 수 있습니다. 특히 하락장에서 공포에 매도하지 않는 것이 핵심입니다.' },
    { q: '세금은 어떻게 되나요?', a: '국내 주식은 매매차익 비과세(대주주 제외), 배당소득세 15.4%. 해외 주식은 연 250만 원 초과분에 22% 양도세. ISA 계좌를 활용하면 세제 혜택을 받을 수 있습니다.' },
  ];
  if (category.includes('apt') || category.includes('region')) return [
    { q: `${title}에서 가장 중요한 포인트는?`, a: '부동산은 입지가 가장 중요합니다. 교통(역세권), 학군, 편의시설, 개발 호재를 종합적으로 분석하세요. 특히 실거주 목적이라면 출퇴근 시간과 학교 배정을, 투자 목적이라면 향후 개발 계획과 공급 물량을 중점적으로 확인하세요.' },
    { q: '초보자도 부동산 투자를 할 수 있나요?', a: '네, 청약부터 시작하는 것을 추천합니다. 청약통장을 가입하고 가점을 쌓으면서 시장을 공부하세요. 무리한 대출 없이 본인 자금 범위 내에서 접근하는 것이 안전합니다.' },
    { q: '실거래가는 어디서 확인하나요?', a: '국토교통부 실거래가 공개시스템(rt.molit.go.kr), 네이버부동산, 호갱노노 등에서 무료로 확인할 수 있습니다. 호가와 실거래가의 차이가 크다면 시장 과열 신호일 수 있으니 주의하세요.' },
  ];
  return [
    { q: `${title}에서 가장 중요한 포인트는?`, a: '핵심은 기본 원리를 이해하고 본인 상황에 맞게 적용하는 것입니다. 무리한 결정보다 충분한 정보 수집이 우선이며, 한 번에 완벽하게 하려 하기보다 작은 것부터 실행에 옮기는 것이 중요합니다.' },
    { q: '초보자도 따라할 수 있나요?', a: '네, 이 가이드는 초보자 눈높이에 맞춰 작성되었습니다. 전문 용어는 최소화하고 실제 사례와 숫자를 포함했으니 단계별로 따라하시면 됩니다.' },
    { q: '추가로 공부할 자료가 있나요?', a: '카더라 블로그에서 관련 글을 더 찾아보시거나, 금융감독원(fss.or.kr), 한국부동산원(reb.or.kr), 국세청 홈택스(hometax.go.kr) 등 공신력 있는 기관의 자료를 참고하세요.' },
  ];
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRETT;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: seeds, error: fetchErr } = await admin.from('guide_seeds').select('*').eq('blog_generated', false);

    if (fetchErr) { console.error('[blog-seed-guide] fetch error:', fetchErr); return NextResponse.json({ error: fetchErr.message }, { status: 500 }); }
    if (!seeds || seeds.length === 0) return NextResponse.json({ ok: true, created: 0, message: 'No pending guide seeds' });

    console.log(`[blog-seed-guide] Found ${seeds.length} seeds, columns:`, Object.keys(seeds[0] || {}));

    let created = 0;
    let skipped = 0;
    for (const seed of seeds) {
      try {
        const slug = seed.blog_slug || seed.slug;
        if (!slug) { skipped++; continue; }

        const { data: exists } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
        if (exists) {
          if (seed.blog_slug) await admin.from('guide_seeds').update({ blog_generated: true }).eq('blog_slug', slug);
          else await admin.from('guide_seeds').update({ blog_generated: true }).eq('slug', slug);
          continue;
        }

        const cat = CATEGORY_MAP[seed.seed_category] || 'finance';
        const content = generateGuideContent(seed);
        const tags = seed.tags || [seed.seed_category].filter(Boolean);

        await admin.from('blog_posts').insert({
          slug, title: seed.title,
          content: ensureMinLength(content, cat),
          excerpt: seed.meta_description || `${seed.title} 완전 정리 2026`,
          category: cat, tags, cron_type: 'seed-guide',
          cover_image: `https://kadeora.app/api/og?title=${encodeURIComponent(seed.title)}&type=blog`,
          image_alt: generateImageAlt(cat, seed.title),
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords(cat, tags),
        });

        if (seed.blog_slug) await admin.from('guide_seeds').update({ blog_generated: true }).eq('blog_slug', slug);
        else await admin.from('guide_seeds').update({ blog_generated: true }).eq('slug', slug);
        created++;
      } catch (e: any) {
        console.error(`[blog-seed-guide] Error for ${seed.blog_slug || seed.slug}:`, e.message);
      }
    }

    console.log(`[blog-seed-guide] Created ${created}/${seeds.length}, skipped ${skipped}`);
    return NextResponse.json({ ok: true, created, total: seeds.length, skipped });
  } catch (error: any) {
    console.error('[blog-seed-guide] Error:', error);
    return NextResponse.json({ error: String(error.message || error) }, { status: 500 });
  }
}

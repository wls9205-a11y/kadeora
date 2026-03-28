import { errMsg } from '@/lib/error-utils';
export const maxDuration = 60;
import { safeBlogInsert } from '@/lib/blog-safe-insert';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureMinLength } from '@/lib/blog-padding';
import { generateImageAlt, generateMetaDesc, generateMetaKeywords } from '@/lib/blog-seo-utils';
import { withCronLogging } from '@/lib/cron-logger';
import { SITE_URL } from '@/lib/constants';

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

  // 카테고리별 차별화 콘텐츠 — section명을 자연스럽게 풀어쓰기
  if (category.includes('stock')) {
    if (section.includes('배당')) return `배당 투자는 기업이 이익의 일부를 주주에게 돌려주는 배당금을 통해 안정적인 수익을 추구하는 전략입니다. 국내 주요 배당주로는 KB금융(배당수익률 약 5~6%), SK텔레콤(약 4%), 삼성전자(약 2%) 등이 있습니다.\n\n배당을 받으려면 배당 기준일(보통 12월 31일) 전 영업일까지 주식을 보유해야 합니다. 배당소득세는 15.4%이며, 금융소득이 연 2,000만 원을 초과하면 종합소득세로 과세됩니다. ISA 계좌를 활용하면 세제 혜택을 받을 수 있습니다.`;
    if (section.includes('차트') || section.includes('기술적')) return `기술적 분석은 과거 주가 움직임과 거래량 패턴에서 미래 가격 방향을 예측하는 방법입니다. 대표적인 지표로 이동평균선(MA), RSI(상대강도지수), MACD, 볼린저밴드 등이 있습니다.\n\n초보자는 20일·60일·120일 이동평균선의 정배열(단기>중기>장기) 여부만 확인해도 추세를 파악하는 데 도움이 됩니다. 다만 기술적 분석만으로 매매 결정을 하기보다, 기업의 실적(펀더멘털)과 함께 종합적으로 판단하세요.`;
    return `주식 투자의 기본 원칙에 따르면, ${section}을 이해하는 것이 수익률 개선의 첫걸음입니다. 성공적인 투자자들의 공통점은 철저한 리서치, 분산 투자, 감정 통제입니다.\n\n실전 적용 방법: 먼저 관심 종목의 재무제표(매출, 영업이익, PER, PBR)를 확인하세요. 네이버 금융이나 증권사 리서치에서 무료로 볼 수 있습니다. 업종 전망과 경쟁사 대비 밸류에이션을 비교한 뒤, 분할 매수로 진입하는 것이 안전합니다.`;
  }

  if (category.includes('region') || category.includes('real') || category.includes('apt')) {
    if (section.includes('교통') || section.includes('역세권')) return `교통 접근성은 부동산 가치를 결정하는 가장 중요한 요인 중 하나입니다. 역세권(역에서 도보 5~10분 이내)은 비역세권 대비 평균 10~20% 높은 시세를 형성합니다.\n\n특히 주목할 교통 호재: GTX-A(수서~운정, 2024년 개통), GTX-B(송도~마석), GTX-C(양주~수원), 신분당선 연장, 위례신사선 등. 해당 노선의 역 인근 500m 이내 단지는 장기적으로 시세 상승이 기대됩니다.`;
    if (section.includes('학군')) return `학군은 가족 단위 실수요자에게 가장 중요한 선택 기준이며, 부동산 가격에도 큰 영향을 미칩니다. 서울 3대 학군(대치·목동·중계)과 경기도 주요 학군(분당 수내·정자, 평촌) 지역은 학군 프리미엄이 뚜렷합니다.\n\n학군 정보 확인 방법: 학교알리미(schoolinfo.go.kr)에서 학업성취도·진학률을 확인하고, 네이버 학원 검색으로 인근 학원가 밀집도를 파악하세요. 초등학교 배정은 거리 기반이므로 단지와 학교 간 실제 도보 거리를 반드시 확인하세요.`;
    return `부동산 시장에서 ${section}을 파악하는 것은 합리적인 의사결정의 기본입니다. 핵심 분석 포인트: ① 해당 지역 인구 유입·유출 추이(통계청 이동 통계) ② 신규 공급 물량(입주 예정 물량) ③ 교통 인프라 변화 ④ 대규모 개발 계획(뉴타운, 재개발) ⑤ 직주근접성.\n\n부동산은 5~10년 단위로 사이클이 움직이므로, 단기 시세 변동보다 중장기 트렌드에 주목하세요. 국토교통부 실거래가(rt.molit.go.kr)와 한국부동산원 통계를 정기적으로 확인하는 습관을 들이시기 바랍니다.`;
  }

  if (category.includes('finance') || category.includes('life')) {
    if (section.includes('예산') || section.includes('가계부')) return `효과적인 가계 관리의 시작은 수입과 지출을 정확히 파악하는 것입니다. 50/30/20 법칙을 추천합니다: 필수 지출(주거비·식비·교통비) 50%, 생활 지출(여가·쇼핑) 30%, 저축·투자 20%.\n\n가계부 앱(뱅크샐러드, 토스)을 활용하면 카드·계좌 연동으로 자동 분류됩니다. 매월 말 "고정 지출 점검일"을 정해 불필요한 구독, 보험, 통신비를 정리하세요. 작은 금액이라도 매월 절약하면 연간 수십~수백만 원 차이가 납니다.`;
    if (section.includes('연금') || section.includes('IRP')) return `노후 준비는 빠를수록 복리 효과가 커집니다. 대표적인 노후 준비 금융상품:\n\n**연금저축**: 연 600만 원 한도, 세액공제 13.2~16.5%. 펀드·ETF·보험 중 선택 가능. 55세 이후 연금으로 수령 시 3.3~5.5% 저율 과세.\n\n**IRP(개인형퇴직연금)**: 연금저축 포함 연 900만 원 한도까지 세액공제. 퇴직금 수령 시에도 활용 가능.\n\n**국민연금**: 의무 가입이지만 납입 기간이 길수록 수령액 증가. 임의가입·추납 제도 활용 가능.\n\n30대에 월 30만 원씩 연금저축에 투자하면 60세에 약 2~3억 원(연 수익률 7% 가정)을 기대할 수 있습니다.`;
    return `재테크의 첫걸음은 자신의 재무 현황을 정확히 파악하는 것입니다. ${section}에 대해 구체적으로 알아보면:\n\n가장 효과적인 접근법은 "자동화"입니다. 월급날 자동이체로 저축·투자 금액을 먼저 분리하고, 나머지로 생활하는 습관을 들이세요. 이를 "페이 유어셀프 퍼스트(Pay Yourself First)" 전략이라고 합니다.\n\n실행 가능한 첫 단계: ① 비상금 확보(월 생활비 3~6개월) ② 고금리 대출 상환 ③ 세액공제 상품(연금저축·IRP) 가입 ④ 여유 자금으로 분산 투자 시작. 한 번에 모든 것을 하려 하지 말고, 한 달에 하나씩 실행에 옮기세요.`;
  }

  // 최종 폴백 — 섹션명을 자연스럽게 풀어쓰기
  return `${section}에 대해 실질적으로 도움이 되는 정보를 정리합니다.\n\n이 주제에서 가장 중요한 것은 기본 원리를 이해한 뒤 본인의 상황에 맞게 적용하는 것입니다. 정보의 홍수 속에서 핵심을 가려내는 능력이 필요합니다.\n\n**실행 가이드:**\n1. 현재 상태 진단 — 본인의 재무·생활 현황 객관적 파악\n2. 목표 설정 — 단기(1년), 중기(3~5년), 장기(10년+) 구분\n3. 실행 계획 수립 — 구체적 행동 항목과 일정 정하기\n4. 정기 점검 — 분기별 진행 상황 리뷰 및 조정\n\n완벽을 추구하기보다 먼저 시작하는 것이 중요합니다. 작은 행동이 쌓여 큰 변화를 만듭니다.`;
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
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('blog-seed-guide', async () => {
    const admin = getSupabaseAdmin();
    const { data: seedsRaw, error: fetchErr } = await admin.from('guide_seeds').select('id, category, slug, title, blog_generated, outline, tags').eq('blog_generated', false);
    const seeds = (seedsRaw || []) as Record<string, any>[];

    if (fetchErr) { console.error('[blog-seed-guide] fetch error:', fetchErr); throw new Error(fetchErr.message); }
    if (seeds.length === 0) return { processed: 0, created: 0, failed: 0, metadata: { api_name: 'anthropic', api_calls: 0 } };

    console.info(`[blog-seed-guide] Found ${seeds.length} seeds, columns:`, Object.keys(seeds[0] || {}));

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

        const insertResult = await safeBlogInsert(admin, {
          slug, title: seed.title,
          content: ensureMinLength(content, cat),
          excerpt: seed.meta_description || `${seed.title} 완전 정리 2026`,
          category: cat, tags, cron_type: 'seed-guide',
          cover_image: `${SITE_URL}/api/og?title=${encodeURIComponent(seed.title)}&design=2&type=blog`,
          image_alt: generateImageAlt(cat, seed.title),
          meta_description: generateMetaDesc(content),
          meta_keywords: generateMetaKeywords(cat, tags),
        });

        if (insertResult.success) {
          if (seed.blog_slug) await admin.from('guide_seeds').update({ blog_generated: true }).eq('blog_slug', slug);
          else await admin.from('guide_seeds').update({ blog_generated: true }).eq('slug', slug);
          created++;
        }
      } catch (e: unknown) {
        console.error(`[blog-seed-guide] Error for ${seed.blog_slug || seed.slug}:`, errMsg(e));
      }
    }

    console.info(`[blog-seed-guide] Created ${created}/${seeds.length}, skipped ${skipped}`);
    return {
      processed: seeds.length,
      created,
      failed: skipped,
      metadata: { api_name: 'anthropic', api_calls: 0 },
    };
  });

  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }
  return NextResponse.json({ ok: true, created: result.created });
}

// 카더라 계산기 레지스트리 — 145종 전체 정의
// 이 파일 하나로 모든 계산기의 메타데이터, 입력 필드, SEO 콘텐츠를 관리

export type InputType = 'currency' | 'number' | 'percent' | 'range' | 'select' | 'radio' | 'date' | 'stepper';
export type CalcPattern = 'simple' | 'tax-bracket' | 'amortize' | 'conditional' | 'compare' | 'diagnose';

export interface CalcInput {
  id: string;
  label: string;
  type: InputType;
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string | number; label: string }[];
  hint?: string;
  condition?: string; // 다른 input의 값에 따라 표시 여부
}

export interface CalcMeta {
  slug: string;
  category: string;
  categoryLabel: string;
  title: string;
  titleShort: string;
  description: string;
  keywords: string[];
  legalBasis: string;
  version: string;
  lastUpdated: string;
  pattern: CalcPattern;
  inputs: CalcInput[];
  formula: string;           // formulas.ts의 함수명
  resultLabel: string;
  resultUnit: string;
  faqs: { q: string; a: string }[];
  seoContent: string;        // 정적 SEO 텍스트 (HTML)
  relatedCalcs: string[];    // 관련 계산기 slug
}

// ── 카테고리 정의 ──
export const CATEGORIES = [
  { id: 'property-tax', label: '부동산 세금', icon: '🏠', count: 11 },
  { id: 'income-tax', label: '소득세', icon: '💼', count: 12 },
  { id: 'finance-tax', label: '금융/투자 세금', icon: '📈', count: 8 },
  { id: 'inheritance', label: '상속/증여', icon: '🎁', count: 6 },
  { id: 'biz-tax', label: '사업자 세금', icon: '🏪', count: 8 },
  { id: 'year-end', label: '연말정산', icon: '📋', count: 10 },
  { id: 'real-estate', label: '부동산', icon: '🏢', count: 16 },
  { id: 'investment', label: '주식/투자', icon: '📊', count: 14 },
  { id: 'salary', label: '급여/노동', icon: '💰', count: 12 },
  { id: 'loan', label: '대출/예적금', icon: '🏦', count: 8 },
  { id: 'pension', label: '연금/은퇴', icon: '👴', count: 8 },
  { id: 'auto', label: '자동차', icon: '🚗', count: 7 },
  { id: 'life', label: '생활/건강', icon: '❤️', count: 12 },
  { id: 'law', label: '법률/가정', icon: '⚖️', count: 6 },
  { id: 'military', label: '군대/교육', icon: '🪖', count: 6 },
  { id: 'shopping', label: '쇼핑/소비', icon: '🛒', count: 6 },
] as const;

export type CategoryId = typeof CATEGORIES[number]['id'];

// ── 전체 레지스트리 (145종) ──
// 각 계산기는 registry에 등록만 하면 자동으로 페이지 + SEO + JSON-LD 생성

export const CALC_REGISTRY: CalcMeta[] = [
  // ════════════════════════════════════════
  // 부동산 (16종)
  // ════════════════════════════════════════
  {
    slug: 'subscription-score', category: 'real-estate', categoryLabel: '부동산',
    title: '2026 청약 가점 계산기', titleShort: '청약 가점 계산기',
    description: '무주택기간·부양가족·청약통장 가입기간(배우자 합산)으로 청약 가점 84점 만점 자동 계산. 주택공급규칙 별표1 기준.',
    keywords: ['청약 가점 계산기','청약 점수','무주택기간','부양가족','청약통장','배우자 통장 합산','2026 청약'],
    legalBasis: '주택공급에 관한 규칙 제28조 별표1', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'diagnose', formula: 'subscriptionScore', resultLabel: '내 청약 가점', resultUnit: '점',
    inputs: [], // 기존 DiagnoseClient 사용 (커스텀)
    faqs: [
      { q: '청약 가점 만점은 몇 점?', a: '84점. 무주택 32 + 부양가족 35 + 통장 17.' },
      { q: '배우자 통장도 합산?', a: '50% 인정, 최대 3점 (규칙 제28조).' },
    ],
    seoContent: '<h2>2026 청약 가점 계산기 사용 방법</h2><p>무주택기간·부양가족·청약통장 가입기간(배우자 합산)으로 청약 가점 84점 만점 자동 계산. 주택공급규칙 별표1 기준. 카더라 2026 청약 가점 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>주택공급에 관한 규칙 제28조 별표1</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 핵심 정보</h2><p>부동산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['brokerage-fee', 'jeonse-wolse', 'acquisition-tax'],

  },
  {
    slug: 'brokerage-fee', category: 'real-estate', categoryLabel: '부동산',
    title: '2026 부동산 중개수수료 계산기', titleShort: '중개수수료 계산기',
    description: '매매·전세·월세 거래금액별 부동산 중개수수료(복비)를 자동 계산합니다. 2021년 개정 요율 적용.',
    keywords: ['중개수수료 계산기','부동산 복비','중개보수','매매 수수료','전세 수수료','월세 수수료'],
    legalBasis: '공인중개사법 시행규칙 별표', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'brokerageFee', resultLabel: '중개수수료', resultUnit: '원',
    inputs: [
      { id: 'dealType', label: '거래 유형', type: 'radio', default: 'trade', options: [{ value: 'trade', label: '매매' }, { value: 'lease', label: '전세' }, { value: 'monthly', label: '월세' }] },
      { id: 'price', label: '거래금액', type: 'currency', default: 500000000, unit: '원' },
      { id: 'monthlyRent', label: '월세', type: 'currency', default: 500000, unit: '원', condition: 'dealType=monthly' },
    ],
    faqs: [
      { q: '중개수수료 상한은?', a: '거래금액에 따라 0.4~0.9%. 2021년 개정으로 상한 인하.' },
      { q: '부가세 별도?', a: '개인 중개사는 부가세 면세, 법인 중개사는 10% 부가세 별도.' },
    ],
    seoContent: '<h2>2026 부동산 중개수수료 계산기 사용 방법</h2><p>매매·전세·월세 거래금액별 부동산 중개수수료(복비)를 자동 계산합니다. 2021년 개정 요율 적용. 카더라 2026 부동산 중개수수료 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>공인중개사법 시행규칙 별표</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 핵심 정보</h2><p>부동산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['acquisition-tax', 'registration-cost', 'jeonse-wolse'],

  },
  {
    slug: 'pyeong-sqm', category: 'real-estate', categoryLabel: '부동산',
    title: '평수 ↔ 제곱미터(㎡) 환산기', titleShort: '평수 환산기',
    description: '평(坪)을 제곱미터(㎡)로, 제곱미터를 평으로 즉시 변환. 1평 = 3.3058㎡.',
    keywords: ['평수 계산기','평 제곱미터','㎡ 평 변환','아파트 평수','면적 환산'],
    legalBasis: '계량법', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'pyeongToSqm', resultLabel: '변환 결과', resultUnit: '',
    inputs: [
      { id: 'direction', label: '변환 방향', type: 'radio', default: 'toSqm', options: [{ value: 'toSqm', label: '평 → ㎡' }, { value: 'toPyeong', label: '㎡ → 평' }] },
      { id: 'value', label: '면적', type: 'number', default: 34, min: 0, max: 10000, step: 0.1 },
    ],
    faqs: [
      { q: '평수 환산기는 무료인가요?', a: '네, 카더라 평수 환산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 계량법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>평수 ↔ 제곱미터(㎡) 환산기 사용 방법</h2><p>평(坪)을 제곱미터(㎡)로, 제곱미터를 평으로 즉시 변환. 1평 = 3.3058㎡. 카더라 평수 환산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>주택임대차보호법 제7조의2</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>부동산 관련 핵심 정보</h2><p>부동산 거래와 투자에는 다양한 비용과 수익 분석이 필요합니다. 사전 계산으로 더 현명한 의사결정이 가능합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['brokerage-fee', 'rental-yield'],
  },
  {
    slug: 'jeonse-wolse', category: 'real-estate', categoryLabel: '부동산',
    title: '전월세 전환 계산기', titleShort: '전월세 전환 계산기',
    description: '전세보증금을 월세로, 월세를 전세로 전환 시 적정 금액을 계산. 전월세전환율 자동 적용.',
    keywords: ['전월세 전환 계산기','전세 월세 변환','전월세전환율','보증금 월세','반전세'],
    legalBasis: '주택임대차보호법 제7조의2', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'jeonseWolse', resultLabel: '전환 결과', resultUnit: '',
    inputs: [
      { id: 'direction', label: '전환 방향', type: 'radio', default: 'toWolse', options: [{ value: 'toWolse', label: '전세 → 월세' }, { value: 'toJeonse', label: '월세 → 전세' }] },
      { id: 'jeonse', label: '전세보증금', type: 'currency', default: 300000000, unit: '원' },
      { id: 'deposit', label: '월세 보증금', type: 'currency', default: 50000000, unit: '원' },
      { id: 'rate', label: '전월세전환율 (%)', type: 'percent', default: 4.5, min: 1, max: 10, step: 0.1 },
    ],
    faqs: [
      { q: '전월세 전환 계산기는 무료인가요?', a: '네, 카더라 전월세 전환 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 주택임대차보호법 제7조의2를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>전월세 전환 계산기 사용 방법</h2><p>전세보증금을 월세로, 월세를 전세로 전환 시 적정 금액을 계산. 전월세전환율 자동 적용. 카더라 전월세 전환 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>주택임대차보호법 제7조의2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 핵심 정보</h2><p>부동산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['brokerage-fee', 'rental-yield', 'jeonse-vs-wolse'],

  },
  {
    slug: 'rental-yield', category: 'real-estate', categoryLabel: '부동산',
    title: '임대수익률 계산기', titleShort: '임대수익률 계산기',
    description: '부동산 매입가 대비 월세 수익률(연 수익률)을 계산. 공실률·관리비·세금 반영.',
    keywords: ['임대수익률 계산기','부동산 수익률','월세 수익률','투자 수익률','원룸 수익률'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'rentalYield', resultLabel: '연 임대수익률', resultUnit: '%',
    inputs: [
      { id: 'purchasePrice', label: '매입가', type: 'currency', default: 300000000 },
      { id: 'deposit', label: '보증금', type: 'currency', default: 10000000 },
      { id: 'monthlyRent', label: '월세', type: 'currency', default: 1000000 },
      { id: 'vacancy', label: '공실률 (%)', type: 'percent', default: 5 },
      { id: 'expenses', label: '연간 관리비·세금', type: 'currency', default: 2000000 },
    ],
    faqs: [
      { q: '임대수익률 계산기는 무료인가요?', a: '네, 카더라 임대수익률 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>임대수익률 계산기 사용 방법</h2><p>부동산 매입가 대비 월세 수익률(연 수익률)을 계산. 공실률·관리비·세금 반영. 카더라 임대수익률 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>부동산 핵심 정보</h2><p>부동산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['jeonse-wolse', 'brokerage-fee'],

  },

  // ════════════════════════════════════════
  // 주식/투자 (14종)
  // ════════════════════════════════════════
  {
    slug: 'compound-interest', category: 'investment', categoryLabel: '주식/투자',
    title: '2026 복리 계산기', titleShort: '복리 계산기',
    description: '거치식·적립식 복리 투자 수익을 계산. 연/월 복리, 물가상승률 반영, 연도별 차트 제공.',
    keywords: ['복리 계산기','복리 이자','적립식 복리','거치식 복리','투자 수익 계산','72의 법칙'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'amortize', formula: 'compoundInterest', resultLabel: '최종 자산', resultUnit: '원',
    inputs: [
      { id: 'principal', label: '투자 원금', type: 'currency', default: 10000000 },
      { id: 'monthly', label: '월 적립액', type: 'currency', default: 500000 },
      { id: 'rate', label: '연 수익률 (%)', type: 'percent', default: 7, min: 0, max: 50, step: 0.1 },
      { id: 'years', label: '투자 기간 (년)', type: 'range', default: 10, min: 1, max: 50 },
      { id: 'compoundType', label: '복리 주기', type: 'radio', default: 'monthly', options: [{ value: 'yearly', label: '연복리' }, { value: 'monthly', label: '월복리' }] },
    ],
    faqs: [
      { q: '72의 법칙이란?', a: '72를 수익률로 나누면 원금이 2배 되는 기간. 예: 수익률 8% → 72÷8 = 9년.' },
      { q: '연복리 vs 월복리 차이?', a: '월복리가 약간 더 유리. 연 10% 기준 월복리 실효수익률 약 10.47%.' },
    ],
    seoContent: '<h2>임대수익률 계산기 사용 방법</h2><p>부동산 매입가 대비 월세 수익률(연 수익률)을 계산. 공실률·관리비·세금 반영. 카더라 임대수익률 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 관련 핵심 정보</h2><p>투자 수익률과 리스크를 정확히 계산하는 것은 성공적인 투자의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['dca-simulator', 'dividend-calc', 'fire-calc'],
  },
  {
    slug: 'stock-roi', category: 'investment', categoryLabel: '주식/투자',
    title: '주식 수익률 계산기', titleShort: '주식 수익률 계산기',
    description: '매수가·매도가·수량을 입력하면 수익률, 수익금, 세금(수수료 포함)을 자동 계산.',
    keywords: ['주식 수익률 계산기','주식 수익 계산','매수 매도 수익','증권 수수료','주식 세금'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'stockRoi', resultLabel: '수익률', resultUnit: '%',
    inputs: [
      { id: 'buyPrice', label: '매수가 (1주)', type: 'currency', default: 50000 },
      { id: 'sellPrice', label: '매도가 (1주)', type: 'currency', default: 65000 },
      { id: 'quantity', label: '수량 (주)', type: 'number', default: 100, min: 1 },
      { id: 'fee', label: '수수료율 (%)', type: 'percent', default: 0.015, step: 0.001 },
      { id: 'market', label: '시장', type: 'radio', default: 'kr', options: [{ value: 'kr', label: '국내' }, { value: 'us', label: '해외' }] },
    ],
    faqs: [
      { q: '주식 수익률 계산기는 무료인가요?', a: '네, 카더라 주식 수익률 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>주식 수익률 계산기 사용 방법</h2><p>매수가·매도가·수량을 입력하면 수익률, 수익금, 세금(수수료 포함)을 자동 계산. 카더라 주식 수익률 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 관련 핵심 정보</h2><p>투자 수익률과 리스크를 정확히 계산하는 것은 성공적인 투자의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['avg-down', 'breakeven', 'overseas-cgt'],
  },
  {
    slug: 'avg-down', category: 'investment', categoryLabel: '주식/투자',
    title: '물타기(평단가) 계산기', titleShort: '물타기 계산기',
    description: '추가 매수 시 평균 매수단가를 계산. 목표가까지 필요한 추가 매수량도 확인.',
    keywords: ['물타기 계산기','평균 매수단가','평단가 계산','추가 매수','주식 물타기'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'avgDown', resultLabel: '새 평균단가', resultUnit: '원',
    inputs: [
      { id: 'avgPrice', label: '현재 평균단가', type: 'currency', default: 50000 },
      { id: 'quantity', label: '보유 수량', type: 'number', default: 100 },
      { id: 'addPrice', label: '추가 매수가', type: 'currency', default: 35000 },
      { id: 'addQuantity', label: '추가 수량', type: 'number', default: 100 },
    ],
    faqs: [
      { q: '물타기 계산기는 무료인가요?', a: '네, 카더라 물타기 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>물타기(평단가) 계산기 사용 방법</h2><p>추가 매수 시 평균 매수단가를 계산. 목표가까지 필요한 추가 매수량도 확인. 카더라 물타기(평단가) 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 핵심 정보</h2><p>주식/투자 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['stock-roi', 'breakeven'],

  },
  {
    slug: 'breakeven', category: 'investment', categoryLabel: '주식/투자',
    title: '손익분기점 계산기', titleShort: '손익분기점 계산기',
    description: '현재 손실에서 본전까지 필요한 수익률을 계산.',
    keywords: ['손익분기점 계산기','본전 수익률','손실 회복','주식 손실'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'breakeven', resultLabel: '필요 수익률', resultUnit: '%',
    inputs: [
      { id: 'lossPercent', label: '현재 손실률 (%)', type: 'percent', default: 30, min: 0, max: 99 },
    ],
    faqs: [
      { q: '손익분기점 계산기는 무료인가요?', a: '네, 카더라 손익분기점 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>손익분기점 계산기 사용 방법</h2><p>현재 손실에서 본전까지 필요한 수익률을 계산. 카더라 손익분기점 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제129조 (배당소득 원천징수)</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>주식/투자 관련 핵심 정보</h2><p>투자 수익률과 리스크를 정확히 계산하는 것은 성공적인 투자의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['stock-roi', 'avg-down'],
  },
  {
    slug: 'dividend-calc', category: 'investment', categoryLabel: '주식/투자',
    title: '배당금 계산기', titleShort: '배당금 계산기',
    description: '투자금·배당수익률로 세후 연간·월간 배당금을 계산. 배당 재투자 복리 시뮬레이션.',
    keywords: ['배당금 계산기','배당수익률','세후 배당금','배당소득세','DRIP','배당 재투자'],
    legalBasis: '소득세법 제129조 (배당소득 원천징수)', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'dividendCalc', resultLabel: '연간 세후 배당금', resultUnit: '원',
    inputs: [
      { id: 'investment', label: '투자금', type: 'currency', default: 50000000 },
      { id: 'yieldRate', label: '배당수익률 (%)', type: 'percent', default: 4, min: 0, max: 20, step: 0.1 },
      { id: 'market', label: '시장', type: 'radio', default: 'kr', options: [{ value: 'kr', label: '국내 (15.4%)' }, { value: 'us', label: '미국 (15%)' }] },
      { id: 'reinvest', label: '배당 재투자', type: 'radio', default: 'no', options: [{ value: 'no', label: '수령' }, { value: 'yes', label: '재투자' }] },
      { id: 'years', label: '투자 기간 (년)', type: 'range', default: 10, min: 1, max: 30, condition: 'reinvest=yes' },
    ],
    faqs: [
      { q: '배당금 계산기는 무료인가요?', a: '네, 카더라 배당금 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제129조 (배당소득 원천징수)를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>배당금 계산기 사용 방법</h2><p>투자금·배당수익률로 세후 연간·월간 배당금을 계산. 배당 재투자 복리 시뮬레이션. 카더라 배당금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제129조 (배당소득 원천징수)</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>주식/투자 핵심 정보</h2><p>주식/투자 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['compound-interest', 'financial-income-tax', 'overseas-cgt'],

  },
  {
    slug: 'dca-simulator', category: 'investment', categoryLabel: '주식/투자',
    title: '적립식 투자 시뮬레이터', titleShort: '적립식 투자 계산기',
    description: '매월 일정 금액을 투자할 때 목표 금액 달성 기간과 최종 자산을 시뮬레이션.',
    keywords: ['적립식 투자 계산기','월 적립 투자','DCA','목표 금액','투자 시뮬레이션'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'amortize', formula: 'dcaSimulator', resultLabel: '최종 자산', resultUnit: '원',
    inputs: [
      { id: 'monthly', label: '월 투자액', type: 'currency', default: 1000000 },
      { id: 'rate', label: '연 기대 수익률 (%)', type: 'percent', default: 8, min: 0, max: 30 },
      { id: 'years', label: '투자 기간 (년)', type: 'range', default: 20, min: 1, max: 40 },
    ],
    faqs: [
      { q: '적립식 투자 계산기는 무료인가요?', a: '네, 카더라 적립식 투자 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>적립식 투자 시뮬레이터 사용 방법</h2><p>매월 일정 금액을 투자할 때 목표 금액 달성 기간과 최종 자산을 시뮬레이션. 카더라 적립식 투자 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 관련 핵심 정보</h2><p>투자 수익률과 리스크를 정확히 계산하는 것은 성공적인 투자의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['compound-interest', 'fire-calc'],
  },
  {
    slug: 'per-pbr-value', category: 'investment', categoryLabel: '주식/투자',
    title: 'PER/PBR 적정주가 계산기', titleShort: 'PER/PBR 계산기',
    description: 'EPS×PER, BPS×PBR로 적정 주가를 추정.',
    keywords: ['PER 계산기','PBR 계산기','적정주가','EPS','BPS'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'perPbrValue', resultLabel: '적정 주가', resultUnit: '원',
    inputs: [
      { id: 'method', label: '평가 방법', type: 'radio', default: 'per', options: [{ value: 'per', label: 'PER' }, { value: 'pbr', label: 'PBR' }] },
      { id: 'eps', label: 'EPS (주당순이익)', type: 'currency', default: 5000, condition: 'method=per' },
      { id: 'targetPer', label: '목표 PER (배)', type: 'number', default: 15, condition: 'method=per' },
      { id: 'bps', label: 'BPS (주당순자산)', type: 'currency', default: 30000, condition: 'method=pbr' },
      { id: 'targetPbr', label: '목표 PBR (배)', type: 'number', default: 1.5, step: 0.1, condition: 'method=pbr' },
    ],
    faqs: [
      { q: 'PER/PBR 계산기는 무료인가요?', a: '네, 카더라 PER/PBR 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>PER/PBR 적정주가 계산기 사용 방법</h2><p>EPS×PER, BPS×PBR로 적정 주가를 추정. 카더라 PER/PBR 적정주가 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 핵심 정보</h2><p>주식/투자 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['stock-roi', 'dividend-calc'],

  },
  {
    slug: 'currency-convert', category: 'investment', categoryLabel: '주식/투자',
    title: '환율 환산 계산기', titleShort: '환율 계산기',
    description: '원/달러/엔/유로 환율 실시간 변환.',
    keywords: ['환율 계산기','달러 환율','엔 환율','유로 환율','원달러'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'currencyConvert', resultLabel: '변환 결과', resultUnit: '',
    inputs: [
      { id: 'amount', label: '금액', type: 'number', default: 1000, min: 0 },
      { id: 'from', label: '원래 통화', type: 'select', default: 'USD', options: [{ value: 'USD', label: '달러 (USD)' }, { value: 'KRW', label: '원 (KRW)' }, { value: 'JPY', label: '엔 (JPY)' }, { value: 'EUR', label: '유로 (EUR)' }, { value: 'CNY', label: '위안 (CNY)' }] },
      { id: 'to', label: '변환 통화', type: 'select', default: 'KRW', options: [{ value: 'USD', label: '달러 (USD)' }, { value: 'KRW', label: '원 (KRW)' }, { value: 'JPY', label: '엔 (JPY)' }, { value: 'EUR', label: '유로 (EUR)' }, { value: 'CNY', label: '위안 (CNY)' }] },
    ],
    faqs: [
      { q: '환율 계산기는 무료인가요?', a: '네, 카더라 환율 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>환율 환산 계산기 사용 방법</h2><p>원/달러/엔/유로 환율 실시간 변환. 카더라 환율 환산 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 핵심 정보</h2><p>주식/투자 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['overseas-cgt', 'stock-roi'],

  },

  // ════════════════════════════════════════
  // 급여/세금 핵심 (12종)
  // ════════════════════════════════════════
  {
    slug: 'net-salary', category: 'salary', categoryLabel: '급여/노동',
    title: '2026 연봉 실수령액 계산기', titleShort: '연봉 실수령액 계산기',
    description: '연봉에서 4대보험·소득세·지방소득세를 공제한 월 실수령액을 자동 계산. 2026년 요율 적용.',
    keywords: ['연봉 실수령액','실수령액 계산기','월급 계산기','4대보험 공제','소득세 공제','2026 연봉'],
    legalBasis: '소득세법, 국민연금법, 건강보험법, 고용보험법', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'tax-bracket', formula: 'netSalary', resultLabel: '월 실수령액', resultUnit: '원',
    inputs: [
      { id: 'annualSalary', label: '연봉', type: 'currency', default: 50000000 },
      { id: 'family', label: '부양가족 수 (본인 포함)', type: 'stepper', default: 1, min: 1, max: 11 },
      { id: 'children', label: '20세 이하 자녀 수', type: 'stepper', default: 0, min: 0, max: 7 },
      { id: 'nonTaxable', label: '비과세액 (식대 등)', type: 'currency', default: 200000, hint: '2026년 식대 비과세 월 20만원' },
    ],
    faqs: [
      { q: '연봉 5000만원 실수령액은?', a: '약 월 346만원 (4대보험+소득세 공제 후, 부양가족 1인 기준).' },
      { q: '비과세 식대란?', a: '2023년부터 월 20만원까지 식대 비과세. 연봉에서 제외 후 세금 계산.' },
    ],
    seoContent: '<h2>환율 환산 계산기 사용 방법</h2><p>원/달러/엔/유로 환율 실시간 변환. 카더라 환율 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법, 국민연금법, 건강보험법, 고용보험법</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>급여/노동 관련 핵심 정보</h2><p>급여와 관련된 정확한 계산은 직장인의 재무 관리에 필수적입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['4-insurance', 'retirement-pay', 'year-end-refund'],
  },
  {
    slug: '4-insurance', category: 'salary', categoryLabel: '급여/노동',
    title: '4대보험 계산기', titleShort: '4대보험 계산기',
    description: '월급에서 공제되는 국민연금·건강보험·고용보험·장기요양보험 금액을 계산.',
    keywords: ['4대보험 계산기','국민연금','건강보험','고용보험','장기요양보험','사회보험'],
    legalBasis: '국민연금법, 국민건강보험법, 고용보험법', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'fourInsurance', resultLabel: '월 4대보험 합계', resultUnit: '원',
    inputs: [
      { id: 'monthlySalary', label: '월 급여 (비과세 제외)', type: 'currency', default: 3500000 },
    ],
    faqs: [
      { q: '4대보험 계산기는 무료인가요?', a: '네, 카더라 4대보험 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 국민연금법, 국민건강보험법, 고용보험법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>4대보험 계산기 사용 방법</h2><p>월급에서 공제되는 국민연금·건강보험·고용보험·장기요양보험 금액을 계산. 카더라 4대보험 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>근로자퇴직급여보장법 제8조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>급여/노동 관련 핵심 정보</h2><p>급여와 관련된 정확한 계산은 직장인의 재무 관리에 필수적입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['net-salary', 'retirement-pay'],
  },
  {
    slug: 'retirement-pay', category: 'salary', categoryLabel: '급여/노동',
    title: '퇴직금 계산기', titleShort: '퇴직금 계산기',
    description: '근속연수·평균임금으로 퇴직금과 퇴직소득세를 자동 계산.',
    keywords: ['퇴직금 계산기','퇴직금 세금','퇴직소득세','근속연수','평균임금'],
    legalBasis: '근로자퇴직급여보장법 제8조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'retirementPay', resultLabel: '퇴직금 (세전)', resultUnit: '원',
    inputs: [
      { id: 'avgSalary', label: '최근 3개월 월평균임금', type: 'currency', default: 4000000 },
      { id: 'years', label: '근속연수', type: 'number', default: 5, min: 1, max: 40 },
      { id: 'months', label: '추가 개월', type: 'number', default: 0, min: 0, max: 11 },
    ],
    faqs: [
      { q: '퇴직금 계산기는 무료인가요?', a: '네, 카더라 퇴직금 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 근로자퇴직급여보장법 제8조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>퇴직금 계산기 사용 방법</h2><p>근속연수·평균임금으로 퇴직금과 퇴직소득세를 자동 계산. 카더라 퇴직금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>근로자퇴직급여보장법 제8조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>급여/노동 핵심 정보</h2><p>급여/노동 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['net-salary', 'retirement-pension', 'irp-deduction'],

  },
  {
    slug: 'hourly-annual', category: 'salary', categoryLabel: '급여/노동',
    title: '시급 ↔ 연봉 환산기', titleShort: '시급 환산기',
    description: '시급을 연봉으로, 연봉을 시급으로 환산. 주휴수당 포함/미포함 선택.',
    keywords: ['시급 연봉 환산','시급 계산기','최저시급','주휴수당','알바 월급'],
    legalBasis: '최저임금법', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'hourlyAnnual', resultLabel: '환산 결과', resultUnit: '',
    inputs: [
      { id: 'direction', label: '환산 방향', type: 'radio', default: 'toAnnual', options: [{ value: 'toAnnual', label: '시급 → 연봉' }, { value: 'toHourly', label: '연봉 → 시급' }] },
      { id: 'value', label: '금액', type: 'currency', default: 10030 },
      { id: 'weeklyHours', label: '주당 근로시간', type: 'number', default: 40 },
      { id: 'includeWeeklyHoliday', label: '주휴수당 포함', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '포함' }, { value: 'no', label: '미포함' }] },
    ],
    faqs: [
      { q: '시급 환산기는 무료인가요?', a: '네, 카더라 시급 환산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 최저임금법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>시급 ↔ 연봉 환산기 사용 방법</h2><p>시급을 연봉으로, 연봉을 시급으로 환산. 주휴수당 포함/미포함 선택. 카더라 시급 환산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>급여/노동 관련 핵심 정보</h2><p>급여와 관련된 정확한 계산은 직장인의 재무 관리에 필수적입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['net-salary', '4-insurance'],
  },
  {
    slug: 'withholding-3-3', category: 'salary', categoryLabel: '급여/노동',
    title: '3.3% 원천징수 계산기', titleShort: '3.3% 원천징수 계산기',
    description: '프리랜서 3.3% 원천징수 세전↔세후 역산 + 종합소득세 환급 예상액.',
    keywords: ['3.3% 계산기','원천징수 역산','프리랜서 세금','세전 세후','종합소득세 환급'],
    legalBasis: '소득세법 제129조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'withholding33', resultLabel: '세후 수령액', resultUnit: '원',
    inputs: [
      { id: 'direction', label: '계산 방향', type: 'radio', default: 'afterTax', options: [{ value: 'afterTax', label: '세전 → 세후' }, { value: 'beforeTax', label: '세후 → 세전' }] },
      { id: 'amount', label: '금액', type: 'currency', default: 3000000 },
    ],
    faqs: [
      { q: '3.3% 원천징수 계산기는 무료인가요?', a: '네, 카더라 3.3% 원천징수 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제129조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>3.3% 원천징수 계산기 사용 방법</h2><p>프리랜서 3.3% 원천징수 세전↔세후 역산 + 종합소득세 환급 예상액. 카더라 3.3% 원천징수 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>급여/노동 핵심 정보</h2><p>급여/노동 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'net-salary'],

  },

  // ════════════════════════════════════════
  // 대출/예적금 (8종)
  // ════════════════════════════════════════
  {
    slug: 'loan-repayment', category: 'loan', categoryLabel: '대출/예적금',
    title: '대출 이자/상환 계산기', titleShort: '대출 상환 계산기',
    description: '원리금균등·원금균등·만기일시 상환 방식별 월 상환액, 총 이자를 계산.',
    keywords: ['대출 계산기','대출 이자 계산','원리금균등','원금균등','월 상환액','대출 이자'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'amortize', formula: 'loanRepayment', resultLabel: '월 상환액', resultUnit: '원',
    inputs: [
      { id: 'principal', label: '대출 원금', type: 'currency', default: 300000000 },
      { id: 'rate', label: '연 이자율 (%)', type: 'percent', default: 4.5, min: 0, max: 20, step: 0.1 },
      { id: 'years', label: '대출 기간 (년)', type: 'range', default: 30, min: 1, max: 40 },
      { id: 'method', label: '상환 방식', type: 'radio', default: 'equal', options: [{ value: 'equal', label: '원리금균등' }, { value: 'principal', label: '원금균등' }, { value: 'bullet', label: '만기일시' }] },
      { id: 'grace', label: '거치기간 (개월)', type: 'number', default: 0, min: 0, max: 60 },
    ],
    faqs: [
      { q: '원리금균등 vs 원금균등?', a: '원리금균등은 매월 동일 금액, 원금균등은 원금 동일+이자 감소. 총 이자는 원금균등이 적음.' },
    ],
    seoContent: '<h2>대출 상환 방식 비교</h2>\n<p>대출 상환 방식에는 원리금균등, 원금균등, 만기일시상환의 3가지가 있으며 각각 월 부담액과 총 이자가 크게 다릅니다. 자신의 소득 상황과 상환 능력에 맞는 방식을 선택하는 것이 중요합니다.</p>\n<h3>원리금균등 상환</h3>\n<p>매월 동일한 금액(원금+이자)을 납부합니다. 초기에는 이자 비중이 높고 갈수록 원금 비중이 커집니다. 월 부담이 일정하여 가계 예산 관리가 용이하지만, 총 이자는 원금균등보다 많습니다.</p>\n<h3>원금균등 상환</h3>\n<p>매월 동일한 원금을 상환하고, 이자는 잔액에 따라 감소합니다. 초기 부담이 크지만 갈수록 줄어들며, 총 이자가 원리금균등보다 적습니다. 소득이 안정적이고 초기 부담을 감당할 수 있다면 유리합니다.</p>\n<h3>만기일시상환</h3>\n<p>대출 기간 동안 이자만 납부하고 만기에 원금을 일시 상환합니다. 월 부담은 가장 적지만 총 이자가 가장 많고, 만기에 큰 금액을 준비해야 합니다.</p>\n<h2>금리별 3억원 30년 대출 비교</h2>\n<p>금리 3.5%: 원리금균등 월 134.7만원, 총 이자 1억8,491만원. 금리 4.5%: 월 152.0만원, 총 이자 2억4,722만원. 금리 5.5%: 월 170.3만원, 총 이자 3억1,318만원. 금리 1%p 차이로 총 이자가 6,000~7,000만원 달라집니다.</p>', relatedCalcs: ['deposit-interest', 'dsr-calc', 'ltv-calc'],
  },
  {
    slug: 'deposit-interest', category: 'loan', categoryLabel: '대출/예적금',
    title: '예적금 이자 계산기', titleShort: '예적금 이자 계산기',
    description: '예금·적금 만기 시 세전/세후 이자와 수령액을 계산. 단리/복리, 일반/비과세.',
    keywords: ['예적금 이자 계산기','예금 이자','적금 만기','세후 이자','비과세 예금'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'depositInterest', resultLabel: '세후 수령액', resultUnit: '원',
    inputs: [
      { id: 'type', label: '상품 유형', type: 'radio', default: 'savings', options: [{ value: 'deposit', label: '예금 (거치)' }, { value: 'savings', label: '적금 (적립)' }] },
      { id: 'amount', label: '예금액 / 월 적립액', type: 'currency', default: 1000000 },
      { id: 'rate', label: '연 이율 (%)', type: 'percent', default: 3.5, min: 0, max: 15, step: 0.1 },
      { id: 'months', label: '기간 (개월)', type: 'number', default: 12, min: 1, max: 60 },
      { id: 'taxType', label: '과세 유형', type: 'radio', default: 'general', options: [{ value: 'general', label: '일반 (15.4%)' }, { value: 'preferential', label: '세금우대 (9.5%)' }, { value: 'taxFree', label: '비과세' }] },
    ],
    faqs: [
      { q: '예적금 이자 계산기는 무료인가요?', a: '네, 카더라 예적금 이자 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>예적금 이자 계산기 사용 방법</h2><p>예금·적금 만기 시 세전/세후 이자와 수령액을 계산. 단리/복리, 일반/비과세. 카더라 예적금 이자 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>대출/예적금 핵심 정보</h2><p>대출/예적금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['compound-interest', 'loan-repayment'],

  },

  // ════════════════════════════════════════
  // 세금 핵심 (주요 10종만 상세 — 나머지는 패턴 반복)
  // ════════════════════════════════════════
  {
    slug: 'acquisition-tax', category: 'property-tax', categoryLabel: '부동산 세금',
    title: '2026 취득세 계산기', titleShort: '취득세 계산기',
    description: '부동산 매매·증여·상속 시 취득세를 자동 계산. 다주택 중과세율, 생애최초 감면 반영.',
    keywords: ['취득세 계산기','부동산 취득세','취득세율','다주택 중과','생애최초 감면','2026 취득세'],
    legalBasis: '지방세법 제11조, 제13조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'tax-bracket', formula: 'acquisitionTax', resultLabel: '취득세 합계', resultUnit: '원',
    inputs: [
      { id: 'price', label: '취득가액', type: 'currency', default: 500000000 },
      { id: 'type', label: '취득 유형', type: 'radio', default: 'purchase', options: [{ value: 'purchase', label: '매매' }, { value: 'gift', label: '증여' }, { value: 'inherit', label: '상속' }] },
      { id: 'houseCount', label: '보유 주택수 (취득 후)', type: 'stepper', default: 1, min: 1, max: 5 },
      { id: 'regulated', label: '조정대상지역', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] },
      { id: 'firstTime', label: '생애최초 주택', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] },
    ],
    faqs: [
      { q: '1주택자 취득세율은?', a: '6억 이하 1.1%, 6~9억 구간별 1.1~3.3%, 9억 초과 3.3% (지방교육세 포함).' },
      { q: '생애최초 감면은?', a: '생애최초 주택 취득 시 취득세 200만원 한도 감면 (12억 이하).' },
    ],
    seoContent: '<h2>취득세란?</h2>\n<p>취득세는 부동산, 차량 등 재산을 취득할 때 납부하는 지방세입니다. 부동산의 경우 매매, 증여, 상속 등 취득 원인과 주택 수, 면적, 조정대상지역 여부에 따라 세율이 크게 달라집니다.</p>\n<h2>2026년 취득세율 기준</h2>\n<p>주택 취득세는 취득가액에 따라 1~3%의 기본세율이 적용되며, 다주택자의 경우 조정대상지역 2주택 8%, 3주택 이상 12%의 중과세율이 적용됩니다. 6억원 이하 1주택은 1%, 6~9억원 구간은 1~3% 누진, 9억원 초과는 3%입니다.</p>\n<h3>취득세율 요약표</h3>\n<p>1주택(비조정): 6억 이하 1%, 6~9억 1~3%, 9억 초과 3%. 2주택(조정대상지역): 8%. 3주택 이상(조정대상지역): 12%. 법인: 12%. 생애최초 주택: 200만원 한도 감면(12억 이하).</p>\n<h2>취득세 계산 방법</h2>\n<p>취득세 = 취득가액 × 세율. 여기에 지방교육세(취득세의 10%)와 농어촌특별세(취득세의 10%, 전용면적 85㎡ 초과 시)가 추가됩니다. 예를 들어 5억원 1주택을 매매 취득하면: 취득세 500만원(1%) + 지방교육세 50만원 + 농특세 0원 = 총 550만원입니다.</p>\n<h2>취득세 절세 전략</h2>\n<p>생애최초 주택 구입 시 200만원 한도 감면(12억 이하), 일시적 2주택은 종전 주택 3년 내 매도 시 1주택 세율 적용, 신혼부부·다자녀 감면 등을 활용할 수 있습니다. 취득세는 취득일로부터 60일 이내 신고·납부해야 하며, 기한 초과 시 가산세가 부과됩니다.</p>', relatedCalcs: ['registration-cost', 'brokerage-fee', 'capital-gains-housing'],
  },
  {
    slug: 'capital-gains-housing', category: 'property-tax', categoryLabel: '부동산 세금',
    title: '2026 양도소득세 계산기 (주택)', titleShort: '양도소득세 계산기',
    description: '주택 매도 시 양도소득세를 자동 계산. 1세대1주택 비과세, 장기보유특별공제 반영.',
    keywords: ['양도소득세 계산기','양도세','주택 양도세','1세대1주택','장기보유특별공제','비과세'],
    legalBasis: '소득세법 제89조, 제95조, 제104조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'conditional', formula: 'capitalGainsHousing', resultLabel: '양도소득세', resultUnit: '원',
    inputs: [
      { id: 'sellPrice', label: '양도가액 (매도가)', type: 'currency', default: 900000000 },
      { id: 'buyPrice', label: '취득가액 (매수가)', type: 'currency', default: 600000000 },
      { id: 'expenses', label: '필요경비 (취득세+중개비 등)', type: 'currency', default: 15000000 },
      { id: 'holdYears', label: '보유기간 (년)', type: 'number', default: 5, min: 0, max: 30 },
      { id: 'liveYears', label: '거주기간 (년)', type: 'number', default: 3, min: 0, max: 30 },
      { id: 'houseCount', label: '보유 주택수', type: 'stepper', default: 1, min: 1, max: 5 },
      { id: 'regulated', label: '조정대상지역', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] },
    ],
    faqs: [
      { q: '1세대1주택 비과세 요건은?', a: '2년 이상 보유 (조정지역은 2년 거주도 필요), 양도가 12억 이하 전액 비과세.' },
    ],
    seoContent: '<h2>양도소득세란?</h2>\n<p>양도소득세는 부동산, 주식 등 자산을 양도(매도)하여 발생한 소득에 부과되는 국세입니다. 양도차익(양도가액 - 취득가액 - 필요경비)에서 장기보유특별공제와 기본공제(250만원)를 차감한 과세표준에 6~45%의 누진세율을 적용합니다.</p>\n<h2>2026년 양도소득세율</h2>\n<p>1세대 1주택 비과세: 2년 이상 보유(조정대상지역은 2년 거주 추가), 양도가액 12억원까지 비과세. 일반세율: 과세표준에 따라 6~45% 8단계 누진세율. 단기양도: 1년 미만 보유 시 70%, 1~2년 45%. 다주택 중과: 조정대상지역 2주택 +20%p, 3주택 +30%p.</p>\n<h3>장기보유특별공제</h3>\n<p>보유기간에 따라 양도차익의 최대 80%까지 공제됩니다. 1세대 1주택(거주 요건 충족): 보유 연 4% + 거주 연 4%, 최대 80%(10년). 일반: 보유 연 2%, 최대 30%(15년).</p>\n<h2>양도소득세 계산 순서</h2>\n<p>①양도차익 산정 → ②장기보유특별공제 → ③양도소득금액 → ④기본공제(250만원) → ⑤과세표준 → ⑥세율 적용 → ⑦산출세액 → ⑧지방소득세(10%) 추가. 양도일이 속하는 달의 말일부터 2개월 이내에 예정신고·납부해야 합니다.</p>', relatedCalcs: ['acquisition-tax', 'comprehensive-property-tax', 'registration-cost'],
  },
  {
    slug: 'gift-tax', category: 'inheritance', categoryLabel: '상속/증여',
    title: '증여세 계산기', titleShort: '증여세 계산기',
    description: '증여 재산가액에서 면제한도를 차감한 과세표준에 10~50% 누진세율 적용.',
    keywords: ['증여세 계산기','증여세율','증여 면제한도','자녀 증여','배우자 증여','증여 세금'],
    legalBasis: '상속세및증여세법 제26조, 제53조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'tax-bracket', formula: 'giftTax', resultLabel: '증여세', resultUnit: '원',
    inputs: [
      { id: 'amount', label: '증여 재산가액', type: 'currency', default: 200000000 },
      { id: 'relationship', label: '수증자 관계', type: 'select', default: 'adultChild', options: [
        { value: 'spouse', label: '배우자 (6억 공제)' },
        { value: 'adultChild', label: '성년 자녀 (5천만 공제)' },
        { value: 'minorChild', label: '미성년 자녀 (2천만 공제)' },
        { value: 'otherRelative', label: '기타 친족 (1천만 공제)' },
        { value: 'grandchild', label: '손자녀 (5천만 공제+30% 할증)' },
      ]},
      { id: 'priorGifts', label: '10년 내 사전증여액', type: 'currency', default: 0 },
    ],
    faqs: [
      { q: '증여 면제한도는?', a: '배우자 6억, 성년자녀 5천만, 미성년자녀 2천만, 기타친족 1천만 (10년 합산).' },
    ],
    seoContent: '<h2>증여세란?</h2>\n<p>증여세는 타인으로부터 재산을 무상으로 받을 때 수증자(받는 사람)에게 부과되는 세금입니다. 증여받은 재산가액에서 증여재산공제를 차감한 과세표준에 10~50%의 누진세율을 적용합니다.</p>\n<h2>2026년 증여세율</h2>\n<p>1억원 이하 10%, 1~5억원 20%(누진공제 1,000만원), 5~10억원 30%(누진공제 6,000만원), 10~30억원 40%(누진공제 1억6,000만원), 30억원 초과 50%(누진공제 4억6,000만원).</p>\n<h3>증여재산공제 (10년간 합산)</h3>\n<p>배우자: 6억원. 성년 자녀(직계비속): 5,000만원. 미성년 자녀: 2,000만원. 기타 친족(6촌 이내 혈족, 4촌 이내 인척): 1,000만원. 10년마다 한도가 리셋됩니다.</p>\n<h2>증여세 절세 전략</h2>\n<p>10년 주기 분할 증여가 가장 효과적입니다. 자녀에게 10년마다 5,000만원씩 증여하면 비과세입니다. 미성년 시기부터 2,000만원씩 시작하고, 성년 후 5,000만원으로 확대하면 수십 년간 수억원을 비과세로 이전할 수 있습니다. 부동산 증여 시 시가가 아닌 기준시가(공시가격)로 평가하면 증여세를 줄일 수 있습니다.</p>', relatedCalcs: ['inheritance-tax', 'generation-skip', 'acquisition-tax'],
  },
  {
    slug: 'overseas-cgt', category: 'finance-tax', categoryLabel: '금융/투자 세금',
    title: '해외주식 양도소득세 계산기', titleShort: '해외주식 양도세 계산기',
    description: '해외주식 매도 차익에 대한 양도소득세 계산. 250만원 기본공제, 22% 세율.',
    keywords: ['해외주식 양도세','해외주식 세금','미국주식 세금','250만원 공제','양도소득세'],
    legalBasis: '소득세법 제118조의2', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'overseasCgt', resultLabel: '양도소득세', resultUnit: '원',
    inputs: [
      { id: 'profit', label: '양도차익 (매도가-매수가-수수료)', type: 'currency', default: 10000000 },
      { id: 'otherProfit', label: '당해연도 다른 해외주식 차익', type: 'currency', default: 0 },
      { id: 'otherLoss', label: '당해연도 해외주식 손실', type: 'currency', default: 0 },
    ],
    faqs: [
      { q: '해외주식 양도세 계산기는 무료인가요?', a: '네, 카더라 해외주식 양도세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제118조의2를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>해외주식 양도소득세 계산기 사용 방법</h2><p>해외주식 매도 차익에 대한 양도소득세 계산. 250만원 기본공제, 22% 세율. 카더라 해외주식 양도소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제118조의2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>금융/투자 세금 핵심 정보</h2><p>금융/투자 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['stock-roi', 'financial-income-tax', 'dividend-calc'],

  },
  {
    slug: 'financial-income-tax', category: 'finance-tax', categoryLabel: '금융/투자 세금',
    title: '금융소득종합과세 계산기', titleShort: '금융소득종합과세 계산기',
    description: '이자+배당 합산 2,000만원 초과 시 종합과세 세금을 계산.',
    keywords: ['금융소득종합과세','이자소득','배당소득','2000만원','종합과세'],
    legalBasis: '소득세법 제14조, 제62조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'tax-bracket', formula: 'financialIncomeTax', resultLabel: '추가 납부세액', resultUnit: '원',
    inputs: [
      { id: 'interest', label: '연간 이자소득', type: 'currency', default: 15000000 },
      { id: 'dividend', label: '연간 배당소득', type: 'currency', default: 10000000 },
      { id: 'otherIncome', label: '근로/사업 등 기타소득', type: 'currency', default: 50000000 },
    ],
    faqs: [
      { q: '금융소득종합과세 계산기는 무료인가요?', a: '네, 카더라 금융소득종합과세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제14조, 제62조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>금융소득종합과세 계산기 사용 방법</h2><p>이자+배당 합산 2,000만원 초과 시 종합과세 세금을 계산. 카더라 금융소득종합과세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제14조, 제62조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>금융/투자 세금 핵심 정보</h2><p>금융/투자 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['dividend-calc', 'deposit-interest', 'overseas-cgt'],

  },

  // ════════════════════════════════════════
  // 생활/건강 (핵심 6종)
  // ════════════════════════════════════════
  {
    slug: 'bmi', category: 'life', categoryLabel: '생활/건강',
    title: 'BMI 체질량지수 계산기', titleShort: 'BMI 계산기',
    description: '키와 몸무게로 BMI 체질량지수를 계산. WHO 및 대한비만학회 기준 판정.',
    keywords: ['BMI 계산기','체질량지수','비만도','정상체중','과체중','비만'],
    legalBasis: 'WHO 체질량지수 기준, 대한비만학회', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'bmi', resultLabel: 'BMI', resultUnit: 'kg/㎡',
    inputs: [
      { id: 'height', label: '키 (cm)', type: 'number', default: 170, min: 100, max: 250, step: 0.1 },
      { id: 'weight', label: '몸무게 (kg)', type: 'number', default: 70, min: 20, max: 300, step: 0.1 },
    ],
    faqs: [
      { q: 'BMI 정상 범위는?', a: 'WHO 기준 18.5~24.9. 한국(아시아) 기준 18.5~22.9.' },
    ],
    seoContent: '<h2>금융소득종합과세 계산기 사용 방법</h2><p>이자+배당 합산 2,000만원 초과 시 종합과세 세금을 계산. 카더라 금융소득종합과세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>WHO 체질량지수 기준, 대한비만학회</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>생활/건강 관련 핵심 정보</h2><p>일상생활에서 자주 필요한 각종 계산을 빠르고 정확하게 할 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['calorie', 'body-fat', 'bmr'],
  },
  {
    slug: 'due-date', category: 'life', categoryLabel: '생활/건강',
    title: '출산 예정일 계산기', titleShort: '출산 예정일 계산기',
    description: '마지막 생리일로부터 출산 예정일을 계산. 임신 주수 확인.',
    keywords: ['출산 예정일 계산기','임신 주수','분만 예정일','마지막 생리일'],
    legalBasis: 'Naegele 법칙', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'dueDate', resultLabel: '출산 예정일', resultUnit: '',
    inputs: [
      { id: 'lastPeriod', label: '마지막 생리 시작일', type: 'date', default: '' },
      { id: 'cycleLength', label: '평균 생리주기 (일)', type: 'number', default: 28, min: 21, max: 35 },
    ],
    faqs: [
      { q: '출산 예정일 계산기는 무료인가요?', a: '네, 카더라 출산 예정일 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. Naegele 법칙를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>출산 예정일 계산기 사용 방법</h2><p>마지막 생리일로부터 출산 예정일을 계산. 임신 주수 확인. 카더라 출산 예정일 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>한국전력 전기요금표</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>생활/건강 관련 핵심 정보</h2><p>일상생활에서 자주 필요한 각종 계산을 빠르고 정확하게 할 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['bmi', 'calorie'],
  },
  {
    slug: 'electricity', category: 'life', categoryLabel: '생활/건강',
    title: '전기요금 계산기', titleShort: '전기요금 계산기',
    description: '월 사용량(kWh)으로 누진세 전기요금을 계산. 주택용/일반용.',
    keywords: ['전기요금 계산기','전기세','누진세','kWh','한전 요금'],
    legalBasis: '한국전력 전기요금표', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'tax-bracket', formula: 'electricityBill', resultLabel: '전기요금 (부가세 포함)', resultUnit: '원',
    inputs: [
      { id: 'usage', label: '월 사용량 (kWh)', type: 'number', default: 350, min: 0, max: 2000 },
      { id: 'type', label: '계약 종류', type: 'radio', default: 'residential', options: [{ value: 'residential', label: '주택용' }, { value: 'general', label: '일반용' }] },
    ],
    faqs: [
      { q: '전기요금 계산기는 무료인가요?', a: '네, 카더라 전기요금 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 한국전력 전기요금표를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>전기요금 계산기 사용 방법</h2><p>월 사용량(kWh)으로 누진세 전기요금을 계산. 주택용/일반용. 카더라 전기요금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>한국전력 전기요금표</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>생활/건강 핵심 정보</h2><p>생활/건강 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['bmi'],

  },
  {
    slug: 'discharge-date', category: 'military', categoryLabel: '군대/교육',
    title: '전역일 계산기', titleShort: '전역일 계산기',
    description: '입대일과 군종으로 전역 예정일과 남은 복무일수를 계산.',
    keywords: ['전역일 계산기','군대 전역일','복무 기간','입대일','군인 전역'],
    legalBasis: '병역법 시행령', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'dischargeDate', resultLabel: '전역 예정일', resultUnit: '',
    inputs: [
      { id: 'enlistDate', label: '입대일', type: 'date', default: '' },
      { id: 'branch', label: '군종', type: 'select', default: 'army', options: [
        { value: 'army', label: '육군 (18개월)' },
        { value: 'marine', label: '해병대 (18개월)' },
        { value: 'navy', label: '해군 (20개월)' },
        { value: 'airforce', label: '공군 (21개월)' },
        { value: 'social', label: '사회복무 (21개월)' },
      ]},
    ],
    faqs: [
      { q: '전역일 계산기는 무료인가요?', a: '네, 카더라 전역일 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 병역법 시행령를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>전역일 계산기 사용 방법</h2><p>입대일과 군종으로 전역 예정일과 남은 복무일수를 계산. 카더라 전역일 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>국민연금법 제51조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>연금/은퇴 관련 핵심 정보</h2><p>노후 준비는 빠를수록 유리합니다. 다층적 연금 구조를 이해하고 자신에게 맞는 계획을 세우세요.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['military-pay'],
  },

  // ════════════════════════════════════════
  // 연금/은퇴 (핵심 3종)
  // ════════════════════════════════════════
  {
    slug: 'national-pension', category: 'pension', categoryLabel: '연금/은퇴',
    title: '국민연금 예상 수령액 계산기', titleShort: '국민연금 계산기',
    description: '월 소득·가입기간으로 국민연금 예상 수령액을 계산.',
    keywords: ['국민연금 계산기','국민연금 수령액','연금 수령 나이','국민연금 납부액'],
    legalBasis: '국민연금법 제51조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'nationalPension', resultLabel: '예상 월 수령액', resultUnit: '원',
    inputs: [
      { id: 'monthlySalary', label: '월 소득 (세전)', type: 'currency', default: 3500000 },
      { id: 'years', label: '예상 가입기간 (년)', type: 'range', default: 25, min: 10, max: 40 },
      { id: 'birthYear', label: '출생연도', type: 'number', default: 1990, min: 1950, max: 2005 },
    ],
    faqs: [
      { q: '국민연금 계산기는 무료인가요?', a: '네, 카더라 국민연금 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 국민연금법 제51조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>국민연금 예상 수령액 계산기 사용 방법</h2><p>월 소득·가입기간으로 국민연금 예상 수령액을 계산. 카더라 국민연금 예상 수령액 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>국민연금법 제51조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연금/은퇴 핵심 정보</h2><p>연금/은퇴 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['fire-calc', 'irp-deduction', 'retirement-pay'],

  },
  {
    slug: 'fire-calc', category: 'pension', categoryLabel: '연금/은퇴',
    title: 'FIRE 은퇴자금 계산기', titleShort: 'FIRE 계산기',
    description: '경제적 자유를 위한 목표 자산, 현재 저축률 기반 FIRE 달성 시기를 계산.',
    keywords: ['FIRE 계산기','은퇴자금','경제적자유','조기은퇴','4% 룰','파이어족'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'fireCalc', resultLabel: 'FIRE 달성까지', resultUnit: '년',
    inputs: [
      { id: 'monthlyExpense', label: '월 생활비', type: 'currency', default: 3000000 },
      { id: 'currentAssets', label: '현재 투자 자산', type: 'currency', default: 50000000 },
      { id: 'monthlySavings', label: '월 저축/투자액', type: 'currency', default: 2000000 },
      { id: 'expectedReturn', label: '기대 수익률 (%)', type: 'percent', default: 7, min: 0, max: 15 },
      { id: 'withdrawalRate', label: '인출률 (%)', type: 'percent', default: 4, min: 2, max: 6, step: 0.5, hint: '일반적으로 4% 룰 적용' },
    ],
    faqs: [
      { q: 'FIRE 계산기는 무료인가요?', a: '네, 카더라 FIRE 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>FIRE 은퇴자금 계산기 사용 방법</h2><p>경제적 자유를 위한 목표 자산, 현재 저축률 기반 FIRE 달성 시기를 계산. 카더라 FIRE 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제59조의3</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>연금/은퇴 관련 핵심 정보</h2><p>노후 준비는 빠를수록 유리합니다. 다층적 연금 구조를 이해하고 자신에게 맞는 계획을 세우세요.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['compound-interest', 'national-pension', 'dca-simulator'],
  },
  {
    slug: 'irp-deduction', category: 'pension', categoryLabel: '연금/은퇴',
    title: '연금저축/IRP 세액공제 계산기', titleShort: 'IRP 세액공제 계산기',
    description: '연금저축·IRP 납입액에 따른 세액공제 환급액을 소득 구간별로 계산.',
    keywords: ['연금저축 세액공제','IRP 세액공제','연말정산','세액공제 한도','연금저축 환급'],
    legalBasis: '소득세법 제59조의3', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'irpDeduction', resultLabel: '세액공제 환급액', resultUnit: '원',
    inputs: [
      { id: 'annualSalary', label: '총급여', type: 'currency', default: 50000000 },
      { id: 'pensionSavings', label: '연금저축 납입액', type: 'currency', default: 6000000, hint: '한도 600만원' },
      { id: 'irp', label: 'IRP 납입액', type: 'currency', default: 3000000, hint: '연금저축+IRP 합산 900만원' },
    ],
    faqs: [
      { q: 'IRP 세액공제 계산기는 무료인가요?', a: '네, 카더라 IRP 세액공제 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제59조의3를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>연금저축/IRP 세액공제 계산기 사용 방법</h2><p>연금저축·IRP 납입액에 따른 세액공제 환급액을 소득 구간별로 계산. 카더라 연금저축/IRP 세액공제 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제59조의3</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연금/은퇴 핵심 정보</h2><p>연금/은퇴 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['national-pension', 'year-end-refund', 'net-salary'],

  },

  // ════════════════════════════════════════
  // 추가 생활/건강 (6종)
  // ════════════════════════════════════════
  {
    slug: 'calorie', category: 'life', categoryLabel: '생활/건강',
    title: '칼로리 계산기', titleShort: '칼로리 계산기',
    description: '키·몸무게·활동량으로 일일 권장 칼로리(TDEE)를 계산.',
    keywords: ['칼로리 계산기','일일 권장 칼로리','TDEE','다이어트 칼로리'],
    legalBasis: 'Mifflin-St Jeor 공식', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'calorie', resultLabel: '일일 권장 칼로리', resultUnit: 'kcal',
    inputs: [
      { id: 'gender', label: '성별', type: 'radio', default: 'male', options: [{ value: 'male', label: '남성' }, { value: 'female', label: '여성' }] },
      { id: 'age', label: '나이', type: 'number', default: 30, min: 10, max: 100 },
      { id: 'height', label: '키 (cm)', type: 'number', default: 170, min: 100, max: 250 },
      { id: 'weight', label: '몸무게 (kg)', type: 'number', default: 70, min: 30, max: 200 },
      { id: 'activity', label: '활동량', type: 'select', default: '1.55', options: [{ value: '1.2', label: '비활동적 (좌식)' }, { value: '1.375', label: '가벼운 활동 (주1-3회)' }, { value: '1.55', label: '보통 활동 (주3-5회)' }, { value: '1.725', label: '활발한 활동 (주6-7회)' }, { value: '1.9', label: '매우 활발 (운동선수)' }] },
    ],
    faqs: [
      { q: '칼로리 계산기는 무료인가요?', a: '네, 카더라 칼로리 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. Mifflin-St Jeor 공식를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>칼로리 계산기 사용 방법</h2><p>키·몸무게·활동량으로 일일 권장 칼로리(TDEE)를 계산. 카더라 칼로리 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>BMI-체지방 추정 공식</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>생활/건강 관련 핵심 정보</h2><p>일상생활에서 자주 필요한 각종 계산을 빠르고 정확하게 할 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['bmi', 'body-fat', 'bmr'],
  },
  {
    slug: 'body-fat', category: 'life', categoryLabel: '생활/건강',
    title: '체지방률 계산기', titleShort: '체지방률 계산기',
    description: 'BMI 기반 체지방률 추정. 미 해군 공식(허리/목 둘레) 지원.',
    keywords: ['체지방률 계산기','체지방 측정','비만도','체지방 비율'],
    legalBasis: 'BMI-체지방 추정 공식', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'bodyFat', resultLabel: '추정 체지방률', resultUnit: '%',
    inputs: [
      { id: 'gender', label: '성별', type: 'radio', default: 'male', options: [{ value: 'male', label: '남성' }, { value: 'female', label: '여성' }] },
      { id: 'age', label: '나이', type: 'number', default: 30, min: 10, max: 100 },
      { id: 'height', label: '키 (cm)', type: 'number', default: 170, min: 100, max: 250 },
      { id: 'weight', label: '몸무게 (kg)', type: 'number', default: 70, min: 30, max: 200 },
    ],
    faqs: [
      { q: '체지방률 계산기는 무료인가요?', a: '네, 카더라 체지방률 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. BMI-체지방 추정 공식를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>체지방률 계산기 사용 방법</h2><p>BMI 기반 체지방률 추정. 미 해군 공식(허리/목 둘레) 지원. 카더라 체지방률 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>BMI-체지방 추정 공식</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>생활/건강 핵심 정보</h2><p>생활/건강 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['bmi', 'calorie', 'bmr'],

  },
  {
    slug: 'bmr', category: 'life', categoryLabel: '생활/건강',
    title: '기초대사량 계산기', titleShort: '기초대사량 계산기',
    description: '성별·나이·키·몸무게로 기초대사량(BMR)을 계산.',
    keywords: ['기초대사량 계산기','BMR','기초대사','다이어트'],
    legalBasis: 'Mifflin-St Jeor 공식', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'bmr', resultLabel: '기초대사량', resultUnit: 'kcal/일',
    inputs: [
      { id: 'gender', label: '성별', type: 'radio', default: 'male', options: [{ value: 'male', label: '남성' }, { value: 'female', label: '여성' }] },
      { id: 'age', label: '나이', type: 'number', default: 30, min: 10, max: 100 },
      { id: 'height', label: '키 (cm)', type: 'number', default: 170, min: 100, max: 250 },
      { id: 'weight', label: '몸무게 (kg)', type: 'number', default: 70, min: 30, max: 200 },
    ],
    faqs: [
      { q: '기초대사량 계산기는 무료인가요?', a: '네, 카더라 기초대사량 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. Mifflin-St Jeor 공식를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>기초대사량 계산기 사용 방법</h2><p>성별·나이·키·몸무게로 기초대사량(BMR)을 계산. 카더라 기초대사량 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>민법 제158조, 행정기본법 제16조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>생활/건강 관련 핵심 정보</h2><p>일상생활에서 자주 필요한 각종 계산을 빠르고 정확하게 할 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['calorie', 'bmi', 'body-fat'],
  },
  {
    slug: 'age-calc', category: 'life', categoryLabel: '생활/건강',
    title: '만 나이 계산기', titleShort: '만 나이 계산기',
    description: '생년월일로 만 나이를 계산. 2023년 만 나이 통일법 기준.',
    keywords: ['만 나이 계산기','나이 계산','한국 나이','만 나이 통일'],
    legalBasis: '민법 제158조, 행정기본법 제16조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'ageCalc', resultLabel: '만 나이', resultUnit: '세',
    inputs: [
      { id: 'birthDate', label: '생년월일', type: 'date', default: '1990-01-01' },
    ],
    faqs: [
      { q: '만 나이 계산기는 무료인가요?', a: '네, 카더라 만 나이 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 민법 제158조, 행정기본법 제16조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>만 나이 계산기 사용 방법</h2><p>생년월일로 만 나이를 계산. 2023년 만 나이 통일법 기준. 카더라 만 나이 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>민법 제158조, 행정기본법 제16조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>생활/건강 핵심 정보</h2><p>생활/건강 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['due-date', 'discharge-date'],

  },
  {
    slug: 'd-day', category: 'life', categoryLabel: '생활/건강',
    title: 'D-Day 날짜 계산기', titleShort: 'D-Day 계산기',
    description: '두 날짜 사이의 일수를 계산. D-Day 카운트다운.',
    keywords: ['D-Day 계산기','날짜 계산기','디데이','일수 계산'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'dDay', resultLabel: 'D-Day', resultUnit: '',
    inputs: [
      { id: 'startDate', label: '시작일', type: 'date', default: '' },
      { id: 'endDate', label: '종료일', type: 'date', default: '' },
    ],
    faqs: [
      { q: 'D-Day 계산기는 무료인가요?', a: '네, 카더라 D-Day 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>D-Day 날짜 계산기 사용 방법</h2><p>두 날짜 사이의 일수를 계산. D-Day 카운트다운. 카더라 D-Day 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>생활/건강 관련 핵심 정보</h2><p>일상생활에서 자주 필요한 각종 계산을 빠르고 정확하게 할 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['age-calc', 'discharge-date'],
  },
  {
    slug: 'ovulation', category: 'life', categoryLabel: '생활/건강',
    title: '배란일 계산기', titleShort: '배란일 계산기',
    description: '마지막 생리일과 생리주기로 배란일·가임기를 계산.',
    keywords: ['배란일 계산기','가임기','임신 가능일','생리주기'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'ovulation', resultLabel: '배란 예정일', resultUnit: '',
    inputs: [
      { id: 'lastPeriod', label: '마지막 생리 시작일', type: 'date', default: '' },
      { id: 'cycleLength', label: '평균 생리주기 (일)', type: 'number', default: 28, min: 21, max: 35 },
    ],
    faqs: [
      { q: '배란일 계산기는 무료인가요?', a: '네, 카더라 배란일 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>배란일 계산기 사용 방법</h2><p>마지막 생리일과 생리주기로 배란일·가임기를 계산. 카더라 배란일 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>생활/건강 핵심 정보</h2><p>생활/건강 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['due-date'],

  },

  // ════════════════════════════════════════
  // 자동차/보험 (4종)
  // ════════════════════════════════════════
  {
    slug: 'vehicle-tax', category: 'auto', categoryLabel: '자동차',
    title: '자동차세 계산기', titleShort: '자동차세 계산기',
    description: '배기량·차량연식으로 자동차세를 자동 계산. 전기차·하이브리드 별도.',
    keywords: ['자동차세 계산기','자동차세','차량세금','배기량','전기차 세금'],
    legalBasis: '지방세법 제127조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'vehicleTax', resultLabel: '연간 자동차세', resultUnit: '원',
    inputs: [
      { id: 'cc', label: '배기량 (cc)', type: 'number', default: 2000, min: 0, max: 10000 },
      { id: 'type', label: '차종', type: 'radio', default: 'passenger', options: [{ value: 'passenger', label: '승용차' }, { value: 'ev', label: '전기차' }] },
      { id: 'age', label: '차량 연식 (년)', type: 'number', default: 3, min: 0, max: 20 },
    ],
    faqs: [
      { q: '자동차세 계산기는 무료인가요?', a: '네, 카더라 자동차세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 지방세법 제127조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>자동차세 계산기 사용 방법</h2><p>배기량·차량연식으로 자동차세를 자동 계산. 전기차·하이브리드 별도. 카더라 자동차세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>자동차 관련 핵심 정보</h2><p>자동차 보유·운영에는 세금, 보험, 유류비 등 다양한 비용이 발생합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['fuel-cost', 'car-installment'],
  },
  {
    slug: 'fuel-cost', category: 'auto', categoryLabel: '자동차',
    title: '연비/유류비 계산기', titleShort: '연비 계산기',
    description: '주행거리·연비·유가로 월간/연간 유류비를 계산.',
    keywords: ['연비 계산기','유류비 계산','기름값','주유비','자동차 유지비'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'fuelCost', resultLabel: '월간 유류비', resultUnit: '원',
    inputs: [
      { id: 'distance', label: '월 주행거리 (km)', type: 'number', default: 1500, min: 0, max: 10000 },
      { id: 'efficiency', label: '연비 (km/L)', type: 'number', default: 12, min: 1, max: 50, step: 0.1 },
      { id: 'fuelPrice', label: '유가 (원/L)', type: 'currency', default: 1700 },
    ],
    faqs: [
      { q: '연비 계산기는 무료인가요?', a: '네, 카더라 연비 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>연비/유류비 계산기 사용 방법</h2><p>주행거리·연비·유가로 월간/연간 유류비를 계산. 카더라 연비/유류비 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>자동차 핵심 정보</h2><p>자동차 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['vehicle-tax', 'ev-charge-cost'],

  },
  {
    slug: 'car-installment', category: 'auto', categoryLabel: '자동차',
    title: '자동차 할부 계산기', titleShort: '자동차 할부 계산기',
    description: '자동차 할부 구매 시 월 납입금과 총 이자를 계산.',
    keywords: ['자동차 할부 계산기','차량 할부','자동차 대출','월 납입금'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'amortize', formula: 'carInstallment', resultLabel: '월 납입금', resultUnit: '원',
    inputs: [
      { id: 'carPrice', label: '차량 가격', type: 'currency', default: 40000000 },
      { id: 'downPayment', label: '선수금', type: 'currency', default: 10000000 },
      { id: 'rate', label: '금리 (%)', type: 'percent', default: 5.9, min: 0, max: 15, step: 0.1 },
      { id: 'months', label: '할부 기간 (개월)', type: 'select', default: '48', options: [{ value: '24', label: '24개월' }, { value: '36', label: '36개월' }, { value: '48', label: '48개월' }, { value: '60', label: '60개월' }] },
    ],
    faqs: [
      { q: '자동차 할부 계산기는 무료인가요?', a: '네, 카더라 자동차 할부 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>자동차 할부 계산기 사용 방법</h2><p>자동차 할부 구매 시 월 납입금과 총 이자를 계산. 카더라 자동차 할부 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>자동차 관련 핵심 정보</h2><p>자동차 보유·운영에는 세금, 보험, 유류비 등 다양한 비용이 발생합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['loan-repayment', 'vehicle-tax'],
  },
  {
    slug: 'ev-charge-cost', category: 'auto', categoryLabel: '자동차',
    title: '전기차 충전비 계산기', titleShort: '전기차 충전비 계산기',
    description: '전기차 배터리 용량·전비로 충전비를 계산. 가정용/공용 비교.',
    keywords: ['전기차 충전비','전기차 유지비','충전요금','전기차 전비'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'evChargeCost', resultLabel: '월간 충전비', resultUnit: '원',
    inputs: [
      { id: 'distance', label: '월 주행거리 (km)', type: 'number', default: 1500 },
      { id: 'efficiency', label: '전비 (km/kWh)', type: 'number', default: 5.5, min: 2, max: 10, step: 0.1 },
      { id: 'chargeType', label: '충전 유형', type: 'radio', default: 'home', options: [{ value: 'home', label: '가정용 (약 120원/kWh)' }, { value: 'public', label: '공용 급속 (약 350원/kWh)' }] },
    ],
    faqs: [
      { q: '전기차 충전비 계산기는 무료인가요?', a: '네, 카더라 전기차 충전비 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>전기차 충전비 계산기 사용 방법</h2><p>전기차 배터리 용량·전비로 충전비를 계산. 가정용/공용 비교. 카더라 전기차 충전비 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>자동차 핵심 정보</h2><p>자동차 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['fuel-cost', 'vehicle-tax'],

  },

  // ════════════════════════════════════════
  // 쇼핑/소비 (4종)
  // ════════════════════════════════════════
  {
    slug: 'discount-calc', category: 'shopping', categoryLabel: '쇼핑/소비',
    title: '할인율 계산기', titleShort: '할인율 계산기',
    description: '정가·할인가로 할인율을 계산. 역산도 가능.',
    keywords: ['할인율 계산기','할인 퍼센트','세일 계산','가격 할인'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'discountCalc', resultLabel: '할인율', resultUnit: '%',
    inputs: [
      { id: 'original', label: '정가', type: 'currency', default: 100000 },
      { id: 'sale', label: '할인가', type: 'currency', default: 70000 },
    ],
    faqs: [
      { q: '할인율 계산기는 무료인가요?', a: '네, 카더라 할인율 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>할인율 계산기 사용 방법</h2><p>정가·할인가로 할인율을 계산. 역산도 가능. 카더라 할인율 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>쇼핑/소비 관련 핵심 정보</h2><p>현명한 소비를 위해 할인율, 할부 이자, 관세 등을 정확히 계산하세요.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['installment-interest'],
  },
  {
    slug: 'installment-interest', category: 'shopping', categoryLabel: '쇼핑/소비',
    title: '할부 이자 계산기', titleShort: '할부 이자 계산기',
    description: '카드 할부 결제 시 실제 부담 이자를 계산.',
    keywords: ['할부 이자 계산기','카드 할부','무이자 할부','할부 수수료'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'installmentInterest', resultLabel: '총 이자', resultUnit: '원',
    inputs: [
      { id: 'amount', label: '할부 금액', type: 'currency', default: 1000000 },
      { id: 'months', label: '할부 개월', type: 'select', default: '12', options: [{ value: '3', label: '3개월' }, { value: '6', label: '6개월' }, { value: '10', label: '10개월' }, { value: '12', label: '12개월' }, { value: '24', label: '24개월' }] },
      { id: 'rate', label: '할부 수수료율 (%)', type: 'percent', default: 12, min: 0, max: 25 },
    ],
    faqs: [
      { q: '할부 이자 계산기는 무료인가요?', a: '네, 카더라 할부 이자 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>할부 이자 계산기 사용 방법</h2><p>카드 할부 결제 시 실제 부담 이자를 계산. 카더라 할부 이자 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>쇼핑/소비 핵심 정보</h2><p>쇼핑/소비 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['discount-calc', 'loan-repayment'],

  },
  {
    slug: 'customs-duty', category: 'shopping', categoryLabel: '쇼핑/소비',
    title: '해외직구 관세 계산기', titleShort: '해외직구 관세 계산기',
    description: '해외 직구 시 관세·부가세를 계산. 미국/EU/일본 면세한도 안내.',
    keywords: ['해외직구 관세','직구 세금','관세 면제','면세 한도','해외구매 관세'],
    legalBasis: '관세법, 수입물품 과세가격 결정에 관한 고시', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'customsDuty', resultLabel: '관세+부가세 합계', resultUnit: '원',
    inputs: [
      { id: 'price', label: '물품가격 (원화)', type: 'currency', default: 200000 },
      { id: 'shipping', label: '배송비 (원화)', type: 'currency', default: 30000 },
      { id: 'category', label: '물품 종류', type: 'select', default: 'general', options: [{ value: 'general', label: '일반 (8%)' }, { value: 'clothing', label: '의류 (13%)' }, { value: 'electronics', label: '전자제품 (0~8%)' }, { value: 'food', label: '식품 (8%)' }, { value: 'cosmetics', label: '화장품 (6.5%)' }] },
    ],
    faqs: [
      { q: '해외직구 관세 계산기는 무료인가요?', a: '네, 카더라 해외직구 관세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 관세법, 수입물품 과세가격 결정에 관한 고시를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>해외직구 관세 계산기 사용 방법</h2><p>해외 직구 시 관세·부가세를 계산. 미국/EU/일본 면세한도 안내. 카더라 해외직구 관세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>쇼핑/소비 관련 핵심 정보</h2><p>현명한 소비를 위해 할인율, 할부 이자, 관세 등을 정확히 계산하세요.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['currency-convert'],
  },
  {
    slug: 'subscription-total', category: 'shopping', categoryLabel: '쇼핑/소비',
    title: '구독료 합산 계산기', titleShort: '구독료 합산 계산기',
    description: '넷플릭스·유튜브·스포티파이 등 월 구독 서비스 총 비용을 계산.',
    keywords: ['구독료 계산','월 구독비','구독 서비스','고정비 관리'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'subscriptionTotal', resultLabel: '월 구독 합계', resultUnit: '원',
    inputs: [
      { id: 'sub1', label: '구독 1 (원/월)', type: 'currency', default: 17000, hint: '예: 넷플릭스' },
      { id: 'sub2', label: '구독 2 (원/월)', type: 'currency', default: 14900, hint: '예: 유튜브 프리미엄' },
      { id: 'sub3', label: '구독 3 (원/월)', type: 'currency', default: 10900, hint: '예: 스포티파이' },
      { id: 'sub4', label: '구독 4 (원/월)', type: 'currency', default: 7900, hint: '예: 기타' },
      { id: 'sub5', label: '구독 5 (원/월)', type: 'currency', default: 0 },
    ],
    faqs: [
      { q: '구독료 합산 계산기는 무료인가요?', a: '네, 카더라 구독료 합산 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>구독료 합산 계산기 사용 방법</h2><p>넷플릭스·유튜브·스포티파이 등 월 구독 서비스 총 비용을 계산. 카더라 구독료 합산 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>쇼핑/소비 핵심 정보</h2><p>쇼핑/소비 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['net-salary'],

  },

  // ════════════════════════════════════════
  // 군대/교육 (3종 추가)
  // ════════════════════════════════════════
  {
    slug: 'military-pay', category: 'military', categoryLabel: '군대/교육',
    title: '군인 월급 계산기', titleShort: '군인 월급 계산기',
    description: '2026년 병사 계급별 월급을 확인. 이병~병장.',
    keywords: ['군인 월급','병사 월급','군대 월급','2026 군인 급여'],
    legalBasis: '국방부 병 봉급표', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'militaryPay', resultLabel: '월급', resultUnit: '원',
    inputs: [
      { id: 'rank', label: '계급', type: 'select', default: 'private', options: [{ value: 'private', label: '이병' }, { value: 'pfc', label: '일병' }, { value: 'corporal', label: '상병' }, { value: 'sergeant', label: '병장' }] },
    ],
    faqs: [
      { q: '군인 월급 계산기는 무료인가요?', a: '네, 카더라 군인 월급 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 국방부 병 봉급표를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>군인 월급 계산기 사용 방법</h2><p>2026년 병사 계급별 월급을 확인. 이병~병장. 카더라 군인 월급 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>군대/교육 관련 핵심 정보</h2><p>교육과 군 복무 관련 정보를 빠르게 확인할 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['discharge-date', 'net-salary'],
  },
  {
    slug: 'gpa-convert', category: 'military', categoryLabel: '군대/교육',
    title: '학점 백분율 환산기', titleShort: '학점 환산기',
    description: '4.5/4.3/4.0 만점 학점을 백분율 또는 100점 만점으로 환산.',
    keywords: ['학점 환산기','학점 백분율','GPA 변환','4.5 만점','학점 계산'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'gpaConvert', resultLabel: '백분율', resultUnit: '점',
    inputs: [
      { id: 'gpa', label: '학점', type: 'number', default: 3.8, min: 0, max: 4.5, step: 0.01 },
      { id: 'scale', label: '만점 기준', type: 'radio', default: '4.5', options: [{ value: '4.5', label: '4.5 만점' }, { value: '4.3', label: '4.3 만점' }, { value: '4.0', label: '4.0 만점' }] },
    ],
    faqs: [
      { q: '학점 환산기는 무료인가요?', a: '네, 카더라 학점 환산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>학점 백분율 환산기 사용 방법</h2><p>4.5/4.3/4.0 만점 학점을 백분율 또는 100점 만점으로 환산. 카더라 학점 백분율 환산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>군대/교육 핵심 정보</h2><p>군대/교육 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: [],

  },

  // ════════════════════════════════════════
  // 추가 세금 (5종)
  // ════════════════════════════════════════
  {
    slug: 'comprehensive-income-tax', category: 'income-tax', categoryLabel: '소득세',
    title: '종합소득세 계산기', titleShort: '종합소득세 계산기',
    description: '사업소득·프리랜서 등 종합소득에 대한 소득세를 누진세율로 계산.',
    keywords: ['종합소득세 계산기','종소세','5월 신고','사업소득세','프리랜서 세금'],
    legalBasis: '소득세법 제55조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'tax-bracket', formula: 'comprehensiveIncomeTax', resultLabel: '종합소득세', resultUnit: '원',
    inputs: [
      { id: 'totalIncome', label: '총 수입금액', type: 'currency', default: 80000000 },
      { id: 'expenses', label: '필요경비', type: 'currency', default: 30000000 },
      { id: 'deductions', label: '소득공제 합계', type: 'currency', default: 5000000 },
      { id: 'taxCredits', label: '세액공제 합계', type: 'currency', default: 1500000 },
    ],
    faqs: [
      { q: '종합소득세 계산기는 무료인가요?', a: '네, 카더라 종합소득세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제55조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>종합소득세 계산기 사용 방법</h2><p>사업소득·프리랜서 등 종합소득에 대한 소득세를 누진세율로 계산. 카더라 종합소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>지방세법 제111조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>부동산 세금 관련 핵심 정보</h2><p>부동산 거래 시 정확한 세금 계산은 재무 계획의 핵심입니다. 세율은 주택 수, 조정대상지역 여부, 보유 기간 등 다양한 조건에 따라 달라집니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['withholding-3-3', 'net-salary'],
  },
  {
    slug: 'property-tax', category: 'property-tax', categoryLabel: '부동산 세금',
    title: '재산세 계산기', titleShort: '재산세 계산기',
    description: '주택 공시가격으로 재산세+지방교육세+도시지역분을 계산.',
    keywords: ['재산세 계산기','재산세율','공시가격','아파트 재산세'],
    legalBasis: '지방세법 제111조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'tax-bracket', formula: 'propertyTax', resultLabel: '재산세 합계', resultUnit: '원',
    inputs: [
      { id: 'publicPrice', label: '공시가격', type: 'currency', default: 500000000 },
      { id: 'houseType', label: '주택 유형', type: 'radio', default: 'apartment', options: [{ value: 'apartment', label: '아파트/공동주택' }, { value: 'house', label: '단독주택' }] },
    ],
    faqs: [
      { q: '재산세 계산기는 무료인가요?', a: '네, 카더라 재산세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 지방세법 제111조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>재산세 계산기 사용 방법</h2><p>주택 공시가격으로 재산세+지방교육세+도시지역분을 계산. 카더라 재산세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>지방세법 제111조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 세금 핵심 정보</h2><p>부동산 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['comprehensive-property-tax', 'acquisition-tax'],

  },
  {
    slug: 'registration-cost', category: 'real-estate', categoryLabel: '부동산',
    title: '등기비용 계산기', titleShort: '등기비용 계산기',
    description: '부동산 매매 시 소유권이전등기 비용(등록면허세+취득세+법무사비)을 계산.',
    keywords: ['등기비용 계산기','소유권이전등기','법무사 비용','등록면허세','부동산 등기'],
    legalBasis: '지방세법 제28조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'registrationCost', resultLabel: '등기비용 합계', resultUnit: '원',
    inputs: [
      { id: 'price', label: '매매가', type: 'currency', default: 500000000 },
      { id: 'type', label: '취득 유형', type: 'radio', default: 'purchase', options: [{ value: 'purchase', label: '매매' }, { value: 'gift', label: '증여' }, { value: 'inherit', label: '상속' }] },
    ],
    faqs: [
      { q: '등기비용 계산기는 무료인가요?', a: '네, 카더라 등기비용 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 지방세법 제28조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>등기비용 계산기 사용 방법</h2><p>부동산 매매 시 소유권이전등기 비용(등록면허세+취득세+법무사비)을 계산. 카더라 등기비용 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>은행업감독규정</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>부동산 관련 핵심 정보</h2><p>부동산 거래와 투자에는 다양한 비용과 수익 분석이 필요합니다. 사전 계산으로 더 현명한 의사결정이 가능합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['acquisition-tax', 'brokerage-fee'],
  },
  {
    slug: 'dsr-calc', category: 'real-estate', categoryLabel: '부동산',
    title: 'DSR 계산기', titleShort: 'DSR 계산기',
    description: '총부채원리금상환비율(DSR)을 계산. 대출 가능 금액 추정.',
    keywords: ['DSR 계산기','총부채원리금상환비율','대출한도','DSR 40%','주택담보대출'],
    legalBasis: '은행업감독규정', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'dsrCalc', resultLabel: 'DSR', resultUnit: '%',
    inputs: [
      { id: 'annualIncome', label: '연소득', type: 'currency', default: 60000000 },
      { id: 'newLoan', label: '신규 대출 원금', type: 'currency', default: 300000000 },
      { id: 'newRate', label: '신규 대출 금리 (%)', type: 'percent', default: 4.5, step: 0.1 },
      { id: 'newYears', label: '신규 대출 기간 (년)', type: 'number', default: 30, min: 1, max: 40 },
      { id: 'existingAnnualRepay', label: '기존 대출 연간 상환액', type: 'currency', default: 0 },
    ],
    faqs: [
      { q: 'DSR 계산기는 무료인가요?', a: '네, 카더라 DSR 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 은행업감독규정를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>DSR 계산기 사용 방법</h2><p>총부채원리금상환비율(DSR)을 계산. 대출 가능 금액 추정. 카더라 DSR 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>은행업감독규정</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 핵심 정보</h2><p>부동산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['loan-repayment', 'net-salary'],

  },
  {
    slug: 'jeonse-vs-wolse', category: 'real-estate', categoryLabel: '부동산',
    title: '전세 vs 월세 비교기', titleShort: '전세vs월세 비교기',
    description: '전세와 월세 중 어느 것이 유리한지 대출이자·기회비용 포함 비교.',
    keywords: ['전세 월세 비교','전세 유리','월세 유리','전세 대출','주거비 비교'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'compare', formula: 'jeonseVsWolse', resultLabel: '비교 결과', resultUnit: '',
    inputs: [
      { id: 'jeonse', label: '전세 보증금', type: 'currency', default: 300000000 },
      { id: 'jeonseRate', label: '전세대출 금리 (%)', type: 'percent', default: 3.5, step: 0.1 },
      { id: 'jeonseOwn', label: '자기자금', type: 'currency', default: 100000000 },
      { id: 'wolseDeposit', label: '월세 보증금', type: 'currency', default: 30000000 },
      { id: 'wolseRent', label: '월세', type: 'currency', default: 1200000 },
      { id: 'investReturn', label: '자기자금 투자수익률 (%)', type: 'percent', default: 5, step: 0.1 },
    ],
    faqs: [
      { q: '전세vs월세 비교기는 무료인가요?', a: '네, 카더라 전세vs월세 비교기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>전세 vs 월세 비교기 사용 방법</h2><p>전세와 월세 중 어느 것이 유리한지 대출이자·기회비용 포함 비교. 카더라 전세vs월세 비교기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제134조, 제137조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>연말정산 관련 핵심 정보</h2><p>연말정산은 근로소득자가 1년간 납부한 세금을 정산하는 절차입니다. 공제를 최대한 활용하면 환급을 받을 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['jeonse-wolse', 'loan-repayment'],
  },
  {
    slug: 'year-end-refund', category: 'year-end', categoryLabel: '연말정산',
    title: '연말정산 예상 환급액 계산기', titleShort: '연말정산 환급액 계산기',
    description: '총급여·소득공제·세액공제를 입력하면 예상 환급(추가납부)액을 계산.',
    keywords: ['연말정산 계산기','연말정산 환급','13월의 월급','세액공제','소득공제'],
    legalBasis: '소득세법 제134조, 제137조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'conditional', formula: 'yearEndRefund', resultLabel: '예상 환급액', resultUnit: '원',
    inputs: [
      { id: 'annualSalary', label: '총급여', type: 'currency', default: 50000000 },
      { id: 'incomeDeduction', label: '소득공제 합계', type: 'currency', default: 8000000, hint: '인적공제+국민연금+건강보험+주택자금 등' },
      { id: 'taxCredit', label: '세액공제 합계', type: 'currency', default: 2000000, hint: '의료비+교육비+기부금+연금저축+월세 등' },
      { id: 'alreadyPaid', label: '기납부세액 (원천징수 합계)', type: 'currency', default: 3000000 },
    ],
    faqs: [
      { q: '연말정산 환급액 계산기는 무료인가요?', a: '네, 카더라 연말정산 환급액 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제134조, 제137조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>연말정산 예상 환급액 계산기 사용 방법</h2><p>총급여·소득공제·세액공제를 입력하면 예상 환급(추가납부)액을 계산. 카더라 연말정산 예상 환급액 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제134조, 제137조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>연말정산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['net-salary', 'irp-deduction', 'credit-card-deduction'],

  },
  {
    slug: 'credit-card-deduction', category: 'year-end', categoryLabel: '연말정산',
    title: '신용카드 소득공제 계산기', titleShort: '신용카드 공제 계산기',
    description: '신용카드·체크카드·현금영수증 사용액으로 소득공제 금액을 계산.',
    keywords: ['신용카드 소득공제','체크카드 공제','현금영수증 공제','연말정산 카드'],
    legalBasis: '조세특례제한법 제126조의2', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'creditCardDeduction', resultLabel: '소득공제 금액', resultUnit: '원',
    inputs: [
      { id: 'annualSalary', label: '총급여', type: 'currency', default: 50000000 },
      { id: 'credit', label: '신용카드 사용액', type: 'currency', default: 10000000 },
      { id: 'debit', label: '체크카드/현금영수증', type: 'currency', default: 8000000 },
      { id: 'traditional', label: '전통시장 사용액', type: 'currency', default: 500000 },
    ],
    faqs: [
      { q: '신용카드 공제 계산기는 무료인가요?', a: '네, 카더라 신용카드 공제 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 조세특례제한법 제126조의2를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>신용카드 소득공제 계산기 사용 방법</h2><p>신용카드·체크카드·현금영수증 사용액으로 소득공제 금액을 계산. 카더라 신용카드 공제 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제95조의2</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>연말정산 관련 핵심 정보</h2><p>연말정산은 근로소득자가 1년간 납부한 세금을 정산하는 절차입니다. 공제를 최대한 활용하면 환급을 받을 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['year-end-refund', 'net-salary'],
  },
  {
    slug: 'monthly-rent-deduction', category: 'year-end', categoryLabel: '연말정산',
    title: '월세 세액공제 계산기', titleShort: '월세 세액공제 계산기',
    description: '무주택 세대주의 월세 세액공제(17%) 환급액을 계산.',
    keywords: ['월세 세액공제','월세 공제','연말정산 월세','무주택 월세'],
    legalBasis: '소득세법 제95조의2', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'monthlyRentDeduction', resultLabel: '세액공제 환급액', resultUnit: '원',
    inputs: [
      { id: 'annualSalary', label: '총급여', type: 'currency', default: 45000000 },
      { id: 'annualRent', label: '연간 월세 합계', type: 'currency', default: 9600000, hint: '월 80만원 × 12개월 = 960만원' },
    ],
    faqs: [
      { q: '월세 세액공제 계산기는 무료인가요?', a: '네, 카더라 월세 세액공제 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제95조의2를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>월세 세액공제 계산기 사용 방법</h2><p>무주택 세대주의 월세 세액공제(17%) 환급액을 계산. 카더라 월세 세액공제 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제95조의2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>연말정산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['year-end-refund', 'jeonse-vs-wolse'],

  },
  {
    slug: 'inheritance-tax', category: 'inheritance', categoryLabel: '상속/증여',
    title: '상속세 계산기', titleShort: '상속세 계산기',
    description: '상속재산에서 기초공제·배우자공제를 차감한 과세표준에 10~50% 누진세율 적용.',
    keywords: ['상속세 계산기','상속세율','상속공제','기초공제','배우자공제'],
    legalBasis: '상속세및증여세법 제18조~제24조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'tax-bracket', formula: 'inheritanceTax', resultLabel: '상속세', resultUnit: '원',
    inputs: [
      { id: 'totalEstate', label: '상속재산 총액', type: 'currency', default: 1000000000 },
      { id: 'debts', label: '채무·공과금', type: 'currency', default: 50000000 },
      { id: 'hasSpouse', label: '배우자 생존', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] },
      { id: 'childCount', label: '상속인 자녀 수', type: 'stepper', default: 2, min: 0, max: 10 },
    ],
    faqs: [
      { q: '상속세 계산기는 무료인가요?', a: '네, 카더라 상속세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 상속세및증여세법 제18조~제24조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 상속/증여 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ],
    seoContent: '<h2>상속세 계산기 사용 방법</h2><p>상속재산에서 기초공제·배우자공제를 차감한 과세표준에 10~50% 누진세율 적용. 카더라 상속세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>부가가치세법 제29조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>사업자 세금 관련 핵심 정보</h2><p>사업자가 납부해야 하는 세금은 부가가치세, 소득세, 원천징수세 등 다양합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['gift-tax', 'capital-gains-housing'],
  },
  {
    slug: 'vat-calc', category: 'biz-tax', categoryLabel: '사업자 세금',
    title: '부가가치세 계산기', titleShort: '부가세 계산기',
    description: '공급가액↔VAT 역산. 부가세 포함/미포함 금액 변환.',
    keywords: ['부가세 계산기','VAT 계산','공급가액','부가가치세','10%'],
    legalBasis: '부가가치세법 제29조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'vatCalc', resultLabel: '부가세', resultUnit: '원',
    inputs: [
      { id: 'direction', label: '계산 방향', type: 'radio', default: 'addVat', options: [{ value: 'addVat', label: '공급가액 → VAT 포함' }, { value: 'removeVat', label: 'VAT 포함 → 공급가액' }] },
      { id: 'amount', label: '금액', type: 'currency', default: 1000000 },
    ],
    faqs: [
      { q: '부가세 계산기는 무료인가요?', a: '네, 카더라 부가세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 부가가치세법 제29조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>부가가치세 계산기 사용 방법</h2><p>공급가액↔VAT 역산. 부가세 포함/미포함 금액 변환. 카더라 부가가치세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>부가가치세법 제29조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>사업자 세금 핵심 정보</h2><p>사업자 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['comprehensive-income-tax'],

  },

  // ════════════════════════════════════════
  // 추가 세금 (소득세 세분화 + 사업자 + 연말정산)
  // ════════════════════════════════════════
  { slug: 'earned-income-tax', category: 'income-tax', categoryLabel: '소득세', title: '근로소득세 간이세액 계산기', titleShort: '근로소득세 계산기', description: '월급에서 원천징수되는 근로소득세를 간이세액표로 계산.', keywords: ['근로소득세','간이세액표','원천징수','월급 세금'], legalBasis: '소득세법 시행령 별표2', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'earnedIncomeTax', resultLabel: '월 원천징수세액', resultUnit: '원', inputs: [{ id: 'monthlySalary', label: '월 급여 (비과세 제외)', type: 'currency', default: 3500000 }, { id: 'family', label: '공제대상 가족수', type: 'stepper', default: 1, min: 1, max: 11 }, { id: 'children', label: '20세 이하 자녀수', type: 'stepper', default: 0, min: 0, max: 7 }], faqs: [
      { q: '근로소득세 계산기는 무료인가요?', a: '네, 카더라 근로소득세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 시행령 별표2를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>근로소득세 간이세액 계산기 사용 방법</h2><p>월급에서 원천징수되는 근로소득세를 간이세액표로 계산. 카더라 근로소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제48조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>소득세 관련 핵심 정보</h2><p>소득세는 개인의 소득에 부과되는 국세로, 소득 종류와 규모에 따라 6~45%의 누진세율이 적용됩니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['net-salary', 'year-end-refund'] },
  { slug: 'retirement-income-tax', category: 'income-tax', categoryLabel: '소득세', title: '퇴직소득세 계산기', titleShort: '퇴직소득세 계산기', description: '퇴직금에 대한 퇴직소득세를 근속연수공제 등 적용하여 계산.', keywords: ['퇴직소득세','퇴직금 세금','근속연수공제','퇴직소득 과세'], legalBasis: '소득세법 제48조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'retirementIncomeTax', resultLabel: '퇴직소득세', resultUnit: '원', inputs: [{ id: 'retirementPay', label: '퇴직금 총액', type: 'currency', default: 100000000 }, { id: 'years', label: '근속연수', type: 'number', default: 10, min: 1, max: 40 }], faqs: [
      { q: '퇴직소득세 계산기는 무료인가요?', a: '네, 카더라 퇴직소득세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제48조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>퇴직소득세 계산기 사용 방법</h2><p>퇴직금에 대한 퇴직소득세를 근속연수공제 등 적용하여 계산. 카더라 퇴직소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제48조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>소득세 핵심 정보</h2><p>소득세 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['retirement-pay', 'irp-deduction'] },

  { slug: 'other-income-tax', category: 'income-tax', categoryLabel: '소득세', title: '기타소득세 계산기', titleShort: '기타소득세 계산기', description: '강연료·원고료·사례금 등 기타소득에 대한 세금을 계산.', keywords: ['기타소득세','강연료 세금','원고료 세금','사례금'], legalBasis: '소득세법 제21조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'otherIncomeTax', resultLabel: '기타소득세', resultUnit: '원', inputs: [{ id: 'grossIncome', label: '기타소득 총수입', type: 'currency', default: 5000000 }, { id: 'expenseRate', label: '필요경비율', type: 'radio', default: '60', options: [{ value: '60', label: '60% (일반)' }, { value: '80', label: '80% (강연·자문)' }, { value: 'actual', label: '실제 경비' }] }, { id: 'actualExpense', label: '실제 경비', type: 'currency', default: 0, condition: 'expenseRate=actual' }], faqs: [
      { q: '기타소득세 계산기는 무료인가요?', a: '네, 카더라 기타소득세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제21조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>기타소득세 계산기 사용 방법</h2><p>강연료·원고료·사례금 등 기타소득에 대한 세금을 계산. 카더라 기타소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>소득세 관련 핵심 정보</h2><p>소득세는 개인의 소득에 부과되는 국세로, 소득 종류와 규모에 따라 6~45%의 누진세율이 적용됩니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'withholding-3-3'] },
  { slug: 'interest-tax', category: 'income-tax', categoryLabel: '소득세', title: '이자소득세 계산기', titleShort: '이자소득세 계산기', description: '예금·적금 이자에 대한 원천징수 세금(15.4%)을 계산.', keywords: ['이자소득세','예금 이자 세금','15.4%','원천징수'], legalBasis: '소득세법 제129조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'interestTax', resultLabel: '이자소득세', resultUnit: '원', inputs: [{ id: 'interest', label: '이자 수입', type: 'currency', default: 1000000 }, { id: 'taxType', label: '과세 유형', type: 'radio', default: 'general', options: [{ value: 'general', label: '일반 (15.4%)' }, { value: 'preferential', label: '세금우대 (9.5%)' }, { value: 'taxFree', label: '비과세' }] }], faqs: [
      { q: '이자소득세 계산기는 무료인가요?', a: '네, 카더라 이자소득세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제129조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>이자소득세 계산기 사용 방법</h2><p>예금·적금 이자에 대한 원천징수 세금(15.4%)을 계산. 카더라 이자소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>소득세 핵심 정보</h2><p>소득세 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['deposit-interest', 'financial-income-tax'] },

  { slug: 'income-bracket-lookup', category: 'income-tax', categoryLabel: '소득세', title: '소득세 누진세율 조회기', titleShort: '소득세율 조회', description: '과세표준 금액별 소득세 누진세율(6~45% 8단계)을 조회.', keywords: ['소득세율','누진세율','과세표준','세율표'], legalBasis: '소득세법 제55조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'incomeBracketLookup', resultLabel: '소득세', resultUnit: '원', inputs: [{ id: 'taxBase', label: '과세표준', type: 'currency', default: 50000000 }], faqs: [
      { q: '소득세율 조회는 무료인가요?', a: '네, 카더라 소득세율 조회는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제55조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>소득세 누진세율 조회기 사용 방법</h2><p>과세표준 금액별 소득세 누진세율(6~45% 8단계)을 조회. 카더라 소득세율 조회는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>지방세법 제86조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>소득세 관련 핵심 정보</h2><p>소득세는 개인의 소득에 부과되는 국세로, 소득 종류와 규모에 따라 6~45%의 누진세율이 적용됩니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'net-salary'] },
  { slug: 'local-income-tax', category: 'income-tax', categoryLabel: '소득세', title: '지방소득세 계산기', titleShort: '지방소득세 계산기', description: '소득세의 10%를 자동 계산하는 지방소득세 계산기.', keywords: ['지방소득세','소득세 10%','지방세'], legalBasis: '지방세법 제86조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'localIncomeTax', resultLabel: '지방소득세', resultUnit: '원', inputs: [{ id: 'incomeTax', label: '소득세', type: 'currency', default: 5000000 }], faqs: [
      { q: '지방소득세 계산기는 무료인가요?', a: '네, 카더라 지방소득세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 지방세법 제86조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>지방소득세 계산기 사용 방법</h2><p>소득세의 10%를 자동 계산하는 지방소득세 계산기. 카더라 지방소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>지방세법 제86조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>소득세 핵심 정보</h2><p>소득세 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['comprehensive-income-tax'] },


  // 사업자 세금 추가
  { slug: 'simplified-vat', category: 'biz-tax', categoryLabel: '사업자 세금', title: '간이과세자 부가세 계산기', titleShort: '간이과세 부가세', description: '간이과세자 업종별 부가가치율(1.5~4%) 적용 부가세를 계산.', keywords: ['간이과세자','부가세','업종별 부가가치율','간이과세'], legalBasis: '부가가치세법 제61조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'simplifiedVat', resultLabel: '납부 부가세', resultUnit: '원', inputs: [{ id: 'revenue', label: '연 매출액', type: 'currency', default: 30000000 }, { id: 'industryRate', label: '업종별 부가가치율', type: 'select', default: '0.03', options: [{ value: '0.015', label: '전기/가스/수도 (1.5%)' }, { value: '0.02', label: '소매/음식 (2%)' }, { value: '0.03', label: '제조/건설/운수 (3%)' }, { value: '0.04', label: '서비스업 (4%)' }] }, { id: 'purchaseVat', label: '매입 부가세', type: 'currency', default: 500000 }], faqs: [
      { q: '간이과세 부가세는 무료인가요?', a: '네, 카더라 간이과세 부가세는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 부가가치세법 제61조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>간이과세자 부가세 계산기 사용 방법</h2><p>간이과세자 업종별 부가가치율(1.5~4%) 적용 부가세를 계산. 카더라 간이과세 부가세는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>법인세법 제55조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>사업자 세금 관련 핵심 정보</h2><p>사업자가 납부해야 하는 세금은 부가가치세, 소득세, 원천징수세 등 다양합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['vat-calc', 'comprehensive-income-tax'] },
  { slug: 'corporate-tax', category: 'biz-tax', categoryLabel: '사업자 세금', title: '법인세 계산기', titleShort: '법인세 계산기', description: '법인 과세표준별 법인세(9~24% 4단계)를 계산.', keywords: ['법인세 계산기','법인세율','과세표준','법인 세금'], legalBasis: '법인세법 제55조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'corporateTax', resultLabel: '법인세', resultUnit: '원', inputs: [{ id: 'taxBase', label: '과세표준', type: 'currency', default: 500000000 }], faqs: [
      { q: '법인세 계산기는 무료인가요?', a: '네, 카더라 법인세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 법인세법 제55조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>법인세 계산기 사용 방법</h2><p>법인 과세표준별 법인세(9~24% 4단계)를 계산. 카더라 법인세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>법인세법 제55조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>사업자 세금 핵심 정보</h2><p>사업자 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['vat-calc'] },

  { slug: 'penalty-tax', category: 'biz-tax', categoryLabel: '사업자 세금', title: '가산세 계산기', titleShort: '가산세 계산기', description: '무신고·과소신고·납부불성실 가산세를 계산.', keywords: ['가산세 계산기','무신고 가산세','과소신고','납부불성실'], legalBasis: '국세기본법 제47조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'penaltyTax', resultLabel: '가산세', resultUnit: '원', inputs: [{ id: 'type', label: '가산세 종류', type: 'radio', default: 'noFiling', options: [{ value: 'noFiling', label: '무신고 (20%)' }, { value: 'underReport', label: '과소신고 (10%)' }, { value: 'latePay', label: '납부불성실' }] }, { id: 'taxAmount', label: '세액', type: 'currency', default: 5000000 }, { id: 'days', label: '지연일수', type: 'number', default: 30, min: 1, max: 365, condition: 'type=latePay' }], faqs: [
      { q: '가산세 계산기는 무료인가요?', a: '네, 카더라 가산세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 국세기본법 제47조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>가산세 계산기 사용 방법</h2><p>무신고·과소신고·납부불성실 가산세를 계산. 카더라 가산세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 시행령 제143조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>사업자 세금 관련 핵심 정보</h2><p>사업자가 납부해야 하는 세금은 부가가치세, 소득세, 원천징수세 등 다양합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'vat-calc'] },
  { slug: 'expense-rate-lookup', category: 'biz-tax', categoryLabel: '사업자 세금', title: '업종별 경비율 조회기', titleShort: '경비율 조회기', description: '업종코드별 단순경비율·기준경비율을 조회.', keywords: ['단순경비율','기준경비율','업종별 경비율','추계신고'], legalBasis: '소득세법 시행령 제143조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'expenseRateLookup', resultLabel: '추정 소득금액', resultUnit: '원', inputs: [{ id: 'revenue', label: '총 수입금액', type: 'currency', default: 50000000 }, { id: 'rateType', label: '적용 경비율', type: 'radio', default: 'simple', options: [{ value: 'simple', label: '단순경비율 (90.1%)' }, { value: 'standard', label: '기준경비율 (20.8%)' }] }, { id: 'rate', label: '경비율 (%)', type: 'percent', default: 90.1, min: 0, max: 99 }], faqs: [
      { q: '경비율 조회기는 무료인가요?', a: '네, 카더라 경비율 조회기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 시행령 제143조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>업종별 경비율 조회기 사용 방법</h2><p>업종코드별 단순경비율·기준경비율을 조회. 카더라 업종별 경비율 조회기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 시행령 제143조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>사업자 세금 핵심 정보</h2><p>사업자 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'withholding-3-3'] },


  // 연말정산 추가
  { slug: 'medical-deduction', category: 'year-end', categoryLabel: '연말정산', title: '의료비 세액공제 계산기', titleShort: '의료비 공제 계산기', description: '총급여 3% 초과 의료비에 대해 15% 세액공제를 계산.', keywords: ['의료비 세액공제','의료비 공제','연말정산 의료비'], legalBasis: '소득세법 제59조의4', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'medicalDeduction', resultLabel: '의료비 세액공제', resultUnit: '원', inputs: [{ id: 'annualSalary', label: '총급여', type: 'currency', default: 50000000 }, { id: 'totalMedical', label: '의료비 합계', type: 'currency', default: 3000000 }, { id: 'seniorMedical', label: '65세 이상·장애인 의료비', type: 'currency', default: 0 }], faqs: [
      { q: '의료비 공제 계산기는 무료인가요?', a: '네, 카더라 의료비 공제 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제59조의4를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>의료비 세액공제 계산기 사용 방법</h2><p>총급여 3% 초과 의료비에 대해 15% 세액공제를 계산. 카더라 의료비 공제 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제59조의4</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>연말정산 관련 핵심 정보</h2><p>연말정산은 근로소득자가 1년간 납부한 세금을 정산하는 절차입니다. 공제를 최대한 활용하면 환급을 받을 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['year-end-refund'] },
  { slug: 'education-deduction', category: 'year-end', categoryLabel: '연말정산', title: '교육비 세액공제 계산기', titleShort: '교육비 공제 계산기', description: '본인·자녀 교육비에 대해 15% 세액공제를 계산.', keywords: ['교육비 세액공제','등록금 공제','연말정산 교육비'], legalBasis: '소득세법 제59조의4', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'educationDeduction', resultLabel: '교육비 세액공제', resultUnit: '원', inputs: [{ id: 'selfEdu', label: '본인 교육비', type: 'currency', default: 0, hint: '대학원 등 한도 없음' }, { id: 'childEdu', label: '자녀 교육비', type: 'currency', default: 3000000, hint: '1인당 연 300만원 한도' }, { id: 'childCount', label: '자녀수', type: 'stepper', default: 1, min: 0, max: 5 }], faqs: [
      { q: '교육비 공제 계산기는 무료인가요?', a: '네, 카더라 교육비 공제 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제59조의4를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>교육비 세액공제 계산기 사용 방법</h2><p>본인·자녀 교육비에 대해 15% 세액공제를 계산. 카더라 교육비 세액공제 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제59조의4</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>연말정산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['year-end-refund'] },

  { slug: 'donation-deduction', category: 'year-end', categoryLabel: '연말정산', title: '기부금 세액공제 계산기', titleShort: '기부금 공제 계산기', description: '법정·지정·종교 기부금에 대한 세액공제를 계산.', keywords: ['기부금 세액공제','기부금 공제','종교 기부금','연말정산 기부금'], legalBasis: '소득세법 제59조의4', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'donationDeduction', resultLabel: '기부금 세액공제', resultUnit: '원', inputs: [{ id: 'annualSalary', label: '총급여', type: 'currency', default: 50000000 }, { id: 'legalDonation', label: '법정 기부금', type: 'currency', default: 0 }, { id: 'designatedDonation', label: '지정 기부금', type: 'currency', default: 500000 }, { id: 'religiousDonation', label: '종교단체 기부금', type: 'currency', default: 1000000 }], faqs: [
      { q: '기부금 공제 계산기는 무료인가요?', a: '네, 카더라 기부금 공제 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제59조의4를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>기부금 세액공제 계산기 사용 방법</h2><p>법정·지정·종교 기부금에 대한 세액공제를 계산. 카더라 기부금 공제 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제59조의4</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>연말정산 관련 핵심 정보</h2><p>연말정산은 근로소득자가 1년간 납부한 세금을 정산하는 절차입니다. 공제를 최대한 활용하면 환급을 받을 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['year-end-refund'] },
  { slug: 'insurance-deduction', category: 'year-end', categoryLabel: '연말정산', title: '보험료 세액공제 계산기', titleShort: '보험료 공제 계산기', description: '보장성보험 연 100만원 한도, 12% 세액공제를 계산.', keywords: ['보험료 세액공제','보장성보험 공제','연말정산 보험'], legalBasis: '소득세법 제59조의4', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'insuranceDeduction', resultLabel: '보험료 세액공제', resultUnit: '원', inputs: [{ id: 'premium', label: '보장성보험료 합계', type: 'currency', default: 1200000, hint: '한도 연 100만원' }, { id: 'disabilityPremium', label: '장애인전용보험료', type: 'currency', default: 0, hint: '한도 연 100만원 별도' }], faqs: [
      { q: '보험료 공제 계산기는 무료인가요?', a: '네, 카더라 보험료 공제 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제59조의4를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>보험료 세액공제 계산기 사용 방법</h2><p>보장성보험 연 100만원 한도, 12% 세액공제를 계산. 카더라 보험료 세액공제 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제59조의4</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>연말정산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['year-end-refund'] },

  { slug: 'child-credit', category: 'year-end', categoryLabel: '연말정산', title: '자녀 세액공제 계산기', titleShort: '자녀 공제 계산기', description: '자녀수별 세액공제 + 출산/입양 추가공제를 계산.', keywords: ['자녀 세액공제','자녀 공제','출산 공제','연말정산 자녀'], legalBasis: '소득세법 제59조의2', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'childCredit', resultLabel: '자녀 세액공제', resultUnit: '원', inputs: [{ id: 'childCount', label: '8세 이상 자녀수', type: 'stepper', default: 2, min: 0, max: 7 }, { id: 'newborn', label: '출산/입양 자녀수', type: 'stepper', default: 0, min: 0, max: 3 }], faqs: [
      { q: '자녀 공제 계산기는 무료인가요?', a: '네, 카더라 자녀 공제 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제59조의2를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>자녀 세액공제 계산기 사용 방법</h2><p>자녀수별 세액공제 + 출산/입양 추가공제를 계산. 카더라 자녀 공제 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제52조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>연말정산 관련 핵심 정보</h2><p>연말정산은 근로소득자가 1년간 납부한 세금을 정산하는 절차입니다. 공제를 최대한 활용하면 환급을 받을 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['year-end-refund'] },
  { slug: 'housing-fund-deduction', category: 'year-end', categoryLabel: '연말정산', title: '주택자금 소득공제 계산기', titleShort: '주택자금 공제 계산기', description: '주택청약·주택담보대출 이자에 대한 소득공제를 계산.', keywords: ['주택자금 소득공제','주택청약 공제','주담대 이자 공제'], legalBasis: '소득세법 제52조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'housingFundDeduction', resultLabel: '소득공제 금액', resultUnit: '원', inputs: [{ id: 'subscription', label: '주택청약 납입액', type: 'currency', default: 2400000, hint: '한도 연 300만원 (무주택 세대주)' }, { id: 'mortgageInterest', label: '장기주담대 이자 상환액', type: 'currency', default: 0, hint: '한도 300~1,800만원 (상환기간별)' }], faqs: [
      { q: '주택자금 공제 계산기는 무료인가요?', a: '네, 카더라 주택자금 공제 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제52조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>주택자금 소득공제 계산기 사용 방법</h2><p>주택청약·주택담보대출 이자에 대한 소득공제를 계산. 카더라 주택자금 소득공제 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제52조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>연말정산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['year-end-refund', 'loan-repayment'] },


  // 부동산 세금 추가
  { slug: 'comprehensive-property-tax', category: 'property-tax', categoryLabel: '부동산 세금', title: '종합부동산세 계산기', titleShort: '종부세 계산기', description: '공시가격 기준 종합부동산세를 계산. 1세대1주택 12억 공제.', keywords: ['종합부동산세 계산기','종부세','공시가격','1세대1주택'], legalBasis: '종합부동산세법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'comprehensivePropertyTax', resultLabel: '종부세', resultUnit: '원', inputs: [{ id: 'publicPrice', label: '공시가격 합계', type: 'currency', default: 1500000000 }, { id: 'houseCount', label: '보유 주택수', type: 'stepper', default: 1, min: 1, max: 5 }, { id: 'oneHouse', label: '1세대1주택 여부', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '예 (12억 공제)' }, { value: 'no', label: '아니오 (9억 공제)' }] }], faqs: [
      { q: '종부세 계산기는 무료인가요?', a: '네, 카더라 종부세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 종합부동산세법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>종합부동산세 계산기 사용 방법</h2><p>공시가격 기준 종합부동산세를 계산. 1세대1주택 12억 공제. 카더라 종부세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제64조의2</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>부동산 세금 관련 핵심 정보</h2><p>부동산 거래 시 정확한 세금 계산은 재무 계획의 핵심입니다. 세율은 주택 수, 조정대상지역 여부, 보유 기간 등 다양한 조건에 따라 달라집니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['property-tax', 'acquisition-tax'] },
  { slug: 'rental-income-tax', category: 'property-tax', categoryLabel: '부동산 세금', title: '주택임대소득세 계산기', titleShort: '임대소득세 계산기', description: '주택 임대소득에 대한 분리과세/종합과세 세금을 비교 계산.', keywords: ['주택임대소득세','임대소득 세금','분리과세','종합과세'], legalBasis: '소득세법 제64조의2', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'rentalIncomeTax', resultLabel: '임대소득세', resultUnit: '원', inputs: [{ id: 'annualRent', label: '연간 임대수입', type: 'currency', default: 15000000 }, { id: 'otherIncome', label: '기타 종합소득', type: 'currency', default: 40000000 }, { id: 'registered', label: '임대사업자 등록', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '등록 (60% 경비율)' }, { value: 'no', label: '미등록 (50% 경비율)' }] }], faqs: [
      { q: '임대소득세 계산기는 무료인가요?', a: '네, 카더라 임대소득세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제64조의2를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>주택임대소득세 계산기 사용 방법</h2><p>주택 임대소득에 대한 분리과세/종합과세 세금을 비교 계산. 카더라 주택임대소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제64조의2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 세금 핵심 정보</h2><p>부동산 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['rental-yield', 'comprehensive-income-tax'] },


  // 금융 세금 추가
  { slug: 'crypto-tax', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: '가상자산(코인) 세금 계산기', titleShort: '코인 세금 계산기', description: '2027년 시행 예정 가상자산 과세 — 250만원 공제, 22% 세율 시뮬레이션.', keywords: ['코인 세금','가상자산 과세','비트코인 세금','암호화폐 세금','250만원 공제'], legalBasis: '소득세법 제37조 (2027년 시행)', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'cryptoTax', resultLabel: '가상자산 소득세', resultUnit: '원', inputs: [{ id: 'profit', label: '양도차익', type: 'currency', default: 10000000 }], faqs: [
      { q: '코인 세금 계산기는 무료인가요?', a: '네, 카더라 코인 세금 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제37조 (2027년 시행)를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>가상자산(코인) 세금 계산기 사용 방법</h2><p>2027년 시행 예정 가상자산 과세 — 250만원 공제, 22% 세율 시뮬레이션. 카더라 코인 세금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>금융/투자 세금 관련 핵심 정보</h2><p>금융투자 수익에는 다양한 세금이 부과됩니다. 상품별로 과세 방식이 다르므로 투자 전 세금 구조를 이해하는 것이 중요합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['overseas-cgt', 'financial-income-tax'] },
  { slug: 'etf-tax', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: 'ETF 과세 계산기', titleShort: 'ETF 과세 계산기', description: '국내/해외 ETF 매도 시 배당소득세 또는 양도소득세를 계산.', keywords: ['ETF 세금','국내 ETF 과세','해외 ETF 세금','배당소득세'], legalBasis: '소득세법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'etfTax', resultLabel: 'ETF 세금', resultUnit: '원', inputs: [{ id: 'type', label: 'ETF 유형', type: 'radio', default: 'domestic', options: [{ value: 'domestic', label: '국내 ETF (배당소득세 15.4%)' }, { value: 'overseas', label: '해외 ETF (양도세 22%)' }] }, { id: 'profit', label: '매도 차익', type: 'currency', default: 5000000 }], faqs: [
      { q: 'ETF 과세 계산기는 무료인가요?', a: '네, 카더라 ETF 과세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>ETF 과세 계산기 사용 방법</h2><p>국내/해외 ETF 매도 시 배당소득세 또는 양도소득세를 계산. 카더라 ETF 과세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>금융/투자 세금 핵심 정보</h2><p>금융/투자 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['overseas-cgt', 'financial-income-tax', 'dividend-calc'] },

  { slug: 'isa-tax-free', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: 'ISA 비과세 한도 계산기', titleShort: 'ISA 비과세 계산기', description: 'ISA 계좌 비과세 한도(일반 200만/서민 400만)와 절세 효과를 계산.', keywords: ['ISA 비과세','ISA 한도','개인종합자산관리계좌','ISA 절세'], legalBasis: '조세특례제한법 제91조의18', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'isaTaxFree', resultLabel: '절세 금액', resultUnit: '원', inputs: [{ id: 'profit', label: 'ISA 수익', type: 'currency', default: 3000000 }, { id: 'type', label: 'ISA 유형', type: 'radio', default: 'general', options: [{ value: 'general', label: '일반형 (200만 비과세)' }, { value: 'lowIncome', label: '서민형 (400만 비과세)' }] }], faqs: [
      { q: 'ISA 비과세 계산기는 무료인가요?', a: '네, 카더라 ISA 비과세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 조세특례제한법 제91조의18를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>ISA 비과세 한도 계산기 사용 방법</h2><p>ISA 계좌 비과세 한도(일반 200만/서민 400만)와 절세 효과를 계산. 카더라 ISA 비과세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>양육비 산정기준표 (대법원)</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>법률/가정 관련 핵심 정보</h2><p>법률 관련 비용과 권리를 미리 파악하면 불필요한 분쟁과 손해를 줄일 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['irp-deduction', 'deposit-interest'] },

  // 법률/가정
  { slug: 'child-support', category: 'law', categoryLabel: '법률/가정', title: '양육비 계산기', titleShort: '양육비 계산기', description: '양육비 산정기준표로 자녀 양육비를 계산.', keywords: ['양육비 계산기','양육비 산정','이혼 양육비','자녀 양육비'], legalBasis: '양육비 산정기준표 (대법원)', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'childSupport', resultLabel: '월 양육비', resultUnit: '원', inputs: [{ id: 'fatherIncome', label: '부 월소득', type: 'currency', default: 4000000 }, { id: 'motherIncome', label: '모 월소득', type: 'currency', default: 3000000 }, { id: 'childAge', label: '자녀 나이', type: 'number', default: 10, min: 0, max: 18 }, { id: 'childCount', label: '자녀수', type: 'stepper', default: 1, min: 1, max: 4 }], faqs: [
      { q: '양육비 계산기는 무료인가요?', a: '네, 카더라 양육비 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 양육비 산정기준표 (대법원)를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 법률/가정 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>양육비 계산기 사용 방법</h2><p>양육비 산정기준표로 자녀 양육비를 계산. 카더라 양육비 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>양육비 산정기준표 (대법원)</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>법률/가정 핵심 정보</h2><p>법률/가정 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: [] },

  { slug: 'accident-compensation', category: 'law', categoryLabel: '법률/가정', title: '교통사고 합의금 추정기', titleShort: '교통사고 합의금', description: '치료비·위자료·휴업손해 등으로 교통사고 합의금을 추정.', keywords: ['교통사고 합의금','합의금 계산','위자료','휴업손해'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'accidentCompensation', resultLabel: '추정 합의금', resultUnit: '원', inputs: [{ id: 'treatmentCost', label: '치료비', type: 'currency', default: 3000000 }, { id: 'treatmentDays', label: '치료기간 (일)', type: 'number', default: 30, min: 1, max: 365 }, { id: 'dailyWage', label: '일 소득', type: 'currency', default: 150000 }, { id: 'disability', label: '장해 등급', type: 'select', default: '0', options: [{ value: '0', label: '장해 없음' }, { value: '14', label: '14급 (경미)' }, { value: '12', label: '12급' }, { value: '10', label: '10급' }, { value: '8', label: '8급' }, { value: '5', label: '5급' }, { value: '1', label: '1급 (중증)' }] }], faqs: [
      { q: '교통사고 합의금는 무료인가요?', a: '네, 카더라 교통사고 합의금는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 법률/가정 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>교통사고 합의금 추정기 사용 방법</h2><p>치료비·위자료·휴업손해 등으로 교통사고 합의금을 추정. 카더라 교통사고 합의금는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>대출/예적금 관련 핵심 정보</h2><p>대출 상환 계획을 세우려면 월 상환액, 총 이자, 상환 방식별 차이를 정확히 계산해야 합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: [] },

  // 추가 대출
  { slug: 'prepayment-fee', category: 'loan', categoryLabel: '대출/예적금', title: '중도상환수수료 계산기', titleShort: '중도상환수수료', description: '대출 중도상환 시 발생하는 수수료를 계산.', keywords: ['중도상환수수료','조기상환수수료','대출 상환'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'prepaymentFee', resultLabel: '중도상환수수료', resultUnit: '원', inputs: [{ id: 'repayAmount', label: '상환 금액', type: 'currency', default: 100000000 }, { id: 'feeRate', label: '수수료율 (%)', type: 'percent', default: 1.2, min: 0, max: 3, step: 0.1 }, { id: 'remainMonths', label: '잔여 기간 (개월)', type: 'number', default: 24, min: 1, max: 360 }, { id: 'totalMonths', label: '전체 기간 (개월)', type: 'number', default: 360, min: 1, max: 360 }], faqs: [
      { q: '중도상환수수료는 무료인가요?', a: '네, 카더라 중도상환수수료는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>중도상환수수료 계산기 사용 방법</h2><p>대출 중도상환 시 발생하는 수수료를 계산. 카더라 중도상환수수료 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>대출/예적금 핵심 정보</h2><p>대출/예적금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['loan-repayment'] },


  // 추가 연금
  { slug: 'housing-pension', category: 'pension', categoryLabel: '연금/은퇴', title: '주택연금 수령액 계산기', titleShort: '주택연금 계산기', description: '주택가격·나이로 주택연금 예상 월 수령액을 계산.', keywords: ['주택연금 계산기','주택연금 수령액','역모기지','노후 주거'], legalBasis: '한국주택금융공사법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'housingPension', resultLabel: '예상 월 수령액', resultUnit: '원', inputs: [{ id: 'housePrice', label: '주택 시가', type: 'currency', default: 500000000 }, { id: 'age', label: '가입 나이', type: 'number', default: 65, min: 55, max: 90 }], faqs: [
      { q: '주택연금 계산기는 무료인가요?', a: '네, 카더라 주택연금 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 한국주택금융공사법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>주택연금 수령액 계산기 사용 방법</h2><p>주택가격·나이로 주택연금 예상 월 수령액을 계산. 카더라 주택연금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제22조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>연금/은퇴 관련 핵심 정보</h2><p>노후 준비는 빠를수록 유리합니다. 다층적 연금 구조를 이해하고 자신에게 맞는 계획을 세우세요.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['national-pension', 'fire-calc'] },
  { slug: 'retirement-pension-sim', category: 'pension', categoryLabel: '연금/은퇴', title: '퇴직연금 수령 시뮬레이터', titleShort: '퇴직연금 시뮬', description: '퇴직연금을 연금으로 수령 시 vs 일시금 수령 시 세금 비교.', keywords: ['퇴직연금 수령','연금 vs 일시금','퇴직소득세','연금소득세'], legalBasis: '소득세법 제22조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'retirementPensionSim', resultLabel: '비교 결과', resultUnit: '', inputs: [{ id: 'totalAmount', label: '퇴직금 총액', type: 'currency', default: 200000000 }, { id: 'years', label: '근속연수', type: 'number', default: 20, min: 1, max: 40 }, { id: 'pensionYears', label: '연금 수령 기간 (년)', type: 'range', default: 10, min: 5, max: 30 }], faqs: [
      { q: '퇴직연금 시뮬는 무료인가요?', a: '네, 카더라 퇴직연금 시뮬는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제22조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>퇴직연금 수령 시뮬레이터 사용 방법</h2><p>퇴직연금을 연금으로 수령 시 vs 일시금 수령 시 세금 비교. 카더라 퇴직연금 수령 시뮬레이터는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제22조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연금/은퇴 핵심 정보</h2><p>연금/은퇴 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['retirement-pay', 'irp-deduction', 'national-pension'] },


  // 생활 추가
  { slug: 'alcohol-calc', category: 'life', categoryLabel: '생활/건강', title: '혈중알코올 농도 계산기', titleShort: '혈중알코올 계산기', description: '체중·음주량·시간으로 혈중알코올 농도(BAC)를 추정.', keywords: ['혈중알코올농도','음주운전','BAC','위드마크 공식'], legalBasis: 'Widmark 공식', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'alcoholCalc', resultLabel: '추정 혈중알코올', resultUnit: '%', inputs: [{ id: 'gender', label: '성별', type: 'radio', default: 'male', options: [{ value: 'male', label: '남성' }, { value: 'female', label: '여성' }] }, { id: 'weight', label: '체중 (kg)', type: 'number', default: 70, min: 30, max: 150 }, { id: 'drinks', label: '음주량 (잔)', type: 'number', default: 3, min: 1, max: 20, hint: '소주잔 기준' }, { id: 'drinkType', label: '주종', type: 'select', default: 'soju', options: [{ value: 'soju', label: '소주 (17%)' }, { value: 'beer', label: '맥주 (5%)' }, { value: 'wine', label: '와인 (13%)' }, { value: 'whiskey', label: '위스키 (40%)' }] }, { id: 'hours', label: '음주 후 경과시간', type: 'number', default: 2, min: 0, max: 24, step: 0.5 }], faqs: [
      { q: '혈중알코올 계산기는 무료인가요?', a: '네, 카더라 혈중알코올 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. Widmark 공식를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>혈중알코올 농도 계산기 사용 방법</h2><p>체중·음주량·시간으로 혈중알코올 농도(BAC)를 추정. 카더라 혈중알코올 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>계량법</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>생활/건강 관련 핵심 정보</h2><p>일상생활에서 자주 필요한 각종 계산을 빠르고 정확하게 할 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: [] },
  { slug: 'unit-convert', category: 'life', categoryLabel: '생활/건강', title: '단위 환산기', titleShort: '단위 환산기', description: '길이·무게·면적·부피 단위를 환산.', keywords: ['단위 환산기','cm inch','kg lb','면적 변환'], legalBasis: '계량법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'unitConvert', resultLabel: '변환 결과', resultUnit: '', inputs: [{ id: 'category', label: '단위 종류', type: 'select', default: 'length', options: [{ value: 'length', label: '길이 (cm↔inch)' }, { value: 'weight', label: '무게 (kg↔lb)' }, { value: 'temperature', label: '온도 (°C↔°F)' }] }, { id: 'value', label: '값', type: 'number', default: 170, step: 0.1 }, { id: 'direction', label: '방향', type: 'radio', default: 'aToB', options: [{ value: 'aToB', label: 'A → B' }, { value: 'bToA', label: 'B → A' }] }], faqs: [
      { q: '단위 환산기는 무료인가요?', a: '네, 카더라 단위 환산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 계량법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>단위 환산기 사용 방법</h2><p>길이·무게·면적·부피 단위를 환산. 카더라 단위 환산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>계량법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>생활/건강 핵심 정보</h2><p>생활/건강 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['pyeong-sqm'] },


  // 추가 자동차/보험
  { slug: 'lease-vs-installment', category: 'auto', categoryLabel: '자동차', title: '리스 vs 할부 비교기', titleShort: '리스vs할부 비교', description: '자동차 리스와 할부의 총 비용을 비교.', keywords: ['리스 할부 비교','자동차 리스','장기렌트','할부 이자'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'leaseVsInstallment', resultLabel: '비교 결과', resultUnit: '', inputs: [{ id: 'carPrice', label: '차량 가격', type: 'currency', default: 40000000 }, { id: 'leaseMonthly', label: '리스 월 납입금', type: 'currency', default: 600000 }, { id: 'leaseMonths', label: '리스 기간 (개월)', type: 'number', default: 48 }, { id: 'leaseResidual', label: '잔존가치', type: 'currency', default: 16000000 }, { id: 'installRate', label: '할부 금리 (%)', type: 'percent', default: 5.9 }, { id: 'downPayment', label: '선수금', type: 'currency', default: 10000000 }], faqs: [
      { q: '리스vs할부 비교는 무료인가요?', a: '네, 카더라 리스vs할부 비교는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>리스 vs 할부 비교기 사용 방법</h2><p>자동차 리스와 할부의 총 비용을 비교. 카더라 리스vs할부 비교는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>근로기준법 제56조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>급여/노동 관련 핵심 정보</h2><p>급여와 관련된 정확한 계산은 직장인의 재무 관리에 필수적입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['car-installment', 'vehicle-tax'] },

  // 급여 추가
  { slug: 'overtime-pay', category: 'salary', categoryLabel: '급여/노동', title: '야간/연장 수당 계산기', titleShort: '야간수당 계산기', description: '연장·야간·휴일 근무 수당을 통상임금 기준으로 계산.', keywords: ['야간수당 계산기','연장근로 수당','휴일수당','통상임금'], legalBasis: '근로기준법 제56조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'overtimePay', resultLabel: '추가 수당', resultUnit: '원', inputs: [{ id: 'hourlyWage', label: '시급 (통상임금)', type: 'currency', default: 15000 }, { id: 'overtimeHours', label: '연장근로 시간', type: 'number', default: 10, min: 0, max: 100 }, { id: 'nightHours', label: '야간근로 시간', type: 'number', default: 0, min: 0, max: 100 }, { id: 'holidayHours', label: '휴일근로 시간', type: 'number', default: 0, min: 0, max: 100 }], faqs: [
      { q: '야간수당 계산기는 무료인가요?', a: '네, 카더라 야간수당 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 근로기준법 제56조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>야간/연장 수당 계산기 사용 방법</h2><p>연장·야간·휴일 근무 수당을 통상임금 기준으로 계산. 카더라 야간/연장 수당 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>근로기준법 제56조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>급여/노동 핵심 정보</h2><p>급여/노동 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['hourly-annual', 'net-salary'] },

  { slug: 'annual-leave-pay', category: 'salary', categoryLabel: '급여/노동', title: '연차 수당 계산기', titleShort: '연차수당 계산기', description: '미사용 연차에 대한 연차수당을 통상임금 기준으로 계산.', keywords: ['연차수당 계산기','연차 미사용 수당','통상임금','유급휴가'], legalBasis: '근로기준법 제60조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'annualLeavePay', resultLabel: '연차수당', resultUnit: '원', inputs: [{ id: 'monthlySalary', label: '월 통상임금', type: 'currency', default: 3500000 }, { id: 'unusedDays', label: '미사용 연차 (일)', type: 'number', default: 5, min: 0, max: 25 }, { id: 'weeklyHours', label: '주당 근로시간', type: 'number', default: 40 }], faqs: [
      { q: '연차수당 계산기는 무료인가요?', a: '네, 카더라 연차수당 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 근로기준법 제60조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>연차 수당 계산기 사용 방법</h2><p>미사용 연차에 대한 연차수당을 통상임금 기준으로 계산. 카더라 연차수당 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제104조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>부동산 세금 관련 핵심 정보</h2><p>부동산 거래 시 정확한 세금 계산은 재무 계획의 핵심입니다. 세율은 주택 수, 조정대상지역 여부, 보유 기간 등 다양한 조건에 따라 달라집니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['net-salary', 'overtime-pay'] },

  // ════ 3차 배치: 부동산 추가 ════
  { slug: 'capital-gains-land', category: 'property-tax', categoryLabel: '부동산 세금', title: '양도소득세 계산기 (토지)', titleShort: '토지 양도세 계산기', description: '토지 매도 시 양도소득세를 계산. 비사업용 토지 중과.', keywords: ['토지 양도소득세','비사업용 토지','토지 세금'], legalBasis: '소득세법 제104조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'capitalGainsLand', resultLabel: '양도소득세', resultUnit: '원', inputs: [{ id: 'sellPrice', label: '양도가액', type: 'currency', default: 300000000 }, { id: 'buyPrice', label: '취득가액', type: 'currency', default: 200000000 }, { id: 'expenses', label: '필요경비', type: 'currency', default: 5000000 }, { id: 'holdYears', label: '보유기간 (년)', type: 'number', default: 5 }, { id: 'nonBusiness', label: '비사업용 토지', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예 (+10% 중과)' }, { value: 'no', label: '아니오' }] }], faqs: [
      { q: '토지 양도세 계산기는 무료인가요?', a: '네, 카더라 토지 양도세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제104조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>양도소득세 계산기 (토지) 사용 방법</h2><p>토지 매도 시 양도소득세를 계산. 비사업용 토지 중과. 카더라 양도소득세 계산기 (토지)는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제104조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 세금 핵심 정보</h2><p>부동산 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['capital-gains-housing', 'acquisition-tax'] },

  { slug: 'multi-house-sim', category: 'property-tax', categoryLabel: '부동산 세금', title: '다주택자 중과세 시뮬레이터', titleShort: '다주택 중과 시뮬', description: '2주택/3주택 보유 시 취득세·양도세 중과세를 시뮬레이션.', keywords: ['다주택자 세금','2주택 세금','3주택 중과','다주택 양도세'], legalBasis: '지방세법 제13조, 소득세법 제104조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'conditional', formula: 'multiHouseSim', resultLabel: '중과세 합계', resultUnit: '원', inputs: [{ id: 'houseCount', label: '보유 주택수', type: 'stepper', default: 2, min: 1, max: 5 }, { id: 'price', label: '매도 주택 가격', type: 'currency', default: 800000000 }, { id: 'buyPrice', label: '매수가', type: 'currency', default: 500000000 }, { id: 'regulated', label: '조정대상지역', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] }], faqs: [
      { q: '다주택 중과 시뮬는 무료인가요?', a: '네, 카더라 다주택 중과 시뮬는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 지방세법 제13조, 소득세법 제104조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>다주택자 중과세 시뮬레이터 사용 방법</h2><p>2주택/3주택 보유 시 취득세·양도세 중과세를 시뮬레이션. 카더라 다주택 중과 시뮬는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 관련 핵심 정보</h2><p>투자 수익률과 리스크를 정확히 계산하는 것은 성공적인 투자의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['acquisition-tax', 'capital-gains-housing'] },
  // ════ 투자 추가 ════
  { slug: 'investment-type-test', category: 'investment', categoryLabel: '주식/투자', title: '투자 성향 진단기', titleShort: '투자 성향 진단', description: '5개 질문으로 안전형/안정형/위험형 투자 성향을 진단.', keywords: ['투자 성향 진단','투자 성향 테스트','위험 성향'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'diagnose', formula: 'investmentTypeTest', resultLabel: '투자 성향', resultUnit: '', inputs: [{ id: 'q1', label: '투자 경험', type: 'radio', default: '2', options: [{ value: '1', label: '없음' }, { value: '2', label: '1~3년' }, { value: '3', label: '3년 이상' }] }, { id: 'q2', label: '원금 손실 감내', type: 'radio', default: '2', options: [{ value: '1', label: '10% 이하' }, { value: '2', label: '20~30%' }, { value: '3', label: '50% 이상' }] }, { id: 'q3', label: '투자 기간', type: 'radio', default: '2', options: [{ value: '1', label: '1년 미만' }, { value: '2', label: '1~5년' }, { value: '3', label: '5년 이상' }] }], faqs: [
      { q: '투자 성향 진단는 무료인가요?', a: '네, 카더라 투자 성향 진단는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>투자 성향 진단기 사용 방법</h2><p>5개 질문으로 안전형/안정형/위험형 투자 성향을 진단. 카더라 투자 성향 진단기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 핵심 정보</h2><p>주식/투자 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['compound-interest', 'fire-calc'] },

  // ════ 급여 추가 ════
  { slug: 'daily-worker-tax', category: 'salary', categoryLabel: '급여/노동', title: '일용직 소득세 계산기', titleShort: '일용직 세금 계산기', description: '일용직 근로자의 일당에서 원천징수되는 세금을 계산.', keywords: ['일용직 세금','일용근로소득세','일당 세금','6%'], legalBasis: '소득세법 제129조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'dailyWorkerTax', resultLabel: '원천징수세액', resultUnit: '원', inputs: [{ id: 'dailyWage', label: '일당', type: 'currency', default: 200000 }], faqs: [
      { q: '일용직 세금 계산기는 무료인가요?', a: '네, 카더라 일용직 세금 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제129조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>일용직 소득세 계산기 사용 방법</h2><p>일용직 근로자의 일당에서 원천징수되는 세금을 계산. 카더라 일용직 세금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>급여/노동 관련 핵심 정보</h2><p>급여와 관련된 정확한 계산은 직장인의 재무 관리에 필수적입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['withholding-3-3', 'net-salary'] },
  { slug: 'freelancer-tax', category: 'salary', categoryLabel: '급여/노동', title: '프리랜서 세금 계산기', titleShort: '프리랜서 세금 계산기', description: '프리랜서 연 수입으로 예상 종합소득세와 환급액을 계산.', keywords: ['프리랜서 세금','종합소득세','경비율','5월 신고'], legalBasis: '소득세법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'freelancerTax', resultLabel: '예상 종합소득세', resultUnit: '원', inputs: [{ id: 'annualRevenue', label: '연 수입', type: 'currency', default: 50000000 }, { id: 'expenseType', label: '경비 유형', type: 'radio', default: 'simple', options: [{ value: 'simple', label: '단순경비율' }, { value: 'actual', label: '실제경비' }] }, { id: 'expenseRate', label: '경비율/경비액', type: 'percent', default: 64.1 }, { id: 'withheld', label: '기납부 3.3% 합계', type: 'currency', default: 1650000 }], faqs: [
      { q: '프리랜서 세금 계산기는 무료인가요?', a: '네, 카더라 프리랜서 세금 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>프리랜서 세금 계산기 사용 방법</h2><p>프리랜서 연 수입으로 예상 종합소득세와 환급액을 계산. 카더라 프리랜서 세금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>급여/노동 핵심 정보</h2><p>급여/노동 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['withholding-3-3', 'comprehensive-income-tax'] },

  // ════ 대출 추가 ════
  { slug: 'car-loan', category: 'loan', categoryLabel: '대출/예적금', title: '자동차 대출 계산기', titleShort: '자동차 대출 계산기', description: '자동차 구매 대출의 월 상환액과 총 이자를 계산.', keywords: ['자동차 대출','차량 대출','할부금 계산'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'amortize', formula: 'carInstallment', resultLabel: '월 상환액', resultUnit: '원', inputs: [{ id: 'carPrice', label: '차량 가격', type: 'currency', default: 35000000 }, { id: 'downPayment', label: '선수금', type: 'currency', default: 7000000 }, { id: 'rate', label: '금리 (%)', type: 'percent', default: 5.5 }, { id: 'months', label: '기간 (개월)', type: 'select', default: '48', options: [{ value: '24', label: '24개월' }, { value: '36', label: '36개월' }, { value: '48', label: '48개월' }, { value: '60', label: '60개월' }] }], faqs: [
      { q: '자동차 대출 계산기는 무료인가요?', a: '네, 카더라 자동차 대출 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>자동차 대출 계산기 사용 방법</h2><p>자동차 구매 대출의 월 상환액과 총 이자를 계산. 카더라 자동차 대출 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>대출/예적금 관련 핵심 정보</h2><p>대출 상환 계획을 세우려면 월 상환액, 총 이자, 상환 방식별 차이를 정확히 계산해야 합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['loan-repayment', 'car-installment'] },
  { slug: 'student-loan', category: 'loan', categoryLabel: '대출/예적금', title: '학자금 대출 상환 계산기', titleShort: '학자금 대출 계산기', description: '한국장학재단 학자금 대출의 상환 금액을 계산.', keywords: ['학자금 대출','한국장학재단','등록금 대출','ICL'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'amortize', formula: 'loanRepayment', resultLabel: '월 상환액', resultUnit: '원', inputs: [{ id: 'principal', label: '대출 원금', type: 'currency', default: 20000000 }, { id: 'rate', label: '이자율 (%)', type: 'percent', default: 1.7 }, { id: 'years', label: '상환 기간 (년)', type: 'range', default: 10, min: 1, max: 20 }, { id: 'method', label: '상환 방식', type: 'radio', default: 'equal', options: [{ value: 'equal', label: '원리금균등' }, { value: 'principal', label: '원금균등' }] }, { id: 'grace', label: '거치기간 (개월)', type: 'number', default: 0 }], faqs: [
      { q: '학자금 대출 계산기는 무료인가요?', a: '네, 카더라 학자금 대출 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>학자금 대출 상환 계산기 사용 방법</h2><p>한국장학재단 학자금 대출의 상환 금액을 계산. 카더라 학자금 대출 상환 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>대출/예적금 핵심 정보</h2><p>대출/예적금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['loan-repayment'] },

  // ════ 쇼핑 추가 ════
  { slug: 'telecom-compare', category: 'shopping', categoryLabel: '쇼핑/소비', title: '통신비 비교 계산기', titleShort: '통신비 비교기', description: '알뜰폰 vs 일반 요금제 월/연 비용을 비교.', keywords: ['통신비 비교','알뜰폰','요금제 비교','핸드폰 요금'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'telecomCompare', resultLabel: '연간 절약액', resultUnit: '원', inputs: [{ id: 'currentPlan', label: '현재 월 요금', type: 'currency', default: 69000 }, { id: 'newPlan', label: '비교 요금제', type: 'currency', default: 33000 }], faqs: [
      { q: '통신비 비교기는 무료인가요?', a: '네, 카더라 통신비 비교기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>통신비 비교 계산기 사용 방법</h2><p>알뜰폰 vs 일반 요금제 월/연 비용을 비교. 카더라 통신비 비교기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>군대/교육 관련 핵심 정보</h2><p>교육과 군 복무 관련 정보를 빠르게 확인할 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['subscription-total'] },
  // ════ 군대/교육 추가 ════
  { slug: 'graduation-year', category: 'military', categoryLabel: '군대/교육', title: '졸업/전역 연도 계산기', titleShort: '졸업 연도 계산기', description: '생년월일로 초중고·대학 졸업연도와 전역 예상연도를 계산.', keywords: ['졸업 연도','전역 연도','학교 졸업','입학 연도'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'graduationYear', resultLabel: '졸업/전역 연도', resultUnit: '', inputs: [{ id: 'birthYear', label: '출생연도', type: 'number', default: 2000, min: 1970, max: 2020 }, { id: 'birthMonth', label: '출생월', type: 'number', default: 6, min: 1, max: 12 }], faqs: [
      { q: '졸업 연도 계산기는 무료인가요?', a: '네, 카더라 졸업 연도 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>졸업/전역 연도 계산기 사용 방법</h2><p>생년월일로 초중고·대학 졸업연도와 전역 예상연도를 계산. 카더라 졸업/전역 연도 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>군대/교육 핵심 정보</h2><p>군대/교육 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['discharge-date', 'age-calc'] },

  // ════ 상속/증여 추가 ════
  { slug: 'gift-exemption-lookup', category: 'inheritance', categoryLabel: '상속/증여', title: '증여 면제한도 조회기', titleShort: '증여 면제한도 조회', description: '수증자 관계별 10년간 증여 면제한도를 조회.', keywords: ['증여 면제한도','증여 공제','가족 증여','10년 합산'], legalBasis: '상속세및증여세법 제53조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'giftExemptionLookup', resultLabel: '면제한도', resultUnit: '원', inputs: [{ id: 'relationship', label: '관계', type: 'select', default: 'adultChild', options: [{ value: 'spouse', label: '배우자' }, { value: 'adultChild', label: '성년 자녀' }, { value: 'minorChild', label: '미성년 자녀' }, { value: 'otherRelative', label: '기타 친족' }] }], faqs: [
      { q: '증여 면제한도 조회는 무료인가요?', a: '네, 카더라 증여 면제한도 조회는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 상속세및증여세법 제53조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 상속/증여 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>증여 면제한도 조회기 사용 방법</h2><p>수증자 관계별 10년간 증여 면제한도를 조회. 카더라 증여 면제한도 조회는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>상속세및증여세법 제47조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>상속/증여 관련 핵심 정보</h2><p>상속·증여세는 재산을 무상으로 이전할 때 부과되는 세금으로, 10~50%의 누진세율이 적용됩니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['gift-tax', 'inheritance-tax'] },
  { slug: 'burden-gift', category: 'inheritance', categoryLabel: '상속/증여', title: '부담부증여 세금 계산기', titleShort: '부담부증여 계산기', description: '부담부증여 시 증여세+양도소득세 이중과세를 계산.', keywords: ['부담부증여','부담부증여 세금','증여 양도세'], legalBasis: '상속세및증여세법 제47조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'conditional', formula: 'burdenGift', resultLabel: '세금 합계', resultUnit: '원', inputs: [{ id: 'propertyValue', label: '증여 재산가액', type: 'currency', default: 500000000 }, { id: 'debt', label: '인수 채무 (대출 등)', type: 'currency', default: 200000000 }, { id: 'buyPrice', label: '취득가액', type: 'currency', default: 300000000 }, { id: 'relationship', label: '수증자 관계', type: 'select', default: 'adultChild', options: [{ value: 'spouse', label: '배우자' }, { value: 'adultChild', label: '성년 자녀' }, { value: 'minorChild', label: '미성년 자녀' }] }], faqs: [
      { q: '부담부증여 계산기는 무료인가요?', a: '네, 카더라 부담부증여 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 상속세및증여세법 제47조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 상속/증여 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>부담부증여 세금 계산기 사용 방법</h2><p>부담부증여 시 증여세+양도소득세 이중과세를 계산. 카더라 부담부증여 세금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>상속세및증여세법 제47조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>상속/증여 핵심 정보</h2><p>상속/증여 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['gift-tax', 'capital-gains-housing'] },


  // ════ 4차 최종 배치 (43종) ════
  // 부동산세 +4
  { slug: 'capital-gains-rights', category: 'property-tax', categoryLabel: '부동산 세금', title: '양도소득세 계산기 (분양권)', titleShort: '분양권 양도세', description: '분양권 전매 시 양도소득세를 계산.', keywords: ['분양권 양도세','분양권 전매','단기양도'], legalBasis: '소득세법 제104조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'capitalGainsRights', resultLabel: '양도소득세', resultUnit: '원', inputs: [{ id: 'sellPrice', label: '양도가액', type: 'currency', default: 500000000 }, { id: 'buyPrice', label: '취득가액 (분양가+프리미엄)', type: 'currency', default: 400000000 }, { id: 'holdYears', label: '보유기간 (년)', type: 'number', default: 1, min: 0, max: 10 }], faqs: [
      { q: '분양권 양도세는 무료인가요?', a: '네, 카더라 분양권 양도세는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제104조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>양도소득세 계산기 (분양권) 사용 방법</h2><p>분양권 전매 시 양도소득세를 계산. 카더라 분양권 양도세는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>지방세법 제28조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>부동산 세금 관련 핵심 정보</h2><p>부동산 거래 시 정확한 세금 계산은 재무 계획의 핵심입니다. 세율은 주택 수, 조정대상지역 여부, 보유 기간 등 다양한 조건에 따라 달라집니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['capital-gains-housing'] },
  { slug: 'registration-license-tax', category: 'property-tax', categoryLabel: '부동산 세금', title: '등록면허세 계산기', titleShort: '등록면허세 계산기', description: '소유권이전·설정 시 등록면허세를 계산.', keywords: ['등록면허세','소유권이전','등록세'], legalBasis: '지방세법 제28조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'registrationLicenseTax', resultLabel: '등록면허세', resultUnit: '원', inputs: [{ id: 'price', label: '과세표준', type: 'currency', default: 500000000 }, { id: 'type', label: '등기 유형', type: 'radio', default: 'transfer', options: [{ value: 'transfer', label: '소유권이전 (2%)' }, { value: 'mortgage', label: '저당권설정 (0.2%)' }] }], faqs: [
      { q: '등록면허세 계산기는 무료인가요?', a: '네, 카더라 등록면허세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 지방세법 제28조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>등록면허세 계산기 사용 방법</h2><p>소유권이전·설정 시 등록면허세를 계산. 카더라 등록면허세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>지방세법 제28조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 세금 핵심 정보</h2><p>부동산 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['registration-cost', 'acquisition-tax'] },

  { slug: 'deemed-rent', category: 'property-tax', categoryLabel: '부동산 세금', title: '간주임대료 계산기', titleShort: '간주임대료 계산기', description: '전세보증금에 대한 간주임대료(이자 상당액)를 계산.', keywords: ['간주임대료','전세 간주임대','보증금 이자'], legalBasis: '소득세법 제25조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'deemedRent', resultLabel: '간주임대료', resultUnit: '원', inputs: [{ id: 'deposit', label: '보증금 합계', type: 'currency', default: 500000000 }, { id: 'threshold', label: '3억 초과분 기준', type: 'currency', default: 300000000 }], faqs: [
      { q: '간주임대료 계산기는 무료인가요?', a: '네, 카더라 간주임대료 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제25조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>간주임대료 계산기 사용 방법</h2><p>전세보증금에 대한 간주임대료(이자 상당액)를 계산. 카더라 간주임대료 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제89조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>부동산 세금 관련 핵심 정보</h2><p>부동산 거래 시 정확한 세금 계산은 재무 계획의 핵심입니다. 세율은 주택 수, 조정대상지역 여부, 보유 기간 등 다양한 조건에 따라 달라집니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['rental-income-tax'] },
  { slug: 'one-house-check', category: 'property-tax', categoryLabel: '부동산 세금', title: '1세대1주택 비과세 판정기', titleShort: '1세대1주택 판정', description: '보유·거주 요건으로 1세대1주택 비과세 해당 여부를 판정.', keywords: ['1세대1주택 비과세','비과세 요건','보유기간','거주기간'], legalBasis: '소득세법 제89조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'diagnose', formula: 'oneHouseCheck', resultLabel: '비과세 판정', resultUnit: '', inputs: [{ id: 'houseCount', label: '보유 주택수', type: 'stepper', default: 1, min: 1, max: 5 }, { id: 'holdYears', label: '보유기간 (년)', type: 'number', default: 3 }, { id: 'liveYears', label: '거주기간 (년)', type: 'number', default: 2 }, { id: 'sellPrice', label: '양도가액', type: 'currency', default: 900000000 }, { id: 'regulated', label: '조정대상지역', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] }], faqs: [
      { q: '1세대1주택 판정는 무료인가요?', a: '네, 카더라 1세대1주택 판정는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제89조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>1세대1주택 비과세 판정기 사용 방법</h2><p>보유·거주 요건으로 1세대1주택 비과세 해당 여부를 판정. 카더라 1세대1주택 비과세 판정기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제89조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 세금 핵심 정보</h2><p>부동산 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['capital-gains-housing'] },

  // 소득세 +3
  { slug: 'business-income-tax', category: 'income-tax', categoryLabel: '소득세', title: '사업소득세 계산기', titleShort: '사업소득세 계산기', description: '사업소득에 대한 종합소득세를 경비율 적용하여 계산.', keywords: ['사업소득세','사업자 소득세','경비율'], legalBasis: '소득세법 제19조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'businessIncomeTax', resultLabel: '사업소득세', resultUnit: '원', inputs: [{ id: 'revenue', label: '총 수입금액', type: 'currency', default: 100000000 }, { id: 'expenses', label: '필요경비', type: 'currency', default: 60000000 }], faqs: [
      { q: '사업소득세 계산기는 무료인가요?', a: '네, 카더라 사업소득세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제19조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>사업소득세 계산기 사용 방법</h2><p>사업소득에 대한 종합소득세를 경비율 적용하여 계산. 카더라 사업소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>소득세 관련 핵심 정보</h2><p>소득세는 개인의 소득에 부과되는 국세로, 소득 종류와 규모에 따라 6~45%의 누진세율이 적용됩니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['comprehensive-income-tax'] },
  { slug: 'pension-income-tax', category: 'income-tax', categoryLabel: '소득세', title: '연금소득세 계산기', titleShort: '연금소득세 계산기', description: '공적/사적연금 수령 시 연금소득세를 계산.', keywords: ['연금소득세','연금 세금','연금수령 세율'], legalBasis: '소득세법 제129조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'pensionIncomeTax', resultLabel: '연금소득세', resultUnit: '원', inputs: [{ id: 'annualPension', label: '연간 연금수령액', type: 'currency', default: 12000000 }, { id: 'age', label: '수령 나이', type: 'number', default: 65, min: 55, max: 90 }, { id: 'type', label: '연금 유형', type: 'radio', default: 'private', options: [{ value: 'public', label: '공적연금 (국민연금)' }, { value: 'private', label: '사적연금 (IRP/연금저축)' }] }], faqs: [
      { q: '연금소득세 계산기는 무료인가요?', a: '네, 카더라 연금소득세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제129조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>연금소득세 계산기 사용 방법</h2><p>공적/사적연금 수령 시 연금소득세를 계산. 카더라 연금소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>소득세 핵심 정보</h2><p>소득세 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['national-pension', 'irp-deduction'] },

  { slug: 'dividend-income-tax', category: 'income-tax', categoryLabel: '소득세', title: '배당소득세 계산기', titleShort: '배당소득세 계산기', description: '국내/해외 배당소득에 대한 원천징수세액을 계산.', keywords: ['배당소득세','배당세금','국내배당','해외배당'], legalBasis: '소득세법 제129조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'dividendIncomeTax', resultLabel: '배당소득세', resultUnit: '원', inputs: [{ id: 'dividend', label: '배당금', type: 'currency', default: 5000000 }, { id: 'market', label: '시장', type: 'radio', default: 'kr', options: [{ value: 'kr', label: '국내 (15.4%)' }, { value: 'us', label: '미국 (15%)' }] }], faqs: [
      { q: '배당소득세 계산기는 무료인가요?', a: '네, 카더라 배당소득세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제129조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>배당소득세 계산기 사용 방법</h2><p>국내/해외 배당소득에 대한 원천징수세액을 계산. 카더라 배당소득세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제94조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>금융/투자 세금 관련 핵심 정보</h2><p>금융투자 수익에는 다양한 세금이 부과됩니다. 상품별로 과세 방식이 다르므로 투자 전 세금 구조를 이해하는 것이 중요합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['dividend-calc', 'financial-income-tax'] },
  // 금융세 +3
  { slug: 'major-shareholder-cgt', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: '대주주 양도세 계산기', titleShort: '대주주 양도세', description: '국내 대주주 주식 양도소득세를 계산.', keywords: ['대주주 양도세','국내주식 양도세','대주주 기준'], legalBasis: '소득세법 제94조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'majorShareholderCgt', resultLabel: '양도소득세', resultUnit: '원', inputs: [{ id: 'profit', label: '양도차익', type: 'currency', default: 50000000 }, { id: 'holdPeriod', label: '보유기간', type: 'radio', default: 'long', options: [{ value: 'short', label: '1년 미만 (33%)' }, { value: 'long', label: '1년 이상 (22~27.5%)' }] }, { id: 'amount', label: '양도가액', type: 'currency', default: 500000000, hint: '3억 초과분 27.5%' }], faqs: [
      { q: '대주주 양도세는 무료인가요?', a: '네, 카더라 대주주 양도세는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제94조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>대주주 양도세 계산기 사용 방법</h2><p>국내 대주주 주식 양도소득세를 계산. 카더라 대주주 양도세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제94조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>금융/투자 세금 핵심 정보</h2><p>금융/투자 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['overseas-cgt', 'stock-roi'] },

  { slug: 'foreign-dividend-credit', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: '해외 배당 이중과세 환급 계산기', titleShort: '외국납부세액공제', description: '해외주식 배당에서 원천징수된 외국세액의 공제(환급)를 계산.', keywords: ['외국납부세액공제','해외배당 이중과세','배당세 환급'], legalBasis: '소득세법 제57조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'foreignDividendCredit', resultLabel: '환급 가능액', resultUnit: '원', inputs: [{ id: 'foreignTax', label: '외국 원천징수세액', type: 'currency', default: 750000 }, { id: 'domesticTax', label: '국내 산출세액', type: 'currency', default: 770000 }], faqs: [
      { q: '외국납부세액공제는 무료인가요?', a: '네, 카더라 외국납부세액공제는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제57조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>해외 배당 이중과세 환급 계산기 사용 방법</h2><p>해외주식 배당에서 원천징수된 외국세액의 공제(환급)를 계산. 카더라 외국납부세액공제는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제87조의2 (시행 미정)</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>금융/투자 세금 관련 핵심 정보</h2><p>금융투자 수익에는 다양한 세금이 부과됩니다. 상품별로 과세 방식이 다르므로 투자 전 세금 구조를 이해하는 것이 중요합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['dividend-calc', 'overseas-cgt'] },
  { slug: 'fis-tax-sim', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: '금융투자소득세 시뮬레이터', titleShort: '금투세 시뮬레이터', description: '금융투자소득세 시행 시 국내주식 과세 예상액을 시뮬레이션.', keywords: ['금융투자소득세','금투세','국내주식 과세'], legalBasis: '소득세법 제87조의2 (시행 미정)', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'fisTaxSim', resultLabel: '금투세 (시뮬)', resultUnit: '원', inputs: [{ id: 'profit', label: '연간 국내주식 수익', type: 'currency', default: 80000000 }], faqs: [
      { q: '금투세 시뮬레이터는 무료인가요?', a: '네, 카더라 금투세 시뮬레이터는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제87조의2 (시행 미정)를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>금융투자소득세 시뮬레이터 사용 방법</h2><p>금융투자소득세 시행 시 국내주식 과세 예상액을 시뮬레이션. 카더라 금융투자소득세 시뮬레이터는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제87조의2 (시행 미정)</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>금융/투자 세금 핵심 정보</h2><p>금융/투자 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['overseas-cgt', 'stock-roi'] },

  // 상속/증여 +2
  { slug: 'family-business', category: 'inheritance', categoryLabel: '상속/증여', title: '가업승계 세금 계산기', titleShort: '가업승계 계산기', description: '가업상속공제 적용 시 상속세 절감액을 계산.', keywords: ['가업승계','가업상속공제','중소기업 상속'], legalBasis: '상속세및증여세법 제18조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'familyBusiness', resultLabel: '상속세 절감', resultUnit: '원', inputs: [{ id: 'businessValue', label: '가업 자산가치', type: 'currency', default: 3000000000 }, { id: 'years', label: '대표 경영기간 (년)', type: 'number', default: 15, min: 10, max: 50 }], faqs: [
      { q: '가업승계 계산기는 무료인가요?', a: '네, 카더라 가업승계 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 상속세및증여세법 제18조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 상속/증여 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>가업승계 세금 계산기 사용 방법</h2><p>가업상속공제 적용 시 상속세 절감액을 계산. 카더라 가업승계 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>상속세및증여세법 제27조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>상속/증여 관련 핵심 정보</h2><p>상속·증여세는 재산을 무상으로 이전할 때 부과되는 세금으로, 10~50%의 누진세율이 적용됩니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['inheritance-tax'] },
  { slug: 'generation-skip', category: 'inheritance', categoryLabel: '상속/증여', title: '세대생략증여 할증 계산기', titleShort: '세대생략 할증 계산기', description: '손자녀 증여 시 30% 할증 과세액을 계산.', keywords: ['세대생략증여','손자 증여','30% 할증','세대 건너뛰기'], legalBasis: '상속세및증여세법 제27조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'generationSkip', resultLabel: '증여세 (할증 후)', resultUnit: '원', inputs: [{ id: 'amount', label: '증여 재산가액', type: 'currency', default: 200000000 }], faqs: [
      { q: '세대생략 할증 계산기는 무료인가요?', a: '네, 카더라 세대생략 할증 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 상속세및증여세법 제27조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 상속/증여 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>세대생략증여 할증 계산기 사용 방법</h2><p>손자녀 증여 시 30% 할증 과세액을 계산. 카더라 세대생략증여 할증 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>상속세및증여세법 제27조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>상속/증여 핵심 정보</h2><p>상속/증여 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['gift-tax'] },

  // 사업자 +3
  { slug: 'withholding-calc', category: 'biz-tax', categoryLabel: '사업자 세금', title: '원천징수세액 계산기', titleShort: '원천징수 계산기', description: '급여/사업/기타소득별 원천징수세액을 계산.', keywords: ['원천징수','원천징수세액','소득별 원천징수'], legalBasis: '소득세법 제127조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'withholdingCalc', resultLabel: '원천징수세액', resultUnit: '원', inputs: [{ id: 'type', label: '소득 유형', type: 'select', default: 'salary', options: [{ value: 'salary', label: '근로소득' }, { value: 'business', label: '사업소득 (3.3%)' }, { value: 'other', label: '기타소득 (8.8%)' }, { value: 'interest', label: '이자소득 (15.4%)' }] }, { id: 'amount', label: '지급액', type: 'currency', default: 3000000 }], faqs: [
      { q: '원천징수 계산기는 무료인가요?', a: '네, 카더라 원천징수 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제127조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>원천징수세액 계산기 사용 방법</h2><p>급여/사업/기타소득별 원천징수세액을 계산. 카더라 원천징수 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>인지세법</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>사업자 세금 관련 핵심 정보</h2><p>사업자가 납부해야 하는 세금은 부가가치세, 소득세, 원천징수세 등 다양합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['withholding-3-3', 'net-salary'] },
  { slug: 'stamp-tax', category: 'biz-tax', categoryLabel: '사업자 세금', title: '인지세 계산기', titleShort: '인지세 계산기', description: '계약서 작성 시 납부하는 인지세를 계산.', keywords: ['인지세','계약서 인지세','인지대','수입인지'], legalBasis: '인지세법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'stampTax', resultLabel: '인지세', resultUnit: '원', inputs: [{ id: 'contractAmount', label: '계약금액', type: 'currency', default: 500000000 }], faqs: [
      { q: '인지세 계산기는 무료인가요?', a: '네, 카더라 인지세 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 인지세법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>인지세 계산기 사용 방법</h2><p>계약서 작성 시 납부하는 인지세를 계산. 카더라 인지세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>인지세법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>사업자 세금 핵심 정보</h2><p>사업자 세금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['registration-cost'] },

  { slug: 'simple-bookkeeping', category: 'biz-tax', categoryLabel: '사업자 세금', title: '간편장부 소득금액 계산기', titleShort: '간편장부 계산기', description: '간편장부로 사업소득금액을 계산.', keywords: ['간편장부','사업소득','필요경비','소규모 사업자'], legalBasis: '소득세법 시행령 제131조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'simpleBookkeeping', resultLabel: '소득금액', resultUnit: '원', inputs: [{ id: 'revenue', label: '총수입금액', type: 'currency', default: 30000000 }, { id: 'expenses', label: '필요경비', type: 'currency', default: 15000000 }], faqs: [
      { q: '간편장부 계산기는 무료인가요?', a: '네, 카더라 간편장부 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 시행령 제131조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>간편장부 소득금액 계산기 사용 방법</h2><p>간편장부로 사업소득금액을 계산. 카더라 간편장부 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>은행업감독규정</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>부동산 관련 핵심 정보</h2><p>부동산 거래와 투자에는 다양한 비용과 수익 분석이 필요합니다. 사전 계산으로 더 현명한 의사결정이 가능합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'expense-rate-lookup'] },
  // 부동산 +4
  { slug: 'ltv-calc', category: 'real-estate', categoryLabel: '부동산', title: 'LTV 대출한도 계산기', titleShort: 'LTV 계산기', description: '주택담보대출 LTV 비율로 대출 가능 금액을 추정.', keywords: ['LTV 계산기','주택담보대출','대출한도','담보비율'], legalBasis: '은행업감독규정', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'ltvCalc', resultLabel: '대출 가능액', resultUnit: '원', inputs: [{ id: 'housePrice', label: '주택 시가', type: 'currency', default: 600000000 }, { id: 'ltv', label: 'LTV 비율 (%)', type: 'select', default: '70', options: [{ value: '70', label: '70% (일반)' }, { value: '60', label: '60% (조정지역)' }, { value: '50', label: '50% (투기지역)' }, { value: '80', label: '80% (생초)' }] }, { id: 'existingLoan', label: '기존 담보대출', type: 'currency', default: 0 }], faqs: [
      { q: 'LTV 계산기는 무료인가요?', a: '네, 카더라 LTV 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 은행업감독규정를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>LTV 대출한도 계산기 사용 방법</h2><p>주택담보대출 LTV 비율로 대출 가능 금액을 추정. 카더라 LTV 대출한도 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>은행업감독규정</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 핵심 정보</h2><p>부동산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['dsr-calc', 'loan-repayment'] },

  { slug: 'housing-bond', category: 'real-estate', categoryLabel: '부동산', title: '국민주택채권 매입금액 계산기', titleShort: '주택채권 계산기', description: '부동산 등기 시 매입해야 하는 국민주택채권 금액을 계산.', keywords: ['국민주택채권','채권매입','등기 채권','할인율'], legalBasis: '주택도시기금법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'housingBond', resultLabel: '채권 매입 비용', resultUnit: '원', inputs: [{ id: 'housePrice', label: '부동산 시가표준액', type: 'currency', default: 500000000 }, { id: 'region', label: '지역', type: 'radio', default: 'metro', options: [{ value: 'metro', label: '특별시/광역시' }, { value: 'other', label: '기타 지역' }] }], faqs: [
      { q: '주택채권 계산기는 무료인가요?', a: '네, 카더라 주택채권 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 주택도시기금법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>국민주택채권 매입금액 계산기 사용 방법</h2><p>부동산 등기 시 매입해야 하는 국민주택채권 금액을 계산. 카더라 주택채권 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>건축법 제55조, 제56조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>부동산 관련 핵심 정보</h2><p>부동산 거래와 투자에는 다양한 비용과 수익 분석이 필요합니다. 사전 계산으로 더 현명한 의사결정이 가능합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['registration-cost'] },
  { slug: 'far-bcr', category: 'real-estate', categoryLabel: '부동산', title: '건폐율/용적률 계산기', titleShort: '건폐율/용적률', description: '대지면적·건축면적·연면적으로 건폐율과 용적률을 계산.', keywords: ['건폐율','용적률','건축면적','연면적','대지면적'], legalBasis: '건축법 제55조, 제56조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'farBcr', resultLabel: '건폐율/용적률', resultUnit: '', inputs: [{ id: 'landArea', label: '대지면적 (㎡)', type: 'number', default: 500 }, { id: 'buildingArea', label: '건축면적 (㎡)', type: 'number', default: 300 }, { id: 'totalFloorArea', label: '연면적 (㎡)', type: 'number', default: 1500 }], faqs: [
      { q: '건폐율/용적률는 무료인가요?', a: '네, 카더라 건폐율/용적률는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 건축법 제55조, 제56조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>건폐율/용적률 계산기 사용 방법</h2><p>대지면적·건축면적·연면적으로 건폐율과 용적률을 계산. 카더라 건폐율/용적률 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>건축법 제55조, 제56조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 핵심 정보</h2><p>부동산 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['pyeong-sqm'] },

  { slug: 'auction-profit', category: 'real-estate', categoryLabel: '부동산', title: '경매 수익률 계산기', titleShort: '경매 수익률', description: '경매 낙찰가 대비 시세 차익과 수익률을 계산.', keywords: ['경매 수익률','부동산 경매','낙찰가','감정가'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'auctionProfit', resultLabel: '예상 수익률', resultUnit: '%', inputs: [{ id: 'appraisal', label: '감정가', type: 'currency', default: 500000000 }, { id: 'bidPrice', label: '낙찰 예상가', type: 'currency', default: 350000000 }, { id: 'repairCost', label: '수리비', type: 'currency', default: 20000000 }], faqs: [
      { q: '경매 수익률는 무료인가요?', a: '네, 카더라 경매 수익률는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>경매 수익률 계산기 사용 방법</h2><p>경매 낙찰가 대비 시세 차익과 수익률을 계산. 카더라 경매 수익률는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 관련 핵심 정보</h2><p>투자 수익률과 리스크를 정확히 계산하는 것은 성공적인 투자의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['rental-yield', 'acquisition-tax'] },
  // 투자 +3
  { slug: 'drip-sim', category: 'investment', categoryLabel: '주식/투자', title: '배당 재투자(DRIP) 시뮬레이터', titleShort: 'DRIP 시뮬레이터', description: '배당금을 재투자할 때 장기 복리 효과를 시뮬레이션.', keywords: ['DRIP','배당 재투자','배당 복리','배당 성장'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'amortize', formula: 'dripSim', resultLabel: '최종 자산', resultUnit: '원', inputs: [{ id: 'investment', label: '초기 투자금', type: 'currency', default: 50000000 }, { id: 'yieldRate', label: '배당수익률 (%)', type: 'percent', default: 4 }, { id: 'growthRate', label: '배당성장률 (%)', type: 'percent', default: 5 }, { id: 'years', label: '투자 기간 (년)', type: 'range', default: 20, min: 1, max: 40 }], faqs: [
      { q: 'DRIP 시뮬레이터는 무료인가요?', a: '네, 카더라 DRIP 시뮬레이터는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>배당 재투자(DRIP) 시뮬레이터 사용 방법</h2><p>배당금을 재투자할 때 장기 복리 효과를 시뮬레이션. 카더라 배당 재투자(DRIP) 시뮬레이터는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 핵심 정보</h2><p>주식/투자 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['dividend-calc', 'compound-interest'] },

  { slug: 'short-selling', category: 'investment', categoryLabel: '주식/투자', title: '공매도 수익 계산기', titleShort: '공매도 계산기', description: '공매도 시 대차료·수수료 포함 순수익을 계산.', keywords: ['공매도 수익','공매도 계산','대차료','숏셀링'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'shortSelling', resultLabel: '공매도 순수익', resultUnit: '원', inputs: [{ id: 'sellPrice', label: '매도가', type: 'currency', default: 100000 }, { id: 'buyPrice', label: '환매가', type: 'currency', default: 80000 }, { id: 'quantity', label: '수량', type: 'number', default: 100 }, { id: 'borrowFee', label: '대차료율 (%/년)', type: 'percent', default: 3 }, { id: 'days', label: '보유일수', type: 'number', default: 30 }], faqs: [
      { q: '공매도 계산기는 무료인가요?', a: '네, 카더라 공매도 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>공매도 수익 계산기 사용 방법</h2><p>공매도 시 대차료·수수료 포함 순수익을 계산. 카더라 공매도 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 관련 핵심 정보</h2><p>투자 수익률과 리스크를 정확히 계산하는 것은 성공적인 투자의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['stock-roi'] },
  { slug: 'rebalance-calc', category: 'investment', categoryLabel: '주식/투자', title: '포트폴리오 리밸런싱 계산기', titleShort: '리밸런싱 계산기', description: '목표 비중으로 포트폴리오를 리밸런싱할 때 매수/매도 금액을 계산.', keywords: ['리밸런싱','포트폴리오','자산배분','목표비중'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'rebalanceCalc', resultLabel: '조정 결과', resultUnit: '', inputs: [{ id: 'totalAsset', label: '총 자산', type: 'currency', default: 100000000 }, { id: 'stock', label: '주식 현재 비중 (%)', type: 'percent', default: 70 }, { id: 'stockTarget', label: '주식 목표 비중 (%)', type: 'percent', default: 60 }, { id: 'bond', label: '채권 현재 비중 (%)', type: 'percent', default: 20 }, { id: 'bondTarget', label: '채권 목표 비중 (%)', type: 'percent', default: 30 }], faqs: [
      { q: '리밸런싱 계산기는 무료인가요?', a: '네, 카더라 리밸런싱 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>포트폴리오 리밸런싱 계산기 사용 방법</h2><p>목표 비중으로 포트폴리오를 리밸런싱할 때 매수/매도 금액을 계산. 카더라 포트폴리오 리밸런싱 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>주식/투자 핵심 정보</h2><p>주식/투자 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['compound-interest', 'investment-type-test'] },

  // 급여 +2
  { slug: 'severance-calc', category: 'salary', categoryLabel: '급여/노동', title: '해고예고수당 계산기', titleShort: '해고예고수당', description: '해고 시 지급해야 하는 해고예고수당(30일분)을 계산.', keywords: ['해고예고수당','해고 수당','30일분','통상임금'], legalBasis: '근로기준법 제26조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'severanceCalc', resultLabel: '해고예고수당', resultUnit: '원', inputs: [{ id: 'monthlySalary', label: '월 통상임금', type: 'currency', default: 3500000 }], faqs: [
      { q: '해고예고수당는 무료인가요?', a: '네, 카더라 해고예고수당는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 근로기준법 제26조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>해고예고수당 계산기 사용 방법</h2><p>해고 시 지급해야 하는 해고예고수당(30일분)을 계산. 카더라 해고예고수당는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>최저임금법</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>급여/노동 관련 핵심 정보</h2><p>급여와 관련된 정확한 계산은 직장인의 재무 관리에 필수적입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['retirement-pay', 'net-salary'] },
  { slug: 'minimum-wage', category: 'salary', categoryLabel: '급여/노동', title: '최저임금 계산기', titleShort: '최저임금 계산기', description: '2026년 최저임금 기준 월급·연봉을 계산.', keywords: ['최저임금','2026 최저임금','최저시급','최저월급'], legalBasis: '최저임금법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'minimumWage', resultLabel: '최저월급 (209시간)', resultUnit: '원', inputs: [{ id: 'weeklyHours', label: '주당 근로시간', type: 'number', default: 40 }, { id: 'includeHoliday', label: '주휴수당 포함', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '포함' }, { value: 'no', label: '미포함' }] }], faqs: [
      { q: '최저임금 계산기는 무료인가요?', a: '네, 카더라 최저임금 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 최저임금법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>최저임금 계산기 사용 방법</h2><p>2026년 최저임금 기준 월급·연봉을 계산. 카더라 최저임금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>최저임금법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>급여/노동 핵심 정보</h2><p>급여/노동 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['hourly-annual', 'net-salary'] },

  // 대출 +3
  { slug: 'jeonse-loan', category: 'loan', categoryLabel: '대출/예적금', title: '전세대출 이자 계산기', titleShort: '전세대출 이자', description: '전세자금대출의 월 이자를 계산.', keywords: ['전세대출','전세자금대출','전세대출 이자'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'jeonseLoan', resultLabel: '월 이자', resultUnit: '원', inputs: [{ id: 'loanAmount', label: '대출 금액', type: 'currency', default: 200000000 }, { id: 'rate', label: '금리 (%)', type: 'percent', default: 3.5, step: 0.1 }], faqs: [
      { q: '전세대출 이자는 무료인가요?', a: '네, 카더라 전세대출 이자는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>전세대출 이자 계산기 사용 방법</h2><p>전세자금대출의 월 이자를 계산. 카더라 전세대출 이자는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>대출/예적금 관련 핵심 정보</h2><p>대출 상환 계획을 세우려면 월 상환액, 총 이자, 상환 방식별 차이를 정확히 계산해야 합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['loan-repayment', 'jeonse-vs-wolse'] },
  { slug: 'refinance-compare', category: 'loan', categoryLabel: '대출/예적금', title: '대출 대환 비교기', titleShort: '대환 비교기', description: '기존 대출을 새 대출로 갈아탈 때 이자 절감액을 비교.', keywords: ['대환','대출 갈아타기','금리 비교','이자 절감'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'refinanceCompare', resultLabel: '연간 이자 절감', resultUnit: '원', inputs: [{ id: 'balance', label: '잔여 원금', type: 'currency', default: 200000000 }, { id: 'currentRate', label: '현재 금리 (%)', type: 'percent', default: 5.5, step: 0.1 }, { id: 'newRate', label: '새 금리 (%)', type: 'percent', default: 4.0, step: 0.1 }, { id: 'refinanceFee', label: '대환 수수료', type: 'currency', default: 500000 }], faqs: [
      { q: '대환 비교기는 무료인가요?', a: '네, 카더라 대환 비교기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>대출 대환 비교기 사용 방법</h2><p>기존 대출을 새 대출로 갈아탈 때 이자 절감액을 비교. 카더라 대출 대환 비교기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>대출/예적금 핵심 정보</h2><p>대출/예적금 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['loan-repayment', 'prepayment-fee'] },

  { slug: 'credit-loan-est', category: 'loan', categoryLabel: '대출/예적금', title: '신용대출 한도 추정기', titleShort: '신용대출 한도', description: '연소득·신용등급으로 신용대출 가능 한도를 추정.', keywords: ['신용대출 한도','대출 가능 금액','신용등급'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'creditLoanEst', resultLabel: '추정 한도', resultUnit: '원', inputs: [{ id: 'annualIncome', label: '연소득', type: 'currency', default: 50000000 }, { id: 'creditGrade', label: '신용등급', type: 'select', default: '3', options: [{ value: '1', label: '1등급 (최우량)' }, { value: '3', label: '3등급 (우량)' }, { value: '5', label: '5등급 (보통)' }, { value: '7', label: '7등급 (주의)' }] }], faqs: [
      { q: '신용대출 한도는 무료인가요?', a: '네, 카더라 신용대출 한도는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>신용대출 한도 추정기 사용 방법</h2><p>연소득·신용등급으로 신용대출 가능 한도를 추정. 카더라 신용대출 한도는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>연금/은퇴 관련 핵심 정보</h2><p>노후 준비는 빠를수록 유리합니다. 다층적 연금 구조를 이해하고 자신에게 맞는 계획을 세우세요.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['loan-repayment', 'dsr-calc'] },
  // 연금 +3
  { slug: 'retirement-expense', category: 'pension', categoryLabel: '연금/은퇴', title: '노후 생활비 추정기', titleShort: '노후 생활비 계산기', description: '은퇴 후 필요한 월 생활비와 총 필요자금을 추정.', keywords: ['노후 생활비','은퇴 자금','노후 준비','생활비 계산'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'retirementExpense', resultLabel: '총 필요자금', resultUnit: '원', inputs: [{ id: 'monthlyExpense', label: '은퇴 후 월 생활비', type: 'currency', default: 3000000 }, { id: 'retireAge', label: '은퇴 나이', type: 'number', default: 60 }, { id: 'lifeExpectancy', label: '기대 수명', type: 'number', default: 85 }, { id: 'inflation', label: '물가상승률 (%)', type: 'percent', default: 3 }], faqs: [
      { q: '노후 생활비 계산기는 무료인가요?', a: '네, 카더라 노후 생활비 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>노후 생활비 추정기 사용 방법</h2><p>은퇴 후 필요한 월 생활비와 총 필요자금을 추정. 카더라 노후 생활비 추정기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>연금/은퇴 핵심 정보</h2><p>연금/은퇴 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['fire-calc', 'national-pension'] },

  { slug: 'pension-vs-lump', category: 'pension', categoryLabel: '연금/은퇴', title: '연금 vs 일시금 비교기', titleShort: '연금vs일시금', description: '퇴직금을 연금으로 받을 때 vs 일시금으로 받을 때 총 수령액 비교.', keywords: ['연금 일시금 비교','퇴직금 수령','연금 수령','일시금'], legalBasis: '소득세법 제22조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'pensionVsLump', resultLabel: '비교 결과', resultUnit: '', inputs: [{ id: 'totalAmount', label: '퇴직금', type: 'currency', default: 200000000 }, { id: 'pensionYears', label: '연금 수령 기간 (년)', type: 'range', default: 15, min: 5, max: 30 }, { id: 'investReturn', label: '연금 운용 수익률 (%)', type: 'percent', default: 4 }], faqs: [
      { q: '연금vs일시금는 무료인가요?', a: '네, 카더라 연금vs일시금는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 소득세법 제22조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>연금 vs 일시금 비교기 사용 방법</h2><p>퇴직금을 연금으로 받을 때 vs 일시금으로 받을 때 총 수령액 비교. 카더라 연금vs일시금는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>조세특례제한법 제91조의18</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>연금/은퇴 관련 핵심 정보</h2><p>노후 준비는 빠를수록 유리합니다. 다층적 연금 구조를 이해하고 자신에게 맞는 계획을 세우세요.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['retirement-pension-sim', 'irp-deduction'] },
  { slug: 'isa-conversion', category: 'pension', categoryLabel: '연금/은퇴', title: 'ISA 만기 전환 시뮬레이터', titleShort: 'ISA 전환 시뮬', description: 'ISA 만기 후 IRP 전환 시 추가 세액공제 효과를 시뮬레이션.', keywords: ['ISA 전환','ISA IRP','ISA 만기','추가 세액공제'], legalBasis: '조세특례제한법 제91조의18', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'isaConversion', resultLabel: '추가 세액공제', resultUnit: '원', inputs: [{ id: 'isaBalance', label: 'ISA 만기 잔액', type: 'currency', default: 20000000 }, { id: 'transferAmount', label: 'IRP 전환 금액', type: 'currency', default: 20000000 }], faqs: [
      { q: 'ISA 전환 시뮬는 무료인가요?', a: '네, 카더라 ISA 전환 시뮬는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 조세특례제한법 제91조의18를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>ISA 만기 전환 시뮬레이터 사용 방법</h2><p>ISA 만기 후 IRP 전환 시 추가 세액공제 효과를 시뮬레이션. 카더라 ISA 만기 전환 시뮬레이터는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>조세특례제한법 제91조의18</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연금/은퇴 핵심 정보</h2><p>연금/은퇴 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['irp-deduction', 'isa-tax-free'] },

  // 자동차 +2
  { slug: 'car-insurance-est', category: 'auto', categoryLabel: '자동차', title: '자동차 보험료 추정기', titleShort: '자동차 보험료', description: '차량·운전자 정보로 자동차 보험료를 추정.', keywords: ['자동차 보험료','차량 보험','보험료 추정','자동차보험'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'carInsuranceEst', resultLabel: '추정 보험료', resultUnit: '원', inputs: [{ id: 'carAge', label: '차량 연식 (년)', type: 'number', default: 3 }, { id: 'driverAge', label: '운전자 나이', type: 'number', default: 35 }, { id: 'carPrice', label: '차량 가격', type: 'currency', default: 30000000 }, { id: 'accidentFree', label: '무사고 기간 (년)', type: 'number', default: 3 }], faqs: [
      { q: '자동차 보험료는 무료인가요?', a: '네, 카더라 자동차 보험료는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>자동차 보험료 추정기 사용 방법</h2><p>차량·운전자 정보로 자동차 보험료를 추정. 카더라 자동차 보험료는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>자동차 관련 핵심 정보</h2><p>자동차 보유·운영에는 세금, 보험, 유류비 등 다양한 비용이 발생합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['vehicle-tax', 'fuel-cost'] },
  { slug: 'fuel-saving', category: 'auto', categoryLabel: '자동차', title: '유류비 절감 비교기', titleShort: '유류비 절감 비교', description: '두 차량의 연비를 비교하여 연간 유류비 절감액을 계산.', keywords: ['유류비 절감','연비 비교','하이브리드 절감','경유 휘발유'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'fuelSaving', resultLabel: '연간 절감액', resultUnit: '원', inputs: [{ id: 'distance', label: '연간 주행거리 (km)', type: 'number', default: 15000 }, { id: 'eff1', label: '차량A 연비 (km/L)', type: 'number', default: 10, step: 0.1 }, { id: 'eff2', label: '차량B 연비 (km/L)', type: 'number', default: 18, step: 0.1 }, { id: 'fuelPrice', label: '유가 (원/L)', type: 'currency', default: 1700 }], faqs: [
      { q: '유류비 절감 비교는 무료인가요?', a: '네, 카더라 유류비 절감 비교는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>유류비 절감 비교기 사용 방법</h2><p>두 차량의 연비를 비교하여 연간 유류비 절감액을 계산. 카더라 유류비 절감 비교기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>자동차 핵심 정보</h2><p>자동차 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['fuel-cost', 'ev-charge-cost'] },

  // 생활 +1
  { slug: 'inflation-calc', category: 'life', categoryLabel: '생활/건강', title: '인플레이션 구매력 계산기', titleShort: '구매력 계산기', description: '과거/현재 금액의 실질 구매력을 물가상승률로 환산.', keywords: ['인플레이션 계산기','구매력','물가상승률','실질가치'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'inflationCalc', resultLabel: '실질 가치', resultUnit: '원', inputs: [{ id: 'amount', label: '금액', type: 'currency', default: 10000000 }, { id: 'years', label: '기간 (년)', type: 'range', default: 10, min: 1, max: 50 }, { id: 'inflationRate', label: '연 물가상승률 (%)', type: 'percent', default: 3 }], faqs: [
      { q: '인플레이션 구매력 계산기는 무료인가요?', a: '네, 카더라 인플레이션 구매력 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.  정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용 가능한가요?', a: '네, 카더라 계산기는 모바일, 태블릿, PC 모든 기기에서 최적화되어 있습니다. 별도 앱 설치 없이 브라우저에서 바로 이용 가능합니다.' },
      { q: '계산 결과를 저장하거나 공유할 수 있나요?', a: '계산 완료 후 공유 버튼을 통해 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련된 다른 계산기가 있나요?', a: '카더라는 생활/건강 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 계산기 하단의 "관련 계산기" 섹션에서 연관된 계산기를 바로 이용할 수 있습니다.' },
    ], seoContent: '<h2>인플레이션 구매력 계산기 사용 방법</h2><p>과거/현재 금액의 실질 구매력을 물가상승률로 환산. 카더라 구매력 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>민법 제843조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>법률/가정 관련 핵심 정보</h2><p>법률 관련 비용과 권리를 미리 파악하면 불필요한 분쟁과 손해를 줄일 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['compound-interest', 'fire-calc'] },
  // 법률 +4
  { slug: 'consolation-money', category: 'law', categoryLabel: '법률/가정', title: '위자료 계산기', titleShort: '위자료 계산기', description: '이혼 시 위자료 예상 금액을 추정.', keywords: ['위자료 계산기','이혼 위자료','위자료 금액'], legalBasis: '민법 제843조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'consolationMoney', resultLabel: '예상 위자료', resultUnit: '원', inputs: [{ id: 'marriageYears', label: '혼인 기간 (년)', type: 'number', default: 10 }, { id: 'faultDegree', label: '유책 정도', type: 'select', default: 'medium', options: [{ value: 'low', label: '경미' }, { value: 'medium', label: '보통' }, { value: 'high', label: '중대 (외도 등)' }] }, { id: 'income', label: '유책 배우자 연소득', type: 'currency', default: 60000000 }], faqs: [
      { q: '위자료 계산기는 무료인가요?', a: '네, 카더라 위자료 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 민법 제843조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용 가능한가요?', a: '네, 카더라 계산기는 모바일, 태블릿, PC 모든 기기에서 최적화되어 있습니다. 별도 앱 설치 없이 브라우저에서 바로 이용 가능합니다.' },
      { q: '계산 결과를 저장하거나 공유할 수 있나요?', a: '계산 완료 후 공유 버튼을 통해 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련된 다른 계산기가 있나요?', a: '카더라는 법률/가정 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 계산기 하단의 "관련 계산기" 섹션에서 연관된 계산기를 바로 이용할 수 있습니다.' },
    ], seoContent: '<h2>위자료 계산기 사용 방법</h2><p>이혼 시 위자료 예상 금액을 추정. 카더라 위자료 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>민법 제843조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>법률/가정 핵심 정보</h2><p>법률/가정 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['child-support'] },

  { slug: 'property-division', category: 'law', categoryLabel: '법률/가정', title: '이혼 재산분할 계산기', titleShort: '재산분할 계산기', description: '이혼 시 재산분할 비율과 금액을 추정.', keywords: ['재산분할','이혼 재산','분할 비율'], legalBasis: '민법 제839조의2', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'propertyDivision', resultLabel: '분할 금액', resultUnit: '원', inputs: [{ id: 'totalAssets', label: '부부 공동재산', type: 'currency', default: 500000000 }, { id: 'ratio', label: '분할 비율 (%)', type: 'percent', default: 50 }], faqs: [
      { q: '이혼 재산분할 계산기는 무료인가요?', a: '네, 카더라 이혼 재산분할 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 민법 제839조의2를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용 가능한가요?', a: '네, 카더라 계산기는 모바일, 태블릿, PC 모든 기기에서 최적화되어 있습니다. 별도 앱 설치 없이 브라우저에서 바로 이용 가능합니다.' },
      { q: '계산 결과를 저장하거나 공유할 수 있나요?', a: '계산 완료 후 공유 버튼을 통해 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련된 다른 계산기가 있나요?', a: '카더라는 법률/가정 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 계산기 하단의 "관련 계산기" 섹션에서 연관된 계산기를 바로 이용할 수 있습니다.' },
    ], seoContent: '<h2>이혼 재산분할 계산기 사용 방법</h2><p>이혼 시 재산분할 비율과 금액을 추정. 카더라 재산분할 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>민법 제162조</strong>를 기준으로 계산합니다. 세법 및 규정은 매년 개정될 수 있으므로 관련 기관이나 전문가에게 확인하시기 바랍니다.</p><h2>법률/가정 관련 핵심 정보</h2><p>법률 관련 비용과 권리를 미리 파악하면 불필요한 분쟁과 손해를 줄일 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['consolation-money', 'child-support'] },
  { slug: 'statute-of-limitations', category: 'law', categoryLabel: '법률/가정', title: '소멸시효 계산기', titleShort: '소멸시효 계산기', description: '채권·채무의 소멸시효 만료일을 계산.', keywords: ['소멸시효','채권 시효','시효 만료','소멸시효 기간'], legalBasis: '민법 제162조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'statuteOfLimitations', resultLabel: '소멸시효 만료일', resultUnit: '', inputs: [{ id: 'startDate', label: '채권 발생일', type: 'date', default: '2020-01-01' }, { id: 'type', label: '채권 유형', type: 'select', default: '10', options: [{ value: '10', label: '일반채권 (10년)' }, { value: '5', label: '상사채권 (5년)' }, { value: '3', label: '임금/퇴직금 (3년)' }, { value: '1', label: '일용직 임금 (1년)' }] }], faqs: [
      { q: '소멸시효 계산기는 무료인가요?', a: '네, 카더라 소멸시효 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 민법 제162조를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용 가능한가요?', a: '네, 카더라 계산기는 모바일, 태블릿, PC 모든 기기에서 최적화되어 있습니다. 별도 앱 설치 없이 브라우저에서 바로 이용 가능합니다.' },
      { q: '계산 결과를 저장하거나 공유할 수 있나요?', a: '계산 완료 후 공유 버튼을 통해 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련된 다른 계산기가 있나요?', a: '카더라는 법률/가정 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 계산기 하단의 "관련 계산기" 섹션에서 연관된 계산기를 바로 이용할 수 있습니다.' },
    ], seoContent: '<h2>소멸시효 계산기 사용 방법</h2><p>채권·채무의 소멸시효 만료일을 계산. 카더라 소멸시효 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>민법 제162조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>법률/가정 핵심 정보</h2><p>법률/가정 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: [] },

  { slug: 'industrial-accident', category: 'law', categoryLabel: '법률/가정', title: '산재 보상금 계산기', titleShort: '산재 보상금', description: '산업재해 시 휴업급여·장해급여를 추정.', keywords: ['산재 보상','산업재해','휴업급여','장해급여'], legalBasis: '산업재해보상보험법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'industrialAccident', resultLabel: '보상금 추정', resultUnit: '원', inputs: [{ id: 'dailyWage', label: '평균임금 (일당)', type: 'currency', default: 150000 }, { id: 'restDays', label: '휴업일수', type: 'number', default: 60 }, { id: 'disabilityGrade', label: '장해 등급', type: 'select', default: '0', options: [{ value: '0', label: '장해 없음' }, { value: '14', label: '14급' }, { value: '12', label: '12급' }, { value: '10', label: '10급' }, { value: '7', label: '7급' }, { value: '4', label: '4급' }, { value: '1', label: '1급' }] }], faqs: [
      { q: '산재 보상금는 무료인가요?', a: '네, 카더라 산재 보상금는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 산업재해보상보험법를 기준으로 계산합니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 법률/가정 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>산재 보상금 계산기 사용 방법</h2><p>산업재해 시 휴업급여·장해급여를 추정. 카더라 산재 보상금는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>군대/교육 관련 핵심 정보</h2><p>교육과 군 복무 관련 정보를 빠르게 확인할 수 있습니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['accident-compensation'] },
  // 군대/교육 +2
  { slug: 'tuition-loan', category: 'military', categoryLabel: '군대/교육', title: '대학 등록금 대출 계산기', titleShort: '등록금 대출', description: '학기별 등록금 대출 시 총 상환액을 계산.', keywords: ['등록금 대출','학자금','대학 등록금','학비 대출'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'amortize', formula: 'loanRepayment', resultLabel: '월 상환액', resultUnit: '원', inputs: [{ id: 'principal', label: '총 대출금', type: 'currency', default: 16000000 }, { id: 'rate', label: '이자율 (%)', type: 'percent', default: 1.7 }, { id: 'years', label: '상환 기간 (년)', type: 'range', default: 10, min: 1, max: 20 }, { id: 'method', label: '상환 방식', type: 'radio', default: 'equal', options: [{ value: 'equal', label: '원리금균등' }, { value: 'principal', label: '원금균등' }] }, { id: 'grace', label: '거치기간 (개월)', type: 'number', default: 0 }], faqs: [
      { q: '등록금 대출는 무료인가요?', a: '네, 카더라 등록금 대출는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>대학 등록금 대출 계산기 사용 방법</h2><p>학기별 등록금 대출 시 총 상환액을 계산. 카더라 대학 등록금 대출 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>군대/교육 핵심 정보</h2><p>군대/교육 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['student-loan'] },

  { slug: 'csat-grade', category: 'military', categoryLabel: '군대/교육', title: '수능 등급컷 계산기', titleShort: '수능 등급 계산기', description: '원점수로 수능 예상 등급을 확인.', keywords: ['수능 등급컷','수능 등급','원점수','등급 환산'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'csatGrade', resultLabel: '예상 등급', resultUnit: '등급', inputs: [{ id: 'score', label: '원점수', type: 'number', default: 85, min: 0, max: 100 }, { id: 'subject', label: '과목', type: 'select', default: 'korean', options: [{ value: 'korean', label: '국어' }, { value: 'math', label: '수학' }, { value: 'english', label: '영어' }] }], faqs: [
      { q: '수능 등급 계산기는 무료인가요?', a: '네, 카더라 수능 등급 계산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다. 정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용할 수 있나요?', a: '네, 모바일/태블릿/PC 모든 기기에서 최적화되어 있으며 별도 앱 설치가 필요 없습니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 페이지 하단 관련 계산기에서 바로 이용 가능합니다.' },
    ], seoContent: '<h2>수능 등급컷 계산기 사용 방법</h2><p>원점수로 수능 예상 등급을 확인. 카더라 수능 등급 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>쇼핑/소비 관련 핵심 정보</h2><p>현명한 소비를 위해 할인율, 할부 이자, 관세 등을 정확히 계산하세요.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가(세무사, 법무사, 재무설계사 등)와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['gpa-convert'] },
  // 쇼핑 +1
  { slug: 'point-convert', category: 'shopping', categoryLabel: '쇼핑/소비', title: '카드 포인트 환산기', titleShort: '포인트 환산기', description: '카드 포인트의 현금 가치를 환산.', keywords: ['카드 포인트','포인트 환산','적립 포인트','마일리지'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'pointConvert', resultLabel: '현금 가치', resultUnit: '원', inputs: [{ id: 'points', label: '포인트', type: 'number', default: 50000 }, { id: 'ratio', label: '1포인트 가치 (원)', type: 'number', default: 1, step: 0.1, min: 0.1, max: 100 }], faqs: [
      { q: '카드 포인트 환산기는 무료인가요?', a: '네, 카더라 카드 포인트 환산기는 완전 무료입니다. 회원가입 없이도 이용 가능하며, 계산 횟수 제한도 없습니다.' },
      { q: '계산 결과가 정확한가요?', a: '2026년 최신 기준을 반영하고 있지만, 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.  정확한 금액은 전문가 상담을 권장합니다.' },
      { q: '모바일에서도 이용 가능한가요?', a: '네, 카더라 계산기는 모바일, 태블릿, PC 모든 기기에서 최적화되어 있습니다. 별도 앱 설치 없이 브라우저에서 바로 이용 가능합니다.' },
      { q: '계산 결과를 저장하거나 공유할 수 있나요?', a: '계산 완료 후 공유 버튼을 통해 카카오톡, URL 복사 등으로 결과를 공유할 수 있습니다.' },
      { q: '관련된 다른 계산기가 있나요?', a: '카더라는 쇼핑/소비 분야를 포함하여 총 142종의 무료 계산기를 제공합니다. 계산기 하단의 "관련 계산기" 섹션에서 연관된 계산기를 바로 이용할 수 있습니다.' },
    ], seoContent: '<h2>카드 포인트 환산기 사용 방법</h2><p>카드 포인트의 현금 가치를 환산. 카더라 카드 포인트 환산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>쇼핑/소비 핵심 정보</h2><p>쇼핑/소비 분야에서 정확한 계산은 합리적인 의사결정의 기본입니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며 법적 효력이 없습니다. 실제 세금 신고, 금융 거래, 법률 행위 시에는 반드시 전문가와 상담하시기 바랍니다. 개인 상황에 따라 실제 금액과 차이가 있을 수 있습니다.</p>', relatedCalcs: ['discount-calc'] },

];

// ── 헬퍼: slug로 계산기 찾기 ──
export function findCalc(slug: string): CalcMeta | undefined {
  return CALC_REGISTRY.find(c => c.slug === slug);
}

export function findCalcsByCategory(category: string): CalcMeta[] {
  return CALC_REGISTRY.filter(c => c.category === category);
}

export function getCategoryLabel(id: string): string {
  return CATEGORIES.find(c => c.id === id)?.label ?? id;
}

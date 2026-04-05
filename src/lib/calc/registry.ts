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
    seoContent: '', relatedCalcs: ['brokerage-fee', 'jeonse-wolse', 'acquisition-tax'],
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
    seoContent: '', relatedCalcs: ['acquisition-tax', 'registration-cost', 'jeonse-wolse'],
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
      { q: '1평은 몇 제곱미터?', a: '1평 = 3.3058㎡ (정확값 400/121).' },
      { q: '전용 84㎡는 몇 평?', a: '약 25.4평 (전용면적 기준).' },
    ],
    seoContent: '', relatedCalcs: ['brokerage-fee', 'rental-yield'],
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
      { q: '전월세전환율이란?', a: '보증금을 월세로 전환할 때 적용하는 비율. 2026년 기준 약 4.5%.' },
    ],
    seoContent: '', relatedCalcs: ['brokerage-fee', 'rental-yield', 'jeonse-vs-wolse'],
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
    faqs: [], seoContent: '', relatedCalcs: ['jeonse-wolse', 'brokerage-fee'],
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
    seoContent: '', relatedCalcs: ['dca-simulator', 'dividend-calc', 'fire-calc'],
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
    faqs: [], seoContent: '', relatedCalcs: ['avg-down', 'breakeven', 'overseas-cgt'],
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
    faqs: [], seoContent: '', relatedCalcs: ['stock-roi', 'breakeven'],
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
    faqs: [{ q: '-50% 손실 후 본전은?', a: '+100% 수익이 필요. 50만원 → 25만원 → 다시 50만원 = +100%.' }],
    seoContent: '', relatedCalcs: ['stock-roi', 'avg-down'],
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
    faqs: [], seoContent: '', relatedCalcs: ['compound-interest', 'financial-income-tax', 'overseas-cgt'],
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
    faqs: [], seoContent: '', relatedCalcs: ['compound-interest', 'fire-calc'],
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
    faqs: [], seoContent: '', relatedCalcs: ['stock-roi', 'dividend-calc'],
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
    faqs: [], seoContent: '', relatedCalcs: ['overseas-cgt', 'stock-roi'],
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
    seoContent: '', relatedCalcs: ['4-insurance', 'retirement-pay', 'year-end-refund'],
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
      { q: '4대보험 요율은?', a: '국민연금 4.5%, 건강보험 3.545%, 장기요양 12.95%(건보의), 고용보험 0.9%.' },
    ],
    seoContent: '', relatedCalcs: ['net-salary', 'retirement-pay'],
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
    faqs: [], seoContent: '', relatedCalcs: ['net-salary', 'retirement-pension', 'irp-deduction'],
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
    faqs: [], seoContent: '', relatedCalcs: ['net-salary', '4-insurance'],
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
    faqs: [], seoContent: '', relatedCalcs: ['comprehensive-income-tax', 'net-salary'],
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
    seoContent: '', relatedCalcs: ['deposit-interest', 'dsr-calc', 'ltv-calc'],
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
    faqs: [], seoContent: '', relatedCalcs: ['compound-interest', 'loan-repayment'],
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
    seoContent: '', relatedCalcs: ['registration-cost', 'brokerage-fee', 'capital-gains-housing'],
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
    seoContent: '', relatedCalcs: ['acquisition-tax', 'comprehensive-property-tax', 'registration-cost'],
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
    seoContent: '', relatedCalcs: ['inheritance-tax', 'generation-skip', 'acquisition-tax'],
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
      { q: '해외주식 세율은?', a: '양도차익 - 250만원(기본공제) × 22% (소득세 20% + 지방소득세 2%).' },
      { q: '신고 시기는?', a: '다음해 5월 종합소득세 신고 시 함께 신고. 250만원 이하면 신고 불요.' },
    ],
    seoContent: '', relatedCalcs: ['stock-roi', 'financial-income-tax', 'dividend-calc'],
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
    faqs: [], seoContent: '', relatedCalcs: ['dividend-calc', 'deposit-interest', 'overseas-cgt'],
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
    seoContent: '', relatedCalcs: ['calorie', 'body-fat', 'bmr'],
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
    faqs: [], seoContent: '', relatedCalcs: ['bmi', 'calorie'],
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
    faqs: [], seoContent: '', relatedCalcs: ['bmi'],
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
    faqs: [], seoContent: '', relatedCalcs: ['military-pay'],
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
      { q: '국민연금 수령 나이는?', a: '1969년 이후 출생자는 만 65세부터.' },
    ],
    seoContent: '', relatedCalcs: ['fire-calc', 'irp-deduction', 'retirement-pay'],
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
      { q: '4% 룰이란?', a: '은퇴 후 자산의 4%를 매년 인출하면 30년 이상 자산이 유지된다는 경험 법칙.' },
    ],
    seoContent: '', relatedCalcs: ['compound-interest', 'national-pension', 'dca-simulator'],
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
      { q: '최대 환급액은?', a: '총급여 5,500만 이하: 148.5만원 (900만×16.5%). 초과: 118.8만원 (900만×13.2%).' },
    ],
    seoContent: '', relatedCalcs: ['national-pension', 'year-end-refund', 'net-salary'],
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
    faqs: [], seoContent: '', relatedCalcs: ['bmi', 'body-fat', 'bmr'],
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
    faqs: [], seoContent: '', relatedCalcs: ['bmi', 'calorie', 'bmr'],
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
    faqs: [], seoContent: '', relatedCalcs: ['calorie', 'bmi', 'body-fat'],
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
    faqs: [{ q: '만 나이 vs 세는 나이?', a: '2023년 6월부터 법적으로 만 나이만 사용. 태어난 해 0세, 생일 지나면 +1세.' }],
    seoContent: '', relatedCalcs: ['due-date', 'discharge-date'],
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
    faqs: [], seoContent: '', relatedCalcs: ['age-calc', 'discharge-date'],
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
    faqs: [], seoContent: '', relatedCalcs: ['due-date'],
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
    faqs: [{ q: '전기차 세금은?', a: '배기량 무관, 연 10만원 고정.' }],
    seoContent: '', relatedCalcs: ['fuel-cost', 'car-installment'],
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
    faqs: [], seoContent: '', relatedCalcs: ['vehicle-tax', 'ev-charge-cost'],
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
    faqs: [], seoContent: '', relatedCalcs: ['loan-repayment', 'vehicle-tax'],
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
    faqs: [], seoContent: '', relatedCalcs: ['fuel-cost', 'vehicle-tax'],
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
    faqs: [], seoContent: '', relatedCalcs: ['installment-interest'],
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
    faqs: [], seoContent: '', relatedCalcs: ['discount-calc', 'loan-repayment'],
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
    faqs: [{ q: '면세 한도는?', a: '미국발 $200, 기타 $150 이하 면세. 단, 주류/담배/향수 제외.' }],
    seoContent: '', relatedCalcs: ['currency-convert'],
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
    faqs: [], seoContent: '', relatedCalcs: ['net-salary'],
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
    faqs: [{ q: '2026년 병장 월급은?', a: '약 125만원 (2025년 대비 인상 예정).' }],
    seoContent: '', relatedCalcs: ['discharge-date', 'net-salary'],
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
    faqs: [], seoContent: '', relatedCalcs: [],
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
    faqs: [{ q: '종합소득세 신고기간은?', a: '매년 5월 1일~5월 31일. 기한 내 미신고 시 가산세 부과.' }],
    seoContent: '', relatedCalcs: ['withholding-3-3', 'net-salary'],
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
    faqs: [], seoContent: '', relatedCalcs: ['comprehensive-property-tax', 'acquisition-tax'],
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
    faqs: [], seoContent: '', relatedCalcs: ['acquisition-tax', 'brokerage-fee'],
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
    faqs: [{ q: 'DSR 한도는?', a: '은행 40%, 비은행 50%. DSR 초과 시 대출 불가.' }],
    seoContent: '', relatedCalcs: ['loan-repayment', 'net-salary'],
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
    faqs: [], seoContent: '', relatedCalcs: ['jeonse-wolse', 'loan-repayment'],
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
    faqs: [{ q: '환급은 언제 받나?', a: '2월 급여와 함께 정산. 추가납부 시에도 2월 급여에서 차감.' }],
    seoContent: '', relatedCalcs: ['net-salary', 'irp-deduction', 'credit-card-deduction'],
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
    faqs: [{ q: '25% 문턱이란?', a: '총급여의 25%를 초과한 사용액부터 공제 시작. 신용카드 15%, 체크카드/현금 30%.' }],
    seoContent: '', relatedCalcs: ['year-end-refund', 'net-salary'],
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
    faqs: [{ q: '월세 공제 조건은?', a: '총급여 8천만 이하, 무주택 세대주, 국민주택규모 이하(85㎡). 최대 1천만원 × 17%.' }],
    seoContent: '', relatedCalcs: ['year-end-refund', 'jeonse-vs-wolse'],
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
    faqs: [{ q: '기초공제+일괄공제?', a: '기초공제 2억+인적공제 vs 일괄공제 5억 중 큰 금액 적용.' }],
    seoContent: '', relatedCalcs: ['gift-tax', 'capital-gains-housing'],
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
    faqs: [], seoContent: '', relatedCalcs: ['comprehensive-income-tax'],
  },
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

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
  emoji: string;
  category: string;
  categoryLabel: string;
  title: string;
  titleShort: string;
  /**
   * K-2 ③ — 검색 결과 <title> 전용 덮어쓰기. 없으면 기존 조립식을 그대로 쓴다.
   *
   * 왜 필요한가: 기본 조립은 `{emoji} {title} — 무료 온라인 계산기` 인데, 이것이
   * 두 가지를 동시에 망가뜨리는 표적이 있었다.
   *   ① 구절 단절 — 사람들은 「국민주택채권 계산기」를 치는데 우리 제목은
   *      「국민주택채권 «매입금액» 계산기」라 정확 구절이 끊긴다.
   *   ② 「계산기」 중복 — 접미사가 또 「계산기」라 제목 길이만 먹는다.
   * 실측: 이 두 표적이 90일 노출 2.2만인데 CTR 0.3% 였다.
   *
   * ⛔ 전역 템플릿을 바꾸지 않는다 — 나머지 137종은 손대지 않는 것이 이 필드의 존재 이유다.
   */
  seoTitle?: string;
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
    slug: 'subscription-score', emoji: '🏠', category: 'real-estate', categoryLabel: '부동산',
    title: '2026 청약 가점 계산기', titleShort: '청약 가점 계산기',
    description: '무주택기간·부양가족·청약통장 가입기간(배우자 합산)으로 청약 가점 84점 만점 자동 계산. 주택공급규칙 별표1 기준.',
    keywords: ['청약 가점 계산기','청약 점수','무주택기간','부양가족','청약통장','배우자 통장 합산','2026 청약'],
    legalBasis: '주택공급에 관한 규칙 제28조 별표1', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'diagnose', formula: 'subscriptionScore', resultLabel: '내 청약 가점', resultUnit: '점',
    inputs: [
      { id: 'noHouseYears', label: '무주택 기간 (년)', type: 'range', default: 5, min: 0, max: 30, step: 1, unit: '년',
        hint: '세대주 기준. 만 30세부터 또는 결혼일부터 산정' },
      { id: 'dependents', label: '부양가족 수 (본인 제외)', type: 'stepper', default: 2, min: 0, max: 10, step: 1, unit: '명',
        hint: '같은 등본 기준 직계존비속·배우자' },
      { id: 'bankYears', label: '본인 청약통장 가입기간', type: 'range', default: 5, min: 0, max: 30, step: 0.5, unit: '년' },
      { id: 'spouseBankYears', label: '배우자 청약통장 가입기간 (합산용)', type: 'range', default: 0, min: 0, max: 15, step: 0.5, unit: '년',
        hint: '입력값은 최대 3년까지 본인 가입기간에 더해 계산한다' },
    ],
    faqs: [
      { q: '청약 가점 만점은 몇 점?', a: '84점. 무주택 32 + 부양가족 35 + 통장 17.' },
      { q: '배우자 통장도 합산?', a: '이 계산기는 배우자 청약통장 가입기간을 최대 3년까지 본인 가입기간에 더해 통장 점수를 계산합니다. 실제 인정 방식은 주택공급에 관한 규칙 원문과 청약홈에서 확인하세요.' },
    ],
    seoContent: '<h2>2026 청약 가점 계산기 완벽 가이드</h2><p>무주택기간·부양가족·청약통장 가입기간(배우자 합산)으로 청약 가점 84점 만점 자동 계산. 주택공급규칙 별표1 기준.</p><p>본 계산기는 <strong>주택공급에 관한 규칙 제28조 별표1</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>청약 가점 계산기 계산 방식</h2><p>무주택 기간·부양가족 수·청약통장 가입기간을 각각 점수표로 바꿔 더합니다. 항목별 만점은 무주택 32점·부양가족 35점·통장 17점으로 합계 84점입니다. 배우자 통장 가입기간은 입력값을 최대 3년까지 본인 가입기간에 더해 통장 점수를 매깁니다. 결과의 등급·지역 조언은 점수 구간별 참고 문구이며 실제 당첨 커트라인이 아닙니다.</p><h2>이런 분들에게 추천</h2><p>민영주택 가점제 청약을 준비하는 무주택 세대주, 내 가점으로 어느 정도 경쟁력이 있는지 가늠하려는 분에게 유용합니다.</p>', relatedCalcs: ['brokerage-fee', 'jeonse-wolse', 'acquisition-tax'],

  },
  {
    slug: 'brokerage-fee', emoji: '🤝', category: 'real-estate', categoryLabel: '부동산',
    title: '2026 부동산 중개수수료 계산기', titleShort: '중개수수료 계산기',
    seoTitle: '중개수수료 계산기 — 매매·전세 복비 상한 계산',
    description: '매매·전세·월세 거래금액별 부동산 중개보수(복비) 상한을 2021년 개정 요율표로 계산합니다.',
    keywords: ['중개수수료 계산기','부동산 복비','중개보수','중개보수 요율','매매 수수료','전세 수수료','월세 수수료'],
    legalBasis: '공인중개사법 시행규칙 제20조 별표1(2021년 개정)', version: '2026.09', lastUpdated: '2026-09-16',
    pattern: 'tax-bracket', formula: 'brokerageFee', resultLabel: '중개수수료 상한', resultUnit: '원',
    inputs: [
      { id: 'dealType', label: '거래 유형', type: 'radio', default: 'trade', options: [{ value: 'trade', label: '매매' }, { value: 'lease', label: '전세' }, { value: 'monthly', label: '월세' }] },
      { id: 'price', label: '거래금액', type: 'currency', default: 500000000, unit: '원' },
      { id: 'monthlyRent', label: '월세', type: 'currency', default: 500000, unit: '원', condition: 'dealType=monthly' },
    ],
    faqs: [
      { q: '중개수수료 상한은?', a: '2021년 개정 기준으로 매매는 0.4~0.7%, 임대차는 0.3~0.6%입니다. 거래금액 구간별로 갈리며, 5천만원 미만 등 소액 구간에는 한도액이 따로 있습니다.' },
      { q: '이 금액을 그대로 내야 하나요?', a: '아닙니다. 요율표의 값은 «상한»이고, 실제 보수는 시·도 조례가 정한 한도 안에서 의뢰인과 개업공인중개사가 협의해 정합니다.' },
      { q: '부가세 별도?', a: '결과 화면은 중개보수의 10%를 부가세로 따로 보여줍니다. 실제 부가세가 붙는지는 중개사무소의 과세 유형에 따라 다르니 영수증 발급 조건을 확인하세요.' },
    ],
    seoContent: '<h2>2026 부동산 중개수수료 계산기 완벽 가이드</h2><p>매매·전세·월세 거래금액별 부동산 중개수수료(복비)를 자동 계산합니다. 2021년 개정 요율 적용.</p><p>본 계산기는 <strong>공인중개사법 시행규칙 별표</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>중개수수료 계산기 계산 방식</h2><p>거래 유형과 거래금액으로 2021년 개정 요율표의 구간을 찾아 «거래금액 × 상한요율» 을 계산하고, 구간에 한도액이 있으면 그 금액을 넘지 않게 자릅니다. 월세는 «보증금 + 월세 × 100» 을 거래금액으로 봅니다. 결과는 받을 수 있는 «상한» 이며 실제 보수는 그 안에서 협의로 정합니다. 결과 화면의 부가세는 보수의 10%를 따로 계산해 보여주는 값입니다.</p><h2>이런 분들에게 추천</h2><p>매매·전세·월세 계약 전에 중개보수 상한을 미리 확인하려는 분에게 유용합니다.</p>', relatedCalcs: ['acquisition-tax', 'registration-cost', 'jeonse-wolse'],

  },
  {
    slug: 'pyeong-sqm', emoji: '📐', category: 'real-estate', categoryLabel: '부동산',
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
      { q: '평수 환산기 결과는 실제와 같나요?', a: '환산식(1평 = 3.3058㎡)을 그대로 적용한 값입니다. 다만 공급면적 평형과 전용면적은 서로 다른 면적이니, 비교하려는 면적이 같은 종류인지 확인하세요.' },
      { q: '평수 환산기는 무료인가요?', a: '네, 카더라 평수 환산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '평수 환산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ],
    seoContent: '<h2>평수 ↔ 제곱미터(㎡) 환산기 완벽 가이드</h2><p>평(坪)을 제곱미터(㎡)로, 제곱미터를 평으로 즉시 변환. 1평 = 3.3058㎡.</p><p>본 계산기는 <strong>계량법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>평수 환산기 계산 방식</h2><p>평 → ㎡ 는 입력값 × 3.3058, ㎡ → 평 은 입력값 ÷ 3.3058 로 환산하고 소수 둘째 자리까지 보여줍니다(1평 = 400/121㎡).</p><h2>이런 분들에게 추천</h2><p>아파트 평형과 전용면적(㎡)을 서로 바꿔 보려는 분에게 유용합니다. 분양 광고의 평형(공급면적)과 전용면적은 다르므로 어떤 면적을 넣는지 확인하세요.</p>', relatedCalcs: ['brokerage-fee', 'rental-yield'],
  },
  {
    slug: 'jeonse-wolse', emoji: '🔄', category: 'real-estate', categoryLabel: '부동산',
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
      { q: '전월세 전환 계산기 결과는 실제와 같나요?', a: '참고용이며, 지역·물건 특성에 따라 차이가 있을 수 있습니다. 주택임대차보호법 제7조의2를 기준으로 계산합니다.' },
      { q: '부동산 거래 시 꼭 확인할 것은?', a: '등기부등본, 건축물대장, 토지이용계획확인서를 반드시 확인하세요.' },
      { q: '전월세 전환 계산기는 무료인가요?', a: '네, 카더라 전월세 전환 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '전월세 전환 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ],
    seoContent: '<h2>전월세 전환 계산기 완벽 가이드</h2><p>전세보증금을 월세로, 월세를 전세로 전환 시 적정 금액을 계산. 전월세전환율 자동 적용.</p><p>본 계산기는 <strong>주택임대차보호법 제7조의2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>전월세 전환 계산기 계산 방식</h2><p>전세 → 월세 는 «(전세보증금 − 월세 보증금) × 전월세전환율 ÷ 12» 로 월세를 구합니다. 월세 → 전세 는 «보증금 + 월세 × 12 ÷ 전환율» 로 전세보증금을 구합니다. 전환율 칸을 비워 두면 계산기에 설정된 기본 전환율을 씁니다. 법정 상한 전환율과 자동으로 대조하지는 않습니다. ⚠️ 현재 월세 → 전세 방향에는 월세 금액 입력칸이 없어 보증금만으로 계산됩니다 — 전세 → 월세 방향으로 확인하세요.</p><h2>이런 분들에게 추천</h2><p>전세를 월세로(또는 반대로) 바꾸는 재계약을 앞두고 적정 금액을 가늠하려는 분에게 유용합니다.</p>', relatedCalcs: ['brokerage-fee', 'rental-yield', 'jeonse-vs-wolse'],

  },
  {
    slug: 'rental-yield', emoji: '💹', category: 'real-estate', categoryLabel: '부동산',
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
      { q: '임대수익률 계산기 결과는 실제와 같나요?', a: '참고용이며, 지역·물건 특성에 따라 차이가 있을 수 있습니다.' },
      { q: '임대수익률 계산기는 무료인가요?', a: '네, 카더라 임대수익률 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '임대수익률 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>임대수익률 계산기 완벽 가이드</h2><p>부동산 매입가 대비 월세 수익률(연 수익률)을 계산. 공실률·관리비·세금 반영.</p><h2>임대수익률 계산기 계산 방식</h2><p>연간 순수익 = 월세 × 12 × (1 − 공실률) − 연간 관리비·세금(입력값). 투자금 = 매입가 − 보증금. 연 임대수익률 = 연간 순수익 ÷ 투자금 입니다. 대출이자·취득세·중개보수는 «연간 관리비·세금» 칸에 직접 더해 넣지 않으면 계산에서 빠집니다.</p><h2>이런 분들에게 추천</h2><p>월세를 받는 수익형 부동산 매입을 검토하며 수익률을 비교하려는 분에게 유용합니다.</p>', relatedCalcs: ['jeonse-wolse', 'brokerage-fee'],

  },

  // ════════════════════════════════════════
  // 주식/투자 (14종)
  // ════════════════════════════════════════
  {
    slug: 'compound-interest', emoji: '📈', category: 'investment', categoryLabel: '주식/투자',
    title: '2026 복리 계산기', titleShort: '복리 계산기',
    description: '거치식·적립식 복리 투자 수익을 계산. 연복리/월복리 선택, 연도별 자산 추이 차트 제공.',
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
    seoContent: '<h2>복리의 마법 — 시간이 만드는 수익</h2><p>복리는 이자에 이자가 붙는 원리로, 장기 투자 시 놀라운 자산 증식 효과를 발휘합니다. 1,000만원을 연 7% 복리로 30년 투자하면 약 7,612만원으로 불어납니다.</p><h2>복리 계산 공식</h2><p>최종금액 = 원금 × (1 + 이율)^기간. 72법칙: 72 ÷ 연수익률(%) = 원금 2배 걸리는 년수. 연 6%→12년, 연 8%→9년, 연 12%→6년.</p><h2>복리 효과 비교</h2><p>1,000만원 투자 시: 연 5% 30년→4,322만원. 연 7% 30년→7,612만원. 연 10% 30년→1억7,449만원. 위 값은 모두 세금·수수료를 빼지 않은 세전 금액입니다.</p><h2>복리 계산기 계산 방식</h2><p>연복리는 매년 «(자산 + 월 적립액 × 12) × (1 + 연 수익률)» 로 불립니다. 월복리는 원금에 월 이율(연 수익률 ÷ 12)을 매달 복리로 붙이고, 월 적립액은 매달 말 넣는 것으로 계산합니다.</p><h2>계산 시 유의사항</h2><p>본 계산기의 결과는 참고용이며, 세금·수수료·인플레이션은 별도 고려해야 합니다.</p>', relatedCalcs: ['dca-simulator', 'dividend-calc', 'fire-calc'],
  },
  {
    slug: 'stock-roi', emoji: '📊', category: 'investment', categoryLabel: '주식/투자',
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
      // K-9 ⓒ — 코스피·코스닥은 «구성이 다르다»(코스피 거래세0.05+농특0.15 / 코스닥 거래세0.20 단일).
      //   총액은 2026년 한정 우연히 같지만 성분을 내려면 시장을 갈라야 한다.
      { id: 'market', label: '시장', type: 'radio', default: 'kospi', options: [{ value: 'kospi', label: '코스피' }, { value: 'kosdaq', label: '코스닥' }, { value: 'us', label: '해외' }] },
    ],
    faqs: [
      { q: '주식 수익률 계산기에서 세금은 반영되나요?', a: '국내 주식은 매도금액에 증권거래세(코스피는 농어촌특별세 포함)를 붙여 순수익에서 뺍니다. 세율은 정책 표에서 받아 결과 화면에 표시합니다. 해외 주식은 증권거래세가 없고, 양도소득세·배당소득세는 이 계산에 들어 있지 않습니다.' },
      { q: '주식 수익률 계산기는 무료인가요?', a: '네, 카더라 주식 수익률 계산기는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '주식 수익률 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>주식 수익률 계산기 완벽 가이드</h2><p>매수가·매도가·수량을 입력하면 수익률, 수익금, 세금(수수료 포함)을 자동 계산.</p><h2>주식 수익률 계산기 계산 방식</h2><p>매수 총액 = 매수가 × 수량 × (1 + 수수료율), 매도 총액 = 매도가 × 수량 × (1 − 수수료율) 입니다. 국내 주식은 매도금액에 증권거래세(코스피는 농어촌특별세 포함)를 붙여 순수익에서 뺍니다. 세율은 서버의 정책 표에서 받아 결과 화면에 성분별로 표시하고, 받지 못하면 계산하지 않습니다. 해외 주식은 증권거래세가 없으며 해외주식 양도소득세는 이 계산에 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>주식 매매 후 수수료·거래세를 뺀 실제 수익률을 확인하려는 분에게 유용합니다. 투자에는 원금 손실 위험이 있으며, 본 계산기는 참고용입니다.</p>', relatedCalcs: ['avg-down', 'breakeven', 'overseas-cgt'],
  },
  {
    slug: 'avg-down', emoji: '⬇️', category: 'investment', categoryLabel: '주식/투자',
    title: '물타기(평단가) 계산기', titleShort: '물타기 계산기',
    seoTitle: '주식 물타기 계산기 — 평단가·추가매수 계산',
    description: '추가 매수 시 새 평균 매수단가를 계산.',
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
      { q: '물타기 계산기에서 세금은 반영되나요?', a: '아니요. 이 계산기는 평균단가만 계산하며 매수 수수료·세금은 들어 있지 않습니다.' },
      { q: '물타기 계산기는 무료인가요?', a: '네, 카더라 물타기 계산기는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '물타기 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>물타기(평단가) 계산기 완벽 가이드</h2><p>추가 매수 시 새 평균 매수단가를 계산.</p><h2>물타기 계산기 계산 방식</h2><p>새 평균단가 = (기존 평균단가 × 보유 수량 + 추가 매수가 × 추가 수량) ÷ 총 보유 수량 입니다. 결과 화면에 기존 대비 평단가 변화도 보여줍니다. 매수 수수료와 세금은 이 계산에 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>보유 종목을 추가 매수하기 전에 평균단가가 얼마나 내려가는지 확인하려는 분에게 유용합니다. 투자에는 원금 손실 위험이 있으며, 본 계산기는 참고용입니다.</p>', relatedCalcs: ['stock-roi', 'breakeven'],

  },
  {
    slug: 'breakeven', emoji: '⚖️', category: 'investment', categoryLabel: '주식/투자',
    title: '손익분기점 계산기', titleShort: '손익분기점 계산기',
    description: '현재 손실에서 본전까지 필요한 수익률을 계산.',
    keywords: ['손익분기점 계산기','본전 수익률','손실 회복','주식 손실'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'breakeven', resultLabel: '필요 수익률', resultUnit: '%',
    inputs: [
      { id: 'lossPercent', label: '현재 손실률 (%)', type: 'percent', default: 30, min: 0, max: 99 },
    ],
    faqs: [
      { q: '손익분기점 계산기에서 세금은 반영되나요?', a: '아니요. 손실률로 필요한 수익률만 계산하며 수수료·세금은 들어 있지 않습니다.' },
      { q: '손익분기점 계산기는 무료인가요?', a: '네, 카더라 손익분기점 계산기는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '손익분기점 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ],
    seoContent: '<h2>손익분기점 계산기 완벽 가이드</h2><p>현재 손실에서 본전까지 필요한 수익률을 계산.</p><h2>손익분기점 계산기 계산 방식</h2><p>본전까지 필요한 수익률 = 손실률 ÷ (1 − 손실률) 입니다. 예를 들어 −50% 손실이면 남은 금액이 두 배가 되어야 하므로 +100% 가 필요합니다. 수수료와 세금은 이 계산에 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>손실 중인 종목이 본전을 회복하려면 얼마나 올라야 하는지 확인하려는 분에게 유용합니다. 투자에는 원금 손실 위험이 있으며, 본 계산기는 참고용입니다.</p>', relatedCalcs: ['stock-roi', 'avg-down'],
  },
  {
    slug: 'dividend-calc', emoji: '💵', category: 'investment', categoryLabel: '주식/투자',
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
      { q: '배당금 계산기에서 세금은 반영되나요?', a: '국내 주식 증권거래세(매도 시 부과 — 세율은 시장별로 다르다)와 수수료를 반영합니다. 해외주식은 양도세(22%, 250만원 공제) 별도입니다.' },
      { q: '투자 수익 과세 기준은?', a: '국내 상장주식은 대주주만 양도세, 해외주식은 250만원 초과 시 22%, 배당은 15.4% 원천징수입니다.' },
      { q: '배당금 계산기는 무료인가요?', a: '네, 카더라 배당금 계산기는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '배당금 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>배당금 계산기 완벽 가이드</h2><p>투자금·배당수익률로 세후 연간·월간 배당금을 계산. 배당 재투자 복리 시뮬레이션. 카더라 배당금 계산기는 수수료, 세금을 반영한 실질 수익을 계산합니다.</p><p>본 계산기는 <strong>소득세법 제129조 (배당소득 원천징수)</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>투자 핵심 정보</h2><p>투자 수익에는 증권거래세(매도 시 부과 — 세율은 시장별로 다르다), 수수료, 배당소득세(15.4%), 해외주식 양도세(22%, 250만원 공제) 등이 적용됩니다. 72법칙(72÷수익률=원금2배 년수)으로 복리 효과를 빠르게 파악할 수 있습니다. 장기 적립식 투자와 배당 재투자가 자산 증식의 핵심입니다.</p><h2>이런 분들에게 추천</h2><p>주식·펀드·ETF 투자자, 배당 투자 계획 중인 분, 투자 성과를 정확히 측정하고 싶은 분에게 유용합니다. 투자에는 원금 손실 위험이 있으며, 본 계산기는 참고용입니다.</p>', relatedCalcs: ['compound-interest', 'financial-income-tax', 'overseas-cgt'],

  },
  {
    slug: 'dca-simulator', emoji: '📅', category: 'investment', categoryLabel: '주식/투자',
    title: '적립식 투자 시뮬레이터', titleShort: '적립식 투자 계산기',
    description: '매월 일정 금액을 투자할 때 투자 기간 후 최종 자산과 수익금을 시뮬레이션.',
    keywords: ['적립식 투자 계산기','월 적립 투자','DCA','목표 금액','투자 시뮬레이션'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'amortize', formula: 'dcaSimulator', resultLabel: '최종 자산', resultUnit: '원',
    inputs: [
      { id: 'monthly', label: '월 투자액', type: 'currency', default: 1000000 },
      { id: 'rate', label: '연 기대 수익률 (%)', type: 'percent', default: 8, min: 0, max: 30 },
      { id: 'years', label: '투자 기간 (년)', type: 'range', default: 20, min: 1, max: 40 },
    ],
    faqs: [
      { q: '적립식 투자 계산기에서 세금은 반영되나요?', a: '아니요. 기대 수익률로 불린 세전 금액이며 세금·수수료는 들어 있지 않습니다.' },
      { q: '적립식 투자 계산기는 무료인가요?', a: '네, 카더라 적립식 투자 계산기는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '적립식 투자 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>적립식 투자 시뮬레이터 완벽 가이드</h2><p>매월 일정 금액을 투자할 때 투자 기간 후 최종 자산과 수익금을 시뮬레이션.</p><h2>적립식 투자 계산기 계산 방식</h2><p>매달 말 월 투자액을 넣고 월 이율(연 기대 수익률 ÷ 12)로 복리 증식한다고 가정해 «월 투자액 × ((1 + 월 이율)^개월 수 − 1) ÷ 월 이율» 로 최종 자산을 구합니다. 총 투자금 = 월 투자액 × 12 × 기간. 세금·수수료는 이 계산에 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>매달 적립식으로 주식·펀드·ETF에 투자할 때 기간별 자산 규모를 가늠하려는 분에게 유용합니다. 투자에는 원금 손실 위험이 있으며, 본 계산기는 참고용입니다.</p>', relatedCalcs: ['compound-interest', 'fire-calc'],
  },
  {
    slug: 'per-pbr-value', emoji: '🎯', category: 'investment', categoryLabel: '주식/투자',
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
      { q: 'PER/PBR 계산기에서 세금은 반영되나요?', a: '아니요. 주당 지표 × 목표 배수로 적정주가만 추정하며 세금·수수료는 계산에 들어 있지 않습니다.' },
      { q: 'PER/PBR 계산기는 무료인가요?', a: '네, 카더라 PER/PBR 계산기는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: 'PER/PBR 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>PER/PBR 적정주가 계산기 완벽 가이드</h2><p>EPS×PER, BPS×PBR로 적정 주가를 추정.</p><h2>PER/PBR 계산기 계산 방식</h2><p>PER 방식은 «EPS × 목표 PER», PBR 방식은 «BPS × 목표 PBR» 로 적정주가를 구합니다. 목표 배수를 무엇으로 잡느냐에 따라 결과가 크게 달라지는 단순 추정입니다. 수수료·세금과는 관계없는 계산입니다.</p><h2>이런 분들에게 추천</h2><p>종목의 이익·순자산 대비 적정주가를 간단히 추정해 보려는 분에게 유용합니다. 투자에는 원금 손실 위험이 있으며, 본 계산기는 참고용입니다.</p>', relatedCalcs: ['stock-roi', 'dividend-calc'],

  },
  {
    slug: 'currency-convert', emoji: '💱', category: 'investment', categoryLabel: '주식/투자',
    title: '환율 환산 계산기', titleShort: '환율 계산기',
    seoTitle: '환율 계산기 — 달러·엔·유로 오늘 환율 환산',
    // ⚠️ 「실시간」이라 쓰지 않는다. 매일 갱신되는 고시 환율이고, 화면이 기준 시각을 함께 적는다.
    //    예전 표기는 「실시간 변환」이었는데 실제로는 «상수» 였다 — 표기와 실물이 정반대였다.
    description: '달러·엔·유로·위안 환율을 매일 갱신되는 고시 환율로 환산. 적용 환율과 기준 시각을 함께 표시.',
    keywords: ['환율 계산기','달러 환율','엔 환율','유로 환율','원달러','오늘 환율'],
    legalBasis: '', version: '2026.09', lastUpdated: '2026-09-16',
    pattern: 'simple', formula: 'currencyConvert', resultLabel: '변환 결과', resultUnit: '',
    inputs: [
      { id: 'amount', label: '금액', type: 'number', default: 1000, min: 0 },
      { id: 'from', label: '원래 통화', type: 'select', default: 'USD', options: [{ value: 'USD', label: '달러 (USD)' }, { value: 'KRW', label: '원 (KRW)' }, { value: 'JPY', label: '엔 (JPY)' }, { value: 'EUR', label: '유로 (EUR)' }, { value: 'CNY', label: '위안 (CNY)' }] },
      { id: 'to', label: '변환 통화', type: 'select', default: 'KRW', options: [{ value: 'USD', label: '달러 (USD)' }, { value: 'KRW', label: '원 (KRW)' }, { value: 'JPY', label: '엔 (JPY)' }, { value: 'EUR', label: '유로 (EUR)' }, { value: 'CNY', label: '위안 (CNY)' }] },
    ],
    faqs: [
      { q: '이 환율은 언제 기준인가요?', a: '매일 갱신되는 고시 환율이며, 결과 화면에 적용 환율과 기준 시각을 함께 표시합니다. 은행 창구의 매매기준율·현찰 살 때 값과는 수수료만큼 차이가 납니다.' },
      { q: '실제 환전 금액과 다른 이유는?', a: '고시 환율은 기준값이고, 실제 환전에는 은행별 스프레드와 수수료가 붙습니다. 우대율에 따라서도 달라집니다.' },
      { q: '환율 계산기는 무료인가요?', a: '네, 카더라 환율 계산기는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '환율 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>환율 환산 계산기 완벽 가이드</h2><p>달러·엔·유로·위안 환율을 매일 갱신되는 고시 환율로 환산합니다.</p><h2>환율 계산기 계산 방식</h2><p>금액 ÷ (원래 통화 환율) × (변환 통화 환율) 로 교차 환산합니다. 환율은 서버가 매일 갱신되는 고시 환율 표에서 읽어 넣고, 결과 화면에 적용 환율과 기준 시각을 함께 표시합니다. 환율을 받지 못하면 옛 값으로 대신하지 않고 「환율 미수신」으로 표시합니다. 은행 환전 수수료·스프레드·우대율은 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>해외여행·해외직구·송금 전에 대략적인 금액을 확인하려는 분에게 유용합니다.</p>', relatedCalcs: ['overseas-cgt', 'stock-roi'],

  },

  // ════════════════════════════════════════
  // 급여/세금 핵심 (12종)
  // ════════════════════════════════════════
  {
    slug: 'net-salary', emoji: '💰', category: 'salary', categoryLabel: '급여/노동',
    title: '2026 연봉 실수령액 계산기', titleShort: '연봉 실수령액 계산기',
    description: '연봉에서 4대보험·소득세·지방소득세를 공제한 월 실수령액을 자동 계산. 2026년 요율 적용.',
    keywords: ['연봉 실수령액','실수령액 계산기','월급 계산기','4대보험 공제','소득세 공제','2026 연봉'],
    legalBasis: '소득세법, 국민연금법, 건강보험법, 고용보험법', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'tax-bracket', formula: 'netSalary', resultLabel: '월 실수령액', resultUnit: '원',
    inputs: [
      { id: 'annualSalary', label: '연봉', type: 'currency', default: 50000000 },
      { id: 'family', label: '부양가족 수 (본인 포함)', type: 'stepper', default: 1, min: 1, max: 11, hint: '현재 세액 계산에는 반영하지 않는다' },
      { id: 'children', label: '20세 이하 자녀 수', type: 'stepper', default: 0, min: 0, max: 7, hint: '현재 세액 계산에는 반영하지 않는다' },
      { id: 'nonTaxable', label: '비과세액 (식대 등)', type: 'currency', default: 200000, hint: '2026년 식대 비과세 월 20만원' },
    ],
    faqs: [
      { q: '연봉 5000만원 실수령액은?', a: '연봉 5,000만원을 넣으면 결과 화면에 국민연금·건강보험·장기요양·고용보험·소득세·지방소득세 항목별 공제액과 월 실수령액이 나옵니다. 이 계산기의 소득세는 간이세액표가 아니라 «연봉 − 비과세» 에 기본세율을 바로 적용한 근사치라 실제 원천징수액보다 크게 나올 수 있습니다.' },
      { q: '비과세 식대란?', a: '2023년부터 월 20만원까지 식대 비과세. 연봉에서 제외 후 세금 계산.' },
    ],
    seoContent: '<h2>연봉 실수령액이란?</h2><p>세전 연봉에서 근로소득세, 지방소득세, 4대보험료를 공제한 실제 수령 금액입니다. 같은 연봉이라도 비과세 급여, 부양가족 수 등에 따라 실제 실수령액이 달라집니다.</p><h2>연봉 실수령액 계산기 계산 방식</h2><p>연봉에서 비과세액(월 비과세 × 12)을 뺀 과세 급여를 12로 나눠 월 과세 급여를 구합니다. 여기에 국민연금·건강보험·고용보험 근로자 부담률을 곱하고, 장기요양보험료는 건강보험료에 장기요양 비율을 곱해 구합니다. 국민연금에는 월 상한액을 적용합니다. 적용 요율은 계산기에 설정된 4대보험 요율을 쓰며 결과 화면에 항목별 금액으로 나옵니다.</p><h2>소득세는 근사치입니다</h2><p>소득세는 간이세액표를 쓰지 않고 연 과세 급여에 소득세법 기본세율(8단계 누진)을 적용해 12로 나눈 값이며, 지방소득세는 그 10%입니다. 근로소득공제·인적공제·자녀 세액공제는 반영하지 않으므로 실제 원천징수액보다 크게 나올 수 있습니다. 부양가족·자녀 수 입력도 현재 세액에는 반영되지 않습니다.</p>', relatedCalcs: ['4-insurance', 'retirement-pay', 'year-end-refund'],
  },
  {
    slug: '4-insurance', emoji: '🛡️', category: 'salary', categoryLabel: '급여/노동',
    title: '4대보험 계산기', titleShort: '4대보험 계산기',
    description: '월급에서 공제되는 국민연금·건강보험·고용보험·장기요양보험 금액을 계산.',
    keywords: ['4대보험 계산기','국민연금','건강보험','고용보험','장기요양보험','사회보험'],
    legalBasis: '국민연금법, 국민건강보험법, 고용보험법', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'fourInsurance', resultLabel: '월 4대보험 합계', resultUnit: '원',
    inputs: [
      { id: 'monthlySalary', label: '월 급여 (비과세 제외)', type: 'currency', default: 3500000 },
    ],
    faqs: [
      { q: '4대보험 계산기에서 4대보험은 어떻게 적용되나요?', a: '월 급여에 국민연금·건강보험·고용보험 근로자 부담률을 곱하고, 장기요양보험료는 건강보험료에 비율을 곱해 구합니다. 국민연금은 월 상한액을 적용하며, 적용 요율은 결과 화면 항목 이름에 표시됩니다.' },
      { q: '4대보험 계산기 결과가 실제와 다를 수 있나요?', a: '네. 실제 보험료는 신고한 보수월액, 건강보험 연말 정산, 국민연금 하한액 등에 따라 달라질 수 있습니다. 이 계산기는 입력한 월 급여에 요율만 곱하며 하한액·정산은 반영하지 않습니다.' },
      { q: '4대보험 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ],
    seoContent: '<h2>4대보험 계산기 완벽 가이드</h2><p>월급에서 공제되는 국민연금·건강보험·고용보험·장기요양보험 금액을 계산.</p><p>본 계산기는 <strong>국민연금법, 국민건강보험법, 고용보험법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>4대보험 계산기 계산 방식</h2><p>월 급여(비과세 제외)에 국민연금·건강보험·고용보험 근로자 부담률을 곱하고, 장기요양보험료는 건강보험료에 장기요양 비율을 곱해 구합니다. 국민연금에는 월 상한액을 적용합니다. 적용 요율은 결과 화면 항목 이름에 함께 표시됩니다. 소득세·지방소득세는 이 계산기에 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>연봉 협상 중인 직장인, 첫 취업을 앞둔 구직자, 급여 명세서를 이해하고 싶은 분에게 유용합니다.</p>', relatedCalcs: ['net-salary', 'retirement-pay'],
  },
  {
    slug: 'retirement-pay', emoji: '🎉', category: 'salary', categoryLabel: '급여/노동',
    title: '퇴직금 계산기', titleShort: '퇴직금 계산기',
    description: '근속연수·월평균임금으로 세전 퇴직금을 계산. 퇴직소득세는 퇴직소득세 계산기에서 따로 확인.',
    keywords: ['퇴직금 계산기','퇴직금 세금','퇴직소득세','근속연수','평균임금'],
    legalBasis: '근로자퇴직급여보장법 제8조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'retirementPay', resultLabel: '퇴직금 (세전)', resultUnit: '원',
    inputs: [
      { id: 'avgSalary', label: '최근 3개월 월평균임금', type: 'currency', default: 4000000 },
      { id: 'years', label: '근속연수', type: 'number', default: 5, min: 1, max: 40 },
      { id: 'months', label: '추가 개월', type: 'number', default: 0, min: 0, max: 11 },
    ],
    faqs: [
      { q: '퇴직금 계산기에서 4대보험은 어떻게 적용되나요?', a: '적용하지 않습니다. 이 계산기는 «월평균임금 × 근속개월 ÷ 12» 로 세전 퇴직금만 구하며 4대보험료·퇴직소득세를 빼지 않습니다.' },
      { q: '퇴직금 계산기 결과가 실제와 다를 수 있나요?', a: '네. 법정 퇴직금은 1일 평균임금의 30일분을 계속근로기간 1년마다 지급하는 방식이고, 평균임금에는 상여금·연차수당 일부가 포함될 수 있습니다. 이 계산기는 입력한 월평균임금을 그대로 써서 근속개월로 근사합니다.' },
      { q: '퇴직금 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>퇴직금 계산기 완벽 가이드</h2><p>근속연수·월평균임금으로 세전 퇴직금을 계산. 퇴직소득세는 퇴직소득세 계산기에서 따로 확인.</p><p>본 계산기는 <strong>근로자퇴직급여보장법 제8조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>퇴직금 계산기 계산 방식</h2><p>퇴직금(세전) = 최근 3개월 월평균임금 × 총 근속개월 ÷ 12 입니다. 4대보험료와 퇴직소득세는 빼지 않습니다.</p><h2>이런 분들에게 추천</h2><p>연봉 협상 중인 직장인, 첫 취업을 앞둔 구직자, 급여 명세서를 이해하고 싶은 분에게 유용합니다.</p>', relatedCalcs: ['net-salary', 'retirement-pension', 'irp-deduction'],

  },
  {
    slug: 'hourly-annual', emoji: '⏰', category: 'salary', categoryLabel: '급여/노동',
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
      { q: '시급 환산기에서 4대보험은 어떻게 적용되나요?', a: '적용하지 않습니다. 시급과 주당 유급시간으로 세전 월급·연봉만 환산합니다.' },
      { q: '시급 환산기 결과가 실제와 다를 수 있나요?', a: '네. 이 계산기는 1년을 52주로 보고 월 평균 유급시간을 근사합니다. 실제 급여는 근로계약의 소정근로시간·수당 구성에 따라 달라집니다.' },
      { q: '시급 환산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>시급 ↔ 연봉 환산기 완벽 가이드</h2><p>시급을 연봉으로, 연봉을 시급으로 환산. 주휴수당 포함/미포함 선택.</p><p>본 계산기는 <strong>최저임금법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>시급 환산기 계산 방식</h2><p>주휴수당을 포함하면 주당 유급시간 = 근로시간 + 근로시간 ÷ 5 로 봅니다. 시급 → 연봉 은 «시급 × 주당 유급시간 × 52 ÷ 12» 로 월급을 구하고 12를 곱합니다. 연봉 → 시급 은 그 역산입니다. 세금·4대보험을 빼지 않은 세전 금액입니다.</p><h2>이런 분들에게 추천</h2><p>연봉 협상 중인 직장인, 첫 취업을 앞둔 구직자, 급여 명세서를 이해하고 싶은 분에게 유용합니다.</p>', relatedCalcs: ['net-salary', '4-insurance'],
  },
  {
    slug: 'withholding-3-3', emoji: '✂️', category: 'salary', categoryLabel: '급여/노동',
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
      { q: '3.3% 원천징수 계산기에서 4대보험은 어떻게 적용되나요?', a: '국민연금 4.5%, 건강보험 3.545%, 장기요양 0.45%, 고용보험 0.9% — 합계 약 9.4%가 공제됩니다.' },
      { q: '비과세 급여란?', a: '식대(월 20만원), 자가운전보조금(월 20만원), 출산보육수당(월 20만원) 등 소득세 면제 항목입니다.' },
      { q: '3.3% 원천징수 계산기 결과가 실제와 다를 수 있나요?', a: '부양가족 수, 비과세 항목, 보험 상한 등에 따라 차이가 발생합니다. 소득세법 제129조를 기준으로 계산합니다.' },
      { q: '3.3% 원천징수 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>3.3% 원천징수 계산기 완벽 가이드</h2><p>프리랜서 3.3% 원천징수 세전↔세후 역산 + 종합소득세 환급 예상액. 카더라 3.3% 원천징수 계산기는 2026년 4대보험 요율과 근로소득 간이세액표를 반영합니다.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>급여 핵심 정보</h2><p>직장인 세전 급여에서 국민연금(4.5%), 건강보험(3.545%), 장기요양(0.45%), 고용보험(0.9%) 합계 약 9.4%가 공제됩니다. 여기에 근로소득세와 지방소득세가 추가됩니다. 비과세 급여(식대 20만원, 자가운전보조금 20만원)를 활용하면 실수령액을 높일 수 있습니다.</p><h2>이런 분들에게 추천</h2><p>연봉 협상 중인 직장인, 첫 취업을 앞둔 구직자, 급여 명세서를 이해하고 싶은 분에게 유용합니다. 연말정산 환급을 극대화하려면 체크카드 사용 비율을 높이고, IRP/연금저축에 최대 납입하세요.</p>', relatedCalcs: ['comprehensive-income-tax', 'net-salary'],

  },

  // ════════════════════════════════════════
  // 대출/예적금 (8종)
  // ════════════════════════════════════════
  {
    slug: 'loan-repayment', emoji: '🏦', category: 'loan', categoryLabel: '대출/예적금',
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
      { id: 'grace', label: '거치기간 (개월)', type: 'number', default: 0, min: 0, max: 60, hint: '현재 계산에는 반영하지 않는다' },
    ],
    faqs: [
      { q: '원리금균등 vs 원금균등?', a: '원리금균등은 매월 동일 금액, 원금균등은 원금 동일+이자 감소. 총 이자는 원금균등이 적음.' },
    ],
    seoContent: '<h2>대출 상환 방식 비교</h2>\n<p>대출 상환 방식에는 원리금균등, 원금균등, 만기일시상환의 3가지가 있으며 각각 월 부담액과 총 이자가 크게 다릅니다. 자신의 소득 상황과 상환 능력에 맞는 방식을 선택하는 것이 중요합니다.</p>\n<h3>원리금균등 상환</h3>\n<p>매월 동일한 금액(원금+이자)을 납부합니다. 초기에는 이자 비중이 높고 갈수록 원금 비중이 커집니다. 월 부담이 일정하여 가계 예산 관리가 용이하지만, 총 이자는 원금균등보다 많습니다.</p>\n<h3>원금균등 상환</h3>\n<p>매월 동일한 원금을 상환하고, 이자는 잔액에 따라 감소합니다. 초기 부담이 크지만 갈수록 줄어들며, 총 이자가 원리금균등보다 적습니다. 소득이 안정적이고 초기 부담을 감당할 수 있다면 유리합니다.</p>\n<h3>만기일시상환</h3>\n<p>대출 기간 동안 이자만 납부하고 만기에 원금을 일시 상환합니다. 월 부담은 가장 적지만 총 이자가 가장 많고, 만기에 큰 금액을 준비해야 합니다.</p>\n<h2>금리별 3억원 30년 대출 비교</h2>\n<p>이 계산기 산식(원리금균등)으로 계산하면 금리 3.5%: 월 약 134.7만원, 총 이자 약 1억8,497만원. 금리 4.5%: 월 약 152.0만원, 총 이자 약 2억4,722만원. 금리 5.5%: 월 약 170.3만원, 총 이자 약 3억1,321만원. 금리 1%p 차이로 총 이자가 6,000~7,000만원 달라집니다.</p><h2>대출 이자 계산기 계산 방식</h2><p>원리금균등은 «원금 × 월이율 × (1+월이율)^개월 ÷ ((1+월이율)^개월 − 1)» 로 매달 같은 상환액을, 원금균등은 첫 달 상환액(원금 ÷ 개월 + 원금 × 월이율)과 총 이자를, 만기일시는 매달 «원금 × 월이율» 이자를 계산합니다. 월이율은 연 이자율 ÷ 12 입니다. 거치기간 입력은 현재 계산에 반영하지 않습니다.</p>', relatedCalcs: ['deposit-interest', 'dsr-calc', 'ltv-calc'],
  },
  {
    slug: 'deposit-interest', emoji: '🏧', category: 'loan', categoryLabel: '대출/예적금',
    title: '예적금 이자 계산기', titleShort: '예적금 이자 계산기',
    description: '예금·적금 만기 시 세전 이자·세금·세후 수령액을 계산. 단리 기준, 일반 과세·상호금융 예탁금·비과세종합저축 구분.',
    keywords: ['예적금 이자 계산기','예금 이자','적금 만기','세후 이자','비과세 예금'],
    legalBasis: '소득세법 제129조 · 조세특례제한법 제89조의3·제88조의2 · 농어촌특별세법 제5조', version: '2026.09', lastUpdated: '2026-09-17',
    pattern: 'simple', formula: 'depositInterest', resultLabel: '세후 수령액', resultUnit: '원',
    inputs: [
      { id: 'type', label: '상품 유형', type: 'radio', default: 'savings', options: [{ value: 'deposit', label: '예금 (거치)' }, { value: 'savings', label: '적금 (적립)' }] },
      { id: 'amount', label: '예금액 / 월 적립액', type: 'currency', default: 1000000 },
      { id: 'rate', label: '연 이율 (%)', type: 'percent', default: 3.5, min: 0, max: 15, step: 0.1 },
      { id: 'months', label: '기간 (개월)', type: 'number', default: 12, min: 1, max: 60 },
      // K-9 ⓒ — 옛 「세금우대 9.5%」(세금우대종합저축 화석) 제거. 세율 숫자는 라벨에 적지 않는다 — 정본은 policy_constants.
      { id: 'taxType', label: '과세 유형', type: 'radio', default: 'general', options: [{ value: 'general', label: '일반 과세 (은행 등)' }, { value: 'mutual', label: '상호금융 예탁금 (농협·수협·신협·새마을금고 등)' }, { value: 'taxFreeSavings', label: '비과세종합저축 (65세 이상 기초연금 수급자·장애인 등)' }] },
      { id: 'joinYear', label: '가입 연도', type: 'select', default: '2026', condition: 'taxType=mutual', options: [{ value: '2025', label: '2025년 이전' }, { value: '2026', label: '2026년' }, { value: '2027', label: '2027년' }, { value: '2028', label: '2028년' }, { value: '2029', label: '2029년' }, { value: '2030', label: '2030년 이후' }], hint: '이자가 생긴 해가 아니라 «가입한 해» 로 갈린다' },
      { id: 'eligible', label: '가입 당시 요건', type: 'radio', default: 'yes', condition: 'taxType=mutual', options: [{ value: 'yes', label: '충족' }, { value: 'no', label: '해당 없음' }], hint: '농협·수협·산림조합 조합원이거나, 직전 연도 총급여 7천만원 이하(또는 종합소득금액 6천만원 이하)' },
      { id: 'farmExempt', label: '농어촌특별세 면제 대상', type: 'radio', default: 'no', condition: 'taxType=mutual', options: [{ value: 'no', label: '아니오' }, { value: 'yes', label: '예' }], hint: '농어민·임업인(5ha 이상 산림 소유자 제외)·연 총소득 2,500만원 이하 근로자' },
    ],
    faqs: [
      { q: '예적금 이자 계산기는 실제 이자와 차이가 있나요?', a: '있을 수 있습니다. 이 계산기는 연 이율을 개월 수에 비례시킨 단리로 계산하며 복리 상품·우대금리·일할 계산·중도해지 이율은 반영하지 않습니다. 가입 상품의 이자 계산 방식을 확인하세요.' },
      { q: '예적금 이자 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>예적금 이자 계산기 완벽 가이드</h2><p>예금·적금 만기 시 세전 이자·세금·세후 수령액을 계산. 단리 기준, 일반 과세·상호금융 예탁금·비과세종합저축 구분.</p><h2>예적금 이자 계산기 계산 방식</h2><p>예금은 «예금액 × 연 이율 × 개월 ÷ 12», 적금은 매달 넣은 금액이 만기까지 남은 개월만큼 이자를 받는 단리로 계산합니다. 세금은 과세 유형별로 가릅니다 — 일반 과세는 소득세와 지방소득세, 상호금융 예탁금·비과세종합저축은 원금 한도 안 이자에 특례(저율 분리과세·비과세)와 농어촌특별세를 적용하고 한도를 넘는 이자는 일반 과세로 계산합니다. 세율·한도는 서버의 정책 표에서 받아 결과 화면에 표시하며, 받지 못하면 계산하지 않습니다. 복리 상품·우대금리·중도해지 이율은 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>예금·적금 가입 전에 만기 수령액을 비교하거나, 상호금융 예탁금 저율과세가 적용되는지 확인하려는 분에게 유용합니다.</p>', relatedCalcs: ['compound-interest', 'loan-repayment'],

  },

  // ════════════════════════════════════════
  // 세금 핵심 (주요 10종만 상세 — 나머지는 패턴 반복)
  // ════════════════════════════════════════
  {
    slug: 'acquisition-tax', emoji: '🏠', category: 'property-tax', categoryLabel: '부동산 세금',
    title: '2026 취득세 계산기', titleShort: '취득세 계산기',
    seoTitle: '취득세 계산기 — 주택 취득세·지방교육세 계산',
    description: '주택 매매·증여·상속 취득세와 지방교육세·농어촌특별세를 계산. 다주택·증여 중과, 상속 1가구1주택 특례, 생애최초 감면, 지방 준공후미분양 경감 반영.',
    keywords: ['취득세 계산기','부동산 취득세','취득세율','다주택 중과','증여 취득세','상속 취득세','생애최초 감면','미분양 취득세 감면','2026 취득세'],
    legalBasis: '지방세법 제11조·제13조의2·제15조·제151조, 지방세특례제한법 제33조의3·제36조의3', version: '2026.09', lastUpdated: '2026-09-17',
    pattern: 'tax-bracket', formula: 'acquisitionTax', resultLabel: '취득세 합계', resultUnit: '원',
    inputs: [
      { id: 'price', label: '과세표준 (매매: 취득가액 · 증여: 시가인정액 · 상속: 시가표준액)', type: 'currency', default: 500000000 },
      { id: 'type', label: '취득 유형', type: 'radio', default: 'purchase', options: [{ value: 'purchase', label: '매매' }, { value: 'gift', label: '증여' }, { value: 'inherit', label: '상속' }] },
      { id: 'houseCount', label: '보유 주택수 (취득 후, 1세대 기준)', type: 'stepper', default: 1, min: 1, max: 5, condition: 'type=purchase' },
      // ⚠️ 목록을 코드에 두지 «않는다». 대신 «기준일을 박은» 안내만 붙인다.
      { id: 'regulated', label: '조정대상지역', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], hint: '2025-10-16 기준 서울 전역·경기 12곳. 최신 지정 현황은 국토교통부 공고를 확인한다.' },
      // K-9 local — 증여 중과는 «받는 사람 주택 수» 가 아니라 시가표준액·증여자 요건으로 판정한다(§13의2② · 영 §28의6).
      { id: 'standardValue', label: '시가표준액 (공시가격)', type: 'currency', default: 0, condition: 'type=gift', hint: '조정대상지역 증여는 시가표준액이 문턱 이상이면 중과된다 — 공동주택 공시가격을 넣는다.' },
      { id: 'giftFrom1House', label: '1세대1주택자의 주택을 배우자·직계존비속이 받음', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], condition: 'type=gift', hint: '해당하면 조정대상지역이어도 중과하지 않는다(사실혼 배우자 제외).' },
      { id: 'inherit1House', label: '상속 후 1가구 1주택 (무주택 상속인)', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], condition: 'type=inherit', hint: '상속인과 같은 세대가 상속 주택 하나만 보유. 공동상속은 지분이 가장 큰 상속인 기준.' },
      { id: 'area85', label: '전용면적', type: 'radio', default: 'under', options: [{ value: 'under', label: '85㎡ 이하' }, { value: 'over', label: '85㎡ 초과' }], hint: '농어촌특별세는 85㎡ 초과에만 부과된다(서민주택 비과세).' },
      { id: 'firstTime', label: '생애최초 주택 구입 (매매만)', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], condition: 'type=purchase', hint: '본인·배우자 무주택 · 본인 거주 목적 · 미성년자 제외. 감면 한도·가액·일몰은 계산 결과에 근거와 함께 표시된다.' },
      { id: 'firstTrack', label: '생애최초 감면 구분', type: 'radio', default: 'general', options: [{ value: 'general', label: '일반 주택' }, { value: 'small', label: '인구감소지역 주택 / 60㎡ 이하 소형 비아파트' }], condition: 'firstTime=yes', hint: '소형 비아파트: 60㎡ 이하·3억원(수도권 6억원) 이하 연립·다세대·도시형 생활주택·다가구 호수.' },
      { id: 'unsoldLocal', label: '지방 준공후 미분양 아파트 (매매만)', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], condition: 'type=purchase', hint: '사용검사 후 분양되지 않은 아파트를 사업주체로부터 사는 경우의 취득세 경감(세율 특례가 아니다).' },
      { id: 'unsoldNonCapital', label: '수도권 외 지역', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], condition: 'unsoldLocal=yes' },
      { id: 'unsoldFirst', label: '사업주체로부터 최초 유상 취득 (부담부증여 아님)', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], condition: 'unsoldLocal=yes' },
      { id: 'unsoldIndividual', label: '개인 취득 (법인·단체 아님)', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], condition: 'unsoldLocal=yes' },
      { id: 'unsoldOccupancy', label: '실제 입주 기간 1년 미만', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], condition: 'unsoldLocal=yes', hint: '임대차계약 임차인이 입주한 기간은 빼고 센다.' },
      { id: 'unsoldOrdinancePct', label: '조례 추가 경감률 (%)', type: 'number', default: 0, min: 0, max: 25, condition: 'unsoldLocal=yes', hint: '지자체 조례로 추가 경감이 있을 때만 넣는다. 기본 0 = 조례분 미반영.' },
    ],
    faqs: [
      { q: '매매 취득세율은?', a: '1주택 등 중과 비대상은 취득가액 6억원 이하 1%, 6억 초과 9억 이하는 산식(1~3%), 9억 초과 3%. 조정대상지역 2주택 8%·3주택 이상 12%(비조정은 3주택 8%·4주택 이상 12%). 지방세법 2026-07-01 시행본 기준이며, 계산 결과에 적용 근거가 함께 표시된다.' },
      { q: '증여 취득세 중과는 누구에게 붙나요?', a: '받는 사람의 주택 수가 아니라 ①조정대상지역 ②시가표준액 3억원 이상 ③1세대1주택자의 주택을 배우자·직계존비속이 받는 경우가 아닐 것 — 셋을 모두 충족하면 12%다(지방세법 §13의2②·시행령 §28의6, 2026-09-17 원문 대조).' },
      { q: '생애최초 감면은 얼마인가요?', a: '매매(유상거래)로 취득당시가액 12억원 이하 주택을 처음 살 때 «취득세» 에서 200만원(인구감소지역·소형 비아파트 300만원)까지 뺀다. 지방교육세·농특세 합계에서 빼는 것이 아니며 증여·상속에는 없다. 일몰은 계산 결과에 표시된다(지특법 §36의3, 2026-09-17 기준 2028-12-31).' },
      { q: '지방 미분양 아파트를 사면 취득세가 줄어드나요?', a: '수도권 외·85㎡ 이하·6억원 이하 준공후 미분양 아파트를 사업주체로부터 처음 사면 취득세 25%를 경감한다(조례로 최대 25% 추가). 법인 취득·입주 1년 이상은 제외(지특법 §33의3④, 2026-09-17 기준 기한 2026-12-31).' },
    ],
    seoContent: '<h2>취득세란?</h2>\n<p>취득세는 부동산 등을 취득할 때 내는 지방세다. 주택은 취득 원인(매매·증여·상속), 1세대 주택 수, 조정대상지역, 전용면적에 따라 세율과 부가세목이 달라진다.</p>\n<h2>계산 방식</h2>\n<p>세율·한도·문턱은 국가법령정보센터 현행 원문과 대조한 정책 상수표에서 받아 쓰며, 결과 화면에 근거 조문과 기준일을 함께 표시한다. 매매는 취득가액, 증여는 시가인정액, 상속은 시가표준액이 과세표준이다.</p>\n<h3>부가세목</h3>\n<p>지방교육세는 매매 주택이면 «세율의 절반»의 20%, 증여·상속이면 «세율에서 2%를 뺀 값»의 20%, 중과면 0.4%다. 농어촌특별세는 전용 85㎡ 초과에만 붙고, 감면을 받으면 감면세액의 20%가 붙는다(85㎡ 이하 제외).</p>\n<h2>감면</h2>\n<p>생애최초 주택 구입 감면은 매매에만 있고 취득세에서 한도만큼 뺀다. 지방 준공후 미분양 아파트는 요건을 모두 갖추면 취득세를 25% 경감한다. 두 감면이 겹치면 감면액이 큰 하나만 적용한다(지특법 §180).</p>\n<h2>반영하지 않는 것</h2>\n<p>일시적 2주택 중과 제외 판정, 법인 취득, 비영리사업자·농지 세율, 부담부증여의 채무 부분, 조례에 따른 세율 가감은 계산에 들어 있지 않다. 취득일부터 60일 이내 신고·납부한다.</p>', relatedCalcs: ['registration-cost', 'brokerage-fee', 'capital-gains-housing'],
  },
  {
    slug: 'capital-gains-housing', emoji: '📝', category: 'property-tax', categoryLabel: '부동산 세금',
    title: '2026 양도소득세 계산기 (주택)', titleShort: '양도소득세 계산기',
    description: '주택 매도 시 양도소득세를 계산. 1세대1주택 비과세(취득 당시 조정대상지역 거주요건)·일시적 2주택, 장기보유특별공제 표 1·표 2, 단기세율, 2026-05-10 이후 양도분 다주택 중과(양도 당시 조정대상지역) 반영.',
    keywords: ['양도소득세 계산기','양도세','주택 양도세','1세대1주택','장기보유특별공제','비과세','다주택 중과'],
    legalBasis: '소득세법 제89조, 제95조, 제103조, 제104조 · 시행령 제154조, 제155조, 제159조의4, 제160조, 제167조의10 · 지방세법 제103조의3', version: '2026.09', lastUpdated: '2026-09-17',
    pattern: 'conditional', formula: 'capitalGainsHousing', resultLabel: '양도소득세 (지방소득세 포함)', resultUnit: '원',
    inputs: [
      { id: 'sellPrice', label: '양도가액 (매도가)', type: 'currency', default: 900000000 },
      { id: 'buyPrice', label: '취득가액 (매수가)', type: 'currency', default: 600000000 },
      { id: 'expenses', label: '필요경비 (취득세+중개비 등)', type: 'currency', default: 15000000 },
      { id: 'holdYears', label: '보유기간 (년)', type: 'number', default: 5, min: 0, max: 30 },
      { id: 'liveYears', label: '거주기간 (년, 보유기간 중)', type: 'number', default: 3, min: 0, max: 30 },
      { id: 'houseCount', label: '보유 주택수 (양도 당시, 파는 주택 포함)', type: 'stepper', default: 1, min: 1, max: 5 },
      { id: 'temporary2', label: '일시적 2주택 요건', type: 'radio', default: 'no', condition: 'houseCount=2', options: [{ value: 'yes', label: '충족' }, { value: 'no', label: '아님' }], hint: '파는 주택 취득 후 1년 이상 지나 새 주택을 샀고, 새 주택 취득일부터 3년 이내에 파는 경우(시행령 §155①)' },
      { id: 'acqRegulated', label: '«취득 당시» 조정대상지역', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], hint: '비과세 거주요건(2년)의 기준 — 시행령 §154①' },
      { id: 'saleRegulated', label: '«양도 당시» 조정대상지역', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], hint: '다주택 중과의 기준 — 소득세법 §104⑦' },
      { id: 'saleTiming', label: '양도 시기 (다주택 중과 유예)', type: 'radio', default: 'after', options: [{ value: 'after', label: '2026-05-10 이후 양도' }, { value: 'grace', label: '유예 적용분' }], hint: '유예 적용분 = 2026-05-09까지 양도했거나, 5-09까지 계약(토지거래허가 대상은 허가 신청)해 경과규정 기한 안에 양도한 경우(시행령 §167의10①12의2). 보유 2년 이상 주택만' },
    ],
    faqs: [
      { q: '1세대1주택 비과세 요건은?', a: '보유 2년 이상. «취득 당시» 조정대상지역 주택이면 보유기간 중 거주 2년 이상이 더 필요합니다. 양도가액 12억원 이하면 전액, 초과하면 초과분 비율만큼 과세합니다(소득세법 §89①3, 시행령 §154①·§160, 2026-09-17 원문 대조 기준).' },
      { q: '다주택 중과 유예는 끝났나요?', a: '네. 유예는 2026-05-09 양도분까지였고 재유예 개정은 공포되지 않았습니다. 2026-05-10 이후 «양도 당시» 조정대상지역 주택을 팔면 2주택 +20%p, 3주택 이상 +30%p가 붙고 장기보유특별공제를 받지 못합니다. 5-09까지 계약(토지거래허가 대상은 허가 신청)한 경과규정분만 예외입니다(시행령 §167의10①12의2, 2026-09-17 원문 대조 기준).' },
      { q: '계산하지 않는 것은?', a: '중과 제외 주택(장기임대·저가주택 등), 조합원입주권·분양권 보유 시 판정, 상속·동거봉양·혼인 특례, 지방소득세 조례 가감은 반영하지 않습니다.' },
    ],
    seoContent: '<h2>양도소득세란?</h2>\n<p>양도소득세는 부동산 등 자산을 양도해 생긴 소득에 붙는 국세입니다. 양도차익(양도가액 − 취득가액 − 필요경비)에서 장기보유특별공제와 기본공제를 뺀 과세표준에 세율을 적용하고, 지방소득세(소득세 세율의 1/10 구조)가 따로 붙습니다.</p>\n<h2>세율 구조 (2026-09-17 원문 대조 기준)</h2>\n<p>기본세율은 소득세법 §55①의 8단계 누진세율입니다. 주택·조합원입주권·분양권을 2년 미만 보유하면 단기세율(1년 미만 70%, 1년 이상 2년 미만 60%, §104①2·3)이 적용되고, 둘 이상 해당하면 큰 세액을 씁니다. «양도 당시» 조정대상지역 주택은 2026-05-10 이후 양도분부터 2주택 +20%p, 3주택 이상 +30%p 중과(§104⑦)가 다시 적용됩니다.</p>\n<h3>장기보유특별공제</h3>\n<p>일반(표 1): 보유 3년 6%부터 연 2%p, 15년 30%. 1세대1주택이면서 보유기간 중 거주 2년 이상(표 2): 보유 3년 12%부터 연 4%p·10년 40%, 거주 2년 8%(보유 3년 이상 한정)·3년 12%부터 연 4%p·10년 40%. 중과 대상은 공제가 없습니다(§95②).</p>\n<h2>1세대1주택 비과세</h2>\n<p>보유 2년 이상, «취득 당시» 조정대상지역이면 거주 2년 이상. 양도가액 12억원 초과분은 비율만큼 과세합니다. 일시적 2주택(새 주택 취득일부터 3년 이내 종전 주택 양도)도 1주택으로 봅니다(시행령 §155①).</p>', relatedCalcs: ['one-house-check', 'multi-house-sim', 'acquisition-tax'],
  },
  {
    slug: 'gift-tax', emoji: '🎁', category: 'inheritance', categoryLabel: '상속/증여',
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
        { value: 'grandchild', label: '손자녀 (30% 할증 — 공제는 현재 미반영)' },
      ]},
      { id: 'priorGifts', label: '10년 내 사전증여액', type: 'currency', default: 0 },
    ],
    faqs: [
      { q: '증여 면제한도는?', a: '배우자 6억, 성년자녀 5천만, 미성년자녀 2천만, 기타친족 1천만 (10년 합산).' },
    ],
    seoContent: '<h2>증여세란?</h2>\n<p>증여세는 타인으로부터 재산을 무상으로 받을 때 수증자(받는 사람)에게 부과되는 세금입니다. 증여받은 재산가액에서 증여재산공제를 차감한 과세표준에 10~50%의 누진세율을 적용합니다.</p>\n<h2>2026년 증여세율</h2>\n<p>1억원 이하 10%, 1~5억원 20%(누진공제 1,000만원), 5~10억원 30%(누진공제 6,000만원), 10~30억원 40%(누진공제 1억6,000만원), 30억원 초과 50%(누진공제 4억6,000만원).</p>\n<h3>증여재산공제 (10년간 합산)</h3>\n<p>배우자: 6억원. 성년 자녀(직계비속): 5,000만원. 미성년 자녀: 2,000만원. 기타 친족(6촌 이내 혈족, 4촌 이내 인척): 1,000만원. 10년마다 한도가 리셋됩니다.</p>\n<h2>증여세 절세 전략</h2>\n<p>10년 주기 분할 증여가 가장 효과적입니다. 자녀에게 10년마다 5,000만원씩 증여하면 비과세입니다. 미성년 시기부터 2,000만원씩 시작하고, 성년 후 5,000만원으로 확대하면 수십 년간 수억원을 비과세로 이전할 수 있습니다. 부동산 증여 시 시가가 아닌 기준시가(공시가격)로 평가하면 증여세를 줄일 수 있습니다.</p>', relatedCalcs: ['inheritance-tax', 'generation-skip', 'acquisition-tax'],
  },
  {
    slug: 'overseas-cgt', emoji: '🌍', category: 'finance-tax', categoryLabel: '금융/투자 세금',
    title: '해외주식 양도소득세 계산기', titleShort: '해외주식 양도세 계산기',
    description: '해외주식 매도 차익에 대한 양도소득세 계산. 기본공제(주식등 소득 합산 연 1회), 소득세 20% + 지방소득세, 국내시장복귀계좌(RIA) 공제 특례 선택 반영.',
    keywords: ['해외주식 양도세','해외주식 세금','미국주식 세금','250만원 공제','양도소득세','국내시장복귀계좌','RIA'],
    legalBasis: '소득세법 제94조제1항제3호다목, 제103조제1항제2호, 제104조제1항제12호 · 지방세법 제103조의3 · 조세특례제한법 제91조의26', version: '2026.09', lastUpdated: '2026-09-17',
    pattern: 'simple', formula: 'overseasCgt', resultLabel: '양도소득세 (지방소득세 포함)', resultUnit: '원',
    inputs: [
      { id: 'profit', label: '양도차익 (매도가-매수가-수수료)', type: 'currency', default: 10000000 },
      { id: 'otherProfit', label: '당해연도 다른 해외주식 차익', type: 'currency', default: 0 },
      { id: 'otherLoss', label: '당해연도 해외주식 손실', type: 'currency', default: 0 },
      { id: 'deductionUsed', label: '올해 기본공제(250만원)를 다른 주식 양도에서 이미 썼나요?', type: 'radio', default: 'no', options: [{ value: 'no', label: '아니오' }, { value: 'yes', label: '이미 사용' }], hint: '국내 대주주·비상장 주식 등과 합산해 연 1회(소득세법 §103①2)' },
      { id: 'ria', label: '국내시장복귀계좌(RIA)로 판 주식 포함', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] },
      { id: 'riaGain', label: 'RIA로 판 해외주식 양도차익', type: 'currency', default: 0, condition: 'ria=yes', hint: '2025-12-23 이전 보유분을 RIA로 2026-12-31까지 양도한 부분' },
      { id: 'riaPeriod', label: 'RIA 양도 시기', type: 'radio', default: 'p3', condition: 'ria=yes', options: [{ value: 'p1', label: '1/1~5/31' }, { value: 'p2', label: '6/1~7/31' }, { value: 'p3', label: '8/1~12/31' }] },
      { id: 'riaRatio', label: 'RIA 조정비율 (0~1)', type: 'number', default: 1, min: 0, max: 1, step: 0.01, condition: 'ria=yes', hint: '1 − (A−B)/C — RIA 밖 계좌의 해외주식·해외지수 ETF 순매수가 있으면 줄어든다(조특법 시행령 §93조의12④). 증권사 산정치를 넣는다' },
    ],
    faqs: [
      { q: '해외주식 양도세는 어떻게 계산하나요?', a: '연간 해외주식 차익과 손실을 통산한 뒤 기본공제를 빼고 소득세 20%(소득세법 §104①12나)와 지방소득세(소득세의 1/10 구조)를 더합니다(2026-09-17 원문 대조 기준).' },
      { q: '기본공제 250만원은 계좌마다 받나요?', a: '아니요. 국내 대주주·비상장 주식 등 «주식등» 소득 전체에서 연 1회입니다(소득세법 §103①2).' },
      { q: '국내시장복귀계좌(RIA) 특례는?', a: '2025-12-23 이전부터 보유한 해외상장주식을 RIA로 2026-12-31까지 팔면 양도 시기에 따라 양도소득금액의 100%(1~5월)·80%(6~7월)·50%(8~12월)에 조정비율을 곱한 금액을 공제합니다. 납입일부터 1년 안에 인출하면 추징됩니다(조특법 §91조의26, 2026-09-17 원문 대조 기준).' },
      { q: '해외주식 양도세 계산기는 모바일에서도 되나요?', a: '네, 모바일·태블릿·PC 모든 기기에서 앱 설치 없이 사용 가능합니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 공유 가능합니다.' },
    ],
    seoContent: '<h2>해외주식 양도소득세 계산기</h2><p>해외주식 매도 차익에 대한 양도소득세를 계산합니다. 과세대상은 외국법인 발행·외국시장 상장 주식등(소득세법 §94①3다)이고, 세율은 20%(§104①12나)에 지방소득세 2%(지방세법 §103의3①12)가 붙습니다. 기본공제 250만원은 주식등 소득 전체에서 연 1회입니다(§103①2).</p><h2>2026년 국내시장복귀계좌 특례</h2><p>조세특례제한법 §91조의26 — RIA로 양도한 해외상장주식 양도소득금액에서 시기별 100/80/50% × 조정비율을 공제합니다. 조정비율은 RIA 밖 계좌의 해외주식 순매수를 반영하는 산식입니다(조특법 시행령 §93조의12④).</p><p>2026-09-17 원문 대조 기준. 참고용이며 실제 신고는 증권사 자료와 세무 전문가 확인을 권장합니다.</p>', relatedCalcs: ['stock-roi', 'major-shareholder-cgt', 'financial-income-tax'],
  },
  {
    slug: 'financial-income-tax', emoji: '💳', category: 'finance-tax', categoryLabel: '금융/투자 세금',
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
      { q: '금융소득종합과세 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 소득세법 제14조, 제62조를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '금융소득종합과세 계산기에서 가장 중요한 입력값은?', a: '이자+배당 합산 2,000만원 초과 시 종합과세 세금을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '금융소득종합과세 계산기는 무료인가요?', a: '네, 카더라 금융소득종합과세 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '금융소득종합과세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>금융소득종합과세 계산기 완벽 가이드</h2><p>이자+배당 합산 2,000만원 초과 시 종합과세 세금을 계산. 카더라 금융소득종합과세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제14조, 제62조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>금융/투자 세금 핵심 정보</h2><p>금융투자 수익 과세: 국내 상장주식은 대주주만 양도세, 해외주식은 250만원 초과 시 22%, ETF 배당은 15.4%, ISA 비과세 한도는 일반 200만원·서민 400만원입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 금융/투자 세금 계산이 필요한 분에게 유용합니다. 카더라는 금융/투자 세금 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['dividend-calc', 'deposit-interest', 'overseas-cgt'],

  },

  // ════════════════════════════════════════
  // 생활/건강 (핵심 6종)
  // ════════════════════════════════════════
  {
    slug: 'bmi', emoji: '⚖️', category: 'life', categoryLabel: '생활/건강',
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
    seoContent: '<h2>BMI(체질량지수)란?</h2><p>BMI = 체중(kg) ÷ 키(m)². 비만도를 간편하게 판단하는 국제 표준 지표입니다. 대한비만학회 기준: 저체중 18.5 미만, 정상 18.5~22.9, 과체중 23~24.9, 비만 25 이상.</p><h2>아시아-태평양 BMI 기준</h2><p>WHO 기준(25 이상 과체중)보다 아시아 기준이 더 엄격합니다. 한국인은 BMI 23부터 과체중으로 분류되며, 25 이상은 비만입니다.</p><h2>BMI의 한계</h2><p>근육량, 체지방률, 체형을 고려하지 않습니다. 보다 정확한 판단을 위해 체지방률, 허리둘레, 체성분 분석(InBody) 등을 함께 확인하세요.</p><h2>건강 체중 관리</h2><p>건강한 BMI 22 기준 목표 체중 = 22 × 키(m)². 키 170cm→63.6kg. 한 달 2~4kg 이내 감량이 건강하고 요요를 방지합니다.</p>', relatedCalcs: ['calorie', 'body-fat', 'bmr'],
  },
  {
    slug: 'due-date', emoji: '👶', category: 'life', categoryLabel: '생활/건강',
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
      { q: '출산 예정일 계산기 결과는 의학적으로 정확한가요?', a: '일반적인 공식 기반 참고 수치입니다. 정확한 건강 판단은 의료 전문가와 상담하세요.' },
      { q: '출산 예정일 계산기는 남녀 기준이 다른가요?', a: '대부분의 건강 지표는 성별에 따라 다른 기준을 적용합니다. 성별 선택 시 자동 반영됩니다.' },
      { q: '출산 예정일 계산기는 무료인가요?', a: '네, 카더라 출산 예정일 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '출산 예정일 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>출산 예정일 계산기 완벽 가이드</h2><p>마지막 생리일로부터 출산 예정일을 계산. 임신 주수 확인. 카더라 출산 예정일 계산기는 과학적 공식과 최신 기준을 반영합니다.</p><p>본 계산기는 <strong>Naegele 법칙</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>건강·생활 핵심 정보</h2><p>BMI(18.5~22.9 정상), 체지방률, 기초대사량 등 건강 지표는 종합적으로 판단해야 합니다. 대한비만학회 기준은 WHO보다 엄격하여 BMI 23부터 과체중으로 분류합니다. 정확한 건강 평가는 의료 전문가와 상담하시기 바랍니다.</p><h2>이런 분들에게 추천</h2><p>체중 관리, 건강 관리를 계획 중인 분, 출산·육아를 준비하는 분, 일상의 궁금한 계산이 필요한 분에게 유용합니다. 정기적으로 계산하여 변화 추이를 기록하면 효과적입니다.</p>', relatedCalcs: ['bmi', 'calorie'],
  },
  {
    slug: 'electricity', emoji: '⚡', category: 'life', categoryLabel: '생활/건강',
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
      { q: '전기요금 계산기 결과는 의학적으로 정확한가요?', a: '일반적인 공식 기반 참고 수치입니다. 정확한 건강 판단은 의료 전문가와 상담하세요.' },
      { q: '전기요금 계산기는 남녀 기준이 다른가요?', a: '대부분의 건강 지표는 성별에 따라 다른 기준을 적용합니다. 성별 선택 시 자동 반영됩니다.' },
      { q: '전기요금 계산기는 무료인가요?', a: '네, 카더라 전기요금 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '전기요금 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>전기요금 계산기 완벽 가이드</h2><p>월 사용량(kWh)으로 누진세 전기요금을 계산. 주택용/일반용. 카더라 전기요금 계산기는 과학적 공식과 최신 기준을 반영합니다.</p><p>본 계산기는 <strong>한국전력 전기요금표</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>건강·생활 핵심 정보</h2><p>BMI(18.5~22.9 정상), 체지방률, 기초대사량 등 건강 지표는 종합적으로 판단해야 합니다. 대한비만학회 기준은 WHO보다 엄격하여 BMI 23부터 과체중으로 분류합니다. 정확한 건강 평가는 의료 전문가와 상담하시기 바랍니다.</p><h2>이런 분들에게 추천</h2><p>체중 관리, 건강 관리를 계획 중인 분, 출산·육아를 준비하는 분, 일상의 궁금한 계산이 필요한 분에게 유용합니다. 정기적으로 계산하여 변화 추이를 기록하면 효과적입니다.</p>', relatedCalcs: ['bmi'],

  },
  {
    slug: 'discharge-date', emoji: '🪖', category: 'military', categoryLabel: '군대/교육',
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
      { q: '전역일 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 병역법 시행령를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '전역일 계산기에서 가장 중요한 입력값은?', a: '입대일과 군종으로 전역 예정일과 남은 복무일수를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '전역일 계산기는 무료인가요?', a: '네, 카더라 전역일 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '전역일 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>전역일 계산기 완벽 가이드</h2><p>입대일과 군종으로 전역 예정일과 남은 복무일수를 계산. 카더라 전역일 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>병역법 시행령</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>군대/교육 핵심 정보</h2><p>2026년 병사 월급: 이병 67만원, 일병 78만원, 상병 97만원, 병장 125만원. 군 복무 중 학자금 대출 이자 지원, 전역 후 복학 시 등록금 감면 등 혜택을 확인하세요.</p><h2>이런 분들에게 추천</h2><p>정확한 군대/교육 계산이 필요한 분에게 유용합니다. 카더라는 군대/교육 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['military-pay'],
  },

  // ════════════════════════════════════════
  // 연금/은퇴 (핵심 3종)
  // ════════════════════════════════════════
  {
    slug: 'national-pension', emoji: '🏛️', category: 'pension', categoryLabel: '연금/은퇴',
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
      { q: '국민연금 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 국민연금법 제51조를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '국민연금 계산기에서 가장 중요한 입력값은?', a: '월 소득·가입기간으로 국민연금 예상 수령액을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '국민연금 계산기는 무료인가요?', a: '네, 카더라 국민연금 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '국민연금 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 포함 142종의 무료 계산기를 제공합니다.' },
    ],
    seoContent: '<h2>국민연금 예상 수령액 계산기 완벽 가이드</h2><p>월 소득·가입기간으로 국민연금 예상 수령액을 계산. 카더라 국민연금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>국민연금법 제51조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연금/은퇴 핵심 정보</h2><p>국민연금 수령액은 가입기간과 소득에 따라 달라집니다. 퇴직연금(DB/DC), 개인연금(IRP, 연금저축)을 합산하면 안정적인 노후 소득을 설계할 수 있습니다. FIRE 운동의 핵심은 저축률(50%+)과 투자 수익률입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 연금/은퇴 계산이 필요한 분에게 유용합니다. 카더라는 연금/은퇴 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['fire-calc', 'irp-deduction', 'retirement-pay'],

  },
  {
    slug: 'fire-calc', emoji: '🔥', category: 'pension', categoryLabel: '연금/은퇴',
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
      { q: 'FIRE 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: 'FIRE 계산기에서 가장 중요한 입력값은?', a: '경제적 자유를 위한 목표 자산, 현재 저축률 기반 FIRE 달성 시기를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: 'FIRE 계산기는 무료인가요?', a: '네, 카더라 FIRE 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: 'FIRE 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ],
    seoContent: '<h2>FIRE 은퇴자금 계산기 완벽 가이드</h2><p>경제적 자유를 위한 목표 자산, 현재 저축률 기반 FIRE 달성 시기를 계산.</p><h2>FIRE 계산기 계산 방식</h2><p>목표 자산 = 월 생활비 × 12 ÷ 인출률 입니다. 매년 «(자산 + 월 저축 × 12) × (1 + 기대수익률)» 로 자산을 불려 목표에 닿는 해를 셉니다(최대 100년). 세금·물가 상승·수수료는 이 계산에 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 연금/은퇴 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['compound-interest', 'national-pension', 'dca-simulator'],
  },
  {
    slug: 'irp-deduction', emoji: '🏦', category: 'pension', categoryLabel: '연금/은퇴',
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
      { q: 'IRP 세액공제 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 소득세법 제59조의3를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: 'IRP 세액공제 계산기에서 가장 중요한 입력값은?', a: '연금저축·IRP 납입액에 따른 세액공제 환급액을 소득 구간별로 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: 'IRP 세액공제 계산기는 무료인가요?', a: '네, 카더라 IRP 세액공제 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: 'IRP 세액공제 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 포함 142종의 무료 계산기를 제공합니다.' },
    ],
    seoContent: '<h2>연금저축/IRP 세액공제 계산기 완벽 가이드</h2><p>연금저축·IRP 납입액에 따른 세액공제 환급액을 소득 구간별로 계산. 카더라 IRP 세액공제 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제59조의3</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연금/은퇴 핵심 정보</h2><p>국민연금 수령액은 가입기간과 소득에 따라 달라집니다. 퇴직연금(DB/DC), 개인연금(IRP, 연금저축)을 합산하면 안정적인 노후 소득을 설계할 수 있습니다. FIRE 운동의 핵심은 저축률(50%+)과 투자 수익률입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 연금/은퇴 계산이 필요한 분에게 유용합니다. 카더라는 연금/은퇴 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['national-pension', 'year-end-refund', 'net-salary'],

  },

  // ════════════════════════════════════════
  // 추가 생활/건강 (6종)
  // ════════════════════════════════════════
  {
    slug: 'calorie', emoji: '🍎', category: 'life', categoryLabel: '생활/건강',
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
      { q: '칼로리 계산기 결과는 의학적으로 정확한가요?', a: '일반적인 공식 기반 참고 수치입니다. 정확한 건강 판단은 의료 전문가와 상담하세요.' },
      { q: '칼로리 계산기는 남녀 기준이 다른가요?', a: '네. 성별을 입력받아 Mifflin-St Jeor 공식의 상수를 남성(+5)·여성(−161)으로 다르게 적용합니다.' },
      { q: '칼로리 계산기는 무료인가요?', a: '네, 카더라 칼로리 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '칼로리 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>칼로리 계산기 완벽 가이드</h2><p>키·몸무게·활동량으로 일일 권장 칼로리(TDEE)를 계산.</p><p>본 계산기는 <strong>Mifflin-St Jeor 공식</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>칼로리 계산기 계산 방식</h2><p>Mifflin-St Jeor 공식으로 기초대사량을 구합니다 — 남성 «10 × 체중 + 6.25 × 키 − 5 × 나이 + 5», 여성 «… − 161». 여기에 활동량 계수를 곱해 일일 권장 칼로리(TDEE)를 구하고, 다이어트 목표는 그 80%로 보여줍니다.</p><h2>이런 분들에게 추천</h2><p>체중 관리, 건강 관리를 계획 중인 분, 출산·육아를 준비하는 분, 일상의 궁금한 계산이 필요한 분에게 유용합니다. 정기적으로 계산하여 변화 추이를 기록하면 효과적입니다.</p>', relatedCalcs: ['bmi', 'body-fat', 'bmr'],
  },
  {
    slug: 'body-fat', emoji: '💪', category: 'life', categoryLabel: '생활/건강',
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
      { q: '체지방률 계산기 결과는 의학적으로 정확한가요?', a: '일반적인 공식 기반 참고 수치입니다. 정확한 건강 판단은 의료 전문가와 상담하세요.' },
      { q: '체지방률 계산기는 남녀 기준이 다른가요?', a: '대부분의 건강 지표는 성별에 따라 다른 기준을 적용합니다. 성별 선택 시 자동 반영됩니다.' },
      { q: '체지방률 계산기는 무료인가요?', a: '네, 카더라 체지방률 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '체지방률 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>체지방률 계산기 완벽 가이드</h2><p>BMI 기반 체지방률 추정. 미 해군 공식(허리/목 둘레) 지원. 카더라 체지방률 계산기는 과학적 공식과 최신 기준을 반영합니다.</p><p>본 계산기는 <strong>BMI-체지방 추정 공식</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>건강·생활 핵심 정보</h2><p>BMI(18.5~22.9 정상), 체지방률, 기초대사량 등 건강 지표는 종합적으로 판단해야 합니다. 대한비만학회 기준은 WHO보다 엄격하여 BMI 23부터 과체중으로 분류합니다. 정확한 건강 평가는 의료 전문가와 상담하시기 바랍니다.</p><h2>이런 분들에게 추천</h2><p>체중 관리, 건강 관리를 계획 중인 분, 출산·육아를 준비하는 분, 일상의 궁금한 계산이 필요한 분에게 유용합니다. 정기적으로 계산하여 변화 추이를 기록하면 효과적입니다.</p>', relatedCalcs: ['bmi', 'calorie', 'bmr'],

  },
  {
    slug: 'bmr', emoji: '🫀', category: 'life', categoryLabel: '생활/건강',
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
      { q: '기초대사량 계산기 결과는 의학적으로 정확한가요?', a: '일반적인 공식 기반 참고 수치입니다. 정확한 건강 판단은 의료 전문가와 상담하세요.' },
      { q: '기초대사량 계산기는 남녀 기준이 다른가요?', a: '네. 성별을 입력받아 Mifflin-St Jeor 공식의 상수를 남성(+5)·여성(−161)으로 다르게 적용합니다.' },
      { q: '기초대사량 계산기는 무료인가요?', a: '네, 카더라 기초대사량 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '기초대사량 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>기초대사량 계산기 완벽 가이드</h2><p>성별·나이·키·몸무게로 기초대사량(BMR)을 계산.</p><p>본 계산기는 <strong>Mifflin-St Jeor 공식</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>기초대사량 계산기 계산 방식</h2><p>Mifflin-St Jeor 공식으로 계산합니다 — 남성 «10 × 체중(kg) + 6.25 × 키(cm) − 5 × 나이 + 5», 여성 «10 × 체중 + 6.25 × 키 − 5 × 나이 − 161». 활동량은 반영하지 않은 휴식 상태 소비 열량입니다.</p><h2>이런 분들에게 추천</h2><p>체중 관리, 건강 관리를 계획 중인 분, 출산·육아를 준비하는 분, 일상의 궁금한 계산이 필요한 분에게 유용합니다. 정기적으로 계산하여 변화 추이를 기록하면 효과적입니다.</p>', relatedCalcs: ['calorie', 'bmi', 'body-fat'],
  },
  {
    slug: 'age-calc', emoji: '📅', category: 'life', categoryLabel: '생활/건강',
    title: '만 나이 계산기', titleShort: '만 나이 계산기',
    description: '생년월일로 만 나이를 계산. 2023년 만 나이 통일법 기준.',
    keywords: ['만 나이 계산기','나이 계산','한국 나이','만 나이 통일'],
    legalBasis: '민법 제158조, 행정기본법 제16조', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'ageCalc', resultLabel: '만 나이', resultUnit: '세',
    inputs: [
      { id: 'birthDate', label: '생년월일', type: 'date', default: '1990-01-01' },
    ],
    faqs: [
      { q: '만 나이 계산기 결과는 의학적으로 정확한가요?', a: '일반적인 공식 기반 참고 수치입니다. 정확한 건강 판단은 의료 전문가와 상담하세요.' },
      { q: '만 나이 계산기는 남녀 기준이 다른가요?', a: '대부분의 건강 지표는 성별에 따라 다른 기준을 적용합니다. 성별 선택 시 자동 반영됩니다.' },
      { q: '만 나이 계산기는 무료인가요?', a: '네, 카더라 만 나이 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '만 나이 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 포함 142종의 무료 계산기를 제공합니다.' },
    ],
    seoContent: '<h2>만 나이 계산기 완벽 가이드</h2><p>생년월일로 만 나이를 계산. 2023년 만 나이 통일법 기준. 카더라 만 나이 계산기는 과학적 공식과 최신 기준을 반영합니다.</p><p>본 계산기는 <strong>민법 제158조, 행정기본법 제16조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>건강·생활 핵심 정보</h2><p>BMI(18.5~22.9 정상), 체지방률, 기초대사량 등 건강 지표는 종합적으로 판단해야 합니다. 대한비만학회 기준은 WHO보다 엄격하여 BMI 23부터 과체중으로 분류합니다. 정확한 건강 평가는 의료 전문가와 상담하시기 바랍니다.</p><h2>이런 분들에게 추천</h2><p>체중 관리, 건강 관리를 계획 중인 분, 출산·육아를 준비하는 분, 일상의 궁금한 계산이 필요한 분에게 유용합니다. 정기적으로 계산하여 변화 추이를 기록하면 효과적입니다.</p>', relatedCalcs: ['due-date', 'discharge-date'],

  },
  {
    slug: 'd-day', emoji: '📆', category: 'life', categoryLabel: '생활/건강',
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
      { q: 'D-Day 계산기 결과는 의학적으로 정확한가요?', a: '일반적인 공식 기반 참고 수치입니다. 정확한 건강 판단은 의료 전문가와 상담하세요.' },
      { q: 'D-Day 계산기는 남녀 기준이 다른가요?', a: '대부분의 건강 지표는 성별에 따라 다른 기준을 적용합니다. 성별 선택 시 자동 반영됩니다.' },
      { q: 'D-Day 계산기는 무료인가요?', a: '네, 카더라 D-Day 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: 'D-Day 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>D-Day 날짜 계산기 완벽 가이드</h2><p>두 날짜 사이의 일수를 계산. D-Day 카운트다운. 카더라 D-Day 계산기는 과학적 공식과 최신 기준을 반영합니다.</p><h2>건강·생활 핵심 정보</h2><p>BMI(18.5~22.9 정상), 체지방률, 기초대사량 등 건강 지표는 종합적으로 판단해야 합니다. 대한비만학회 기준은 WHO보다 엄격하여 BMI 23부터 과체중으로 분류합니다. 정확한 건강 평가는 의료 전문가와 상담하시기 바랍니다.</p><h2>이런 분들에게 추천</h2><p>체중 관리, 건강 관리를 계획 중인 분, 출산·육아를 준비하는 분, 일상의 궁금한 계산이 필요한 분에게 유용합니다. 정기적으로 계산하여 변화 추이를 기록하면 효과적입니다.</p>', relatedCalcs: ['age-calc', 'discharge-date'],
  },
  {
    slug: 'ovulation', emoji: '🌸', category: 'life', categoryLabel: '생활/건강',
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
      { q: '배란일 계산기 결과는 의학적으로 정확한가요?', a: '일반적인 공식 기반 참고 수치입니다. 정확한 건강 판단은 의료 전문가와 상담하세요.' },
      { q: '배란일 계산기는 무료인가요?', a: '네, 카더라 배란일 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '배란일 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>배란일 계산기 완벽 가이드</h2><p>마지막 생리일과 생리주기로 배란일·가임기를 계산.</p><h2>배란일 계산기 계산 방식</h2><p>배란 예정일 = 마지막 생리 시작일 + 평균 생리주기 − 14일, 가임기 = 배란 예정일 3일 전부터 1일 후까지로 계산합니다. 주기가 불규칙하면 실제 배란일과 차이가 커집니다.</p><h2>이런 분들에게 추천</h2><p>임신을 계획하거나 생리 주기를 관리하려는 분에게 유용합니다. 피임 수단으로 쓰기에는 정확도가 충분하지 않습니다.</p>', relatedCalcs: ['due-date'],

  },

  // ════════════════════════════════════════
  // 자동차/보험 (4종)
  // ════════════════════════════════════════
  {
    slug: 'vehicle-tax', emoji: '🚗', category: 'auto', categoryLabel: '자동차',
    title: '자동차세 계산기', titleShort: '자동차세 계산기',
    description: '비영업용 승용차 자동차세를 배기량·차령으로 계산. 차령 3년차부터 경감, 전기차는 정액 + 지방교육세.',
    keywords: ['자동차세 계산기','자동차세','차량세금','배기량','전기차 자동차세','차령 경감'],
    legalBasis: '지방세법 제127조·제151조, 시행령 제122조', version: '2026.09', lastUpdated: '2026-09-17',
    pattern: 'simple', formula: 'vehicleTax', resultLabel: '연간 자동차세', resultUnit: '원',
    inputs: [
      { id: 'cc', label: '배기량 (cc)', type: 'number', default: 2000, min: 0, max: 10000, condition: 'type=passenger' },
      { id: 'type', label: '차종 (비영업용 승용)', type: 'radio', default: 'passenger', options: [{ value: 'passenger', label: '배기량 과세 승용차 (하이브리드 포함)' }, { value: 'ev', label: '전기차 등 그 밖의 승용차' }] },
      { id: 'age', label: '차령 (년)', type: 'number', default: 3, min: 1, max: 30, condition: 'type=passenger', hint: '과세연도 − 최초 등록연도 + 1. 3년차부터 해마다 5%씩 경감, 12년차 이상은 50%.' },
    ],
    faqs: [
      { q: '자동차세는 어떻게 계산하나요?', a: '비영업용 승용차는 배기량 × cc당 세액(1,000cc 이하 80원·1,600cc 이하 140원·초과 200원)이 연세액이고, 차령 3년 이상이면 5% × (차령 − 2)를 경감한다(최대 50%). 여기에 자동차세의 30%가 지방교육세로 붙는다. 지방세법 2026-07-01 시행본 기준.' },
      { q: '전기차 자동차세는?', a: '배기량이 없는 승용차는 비영업용 연 10만원이고, 지방교육세 30%(3만원)가 더해져 13만원이다(2026-09-17 원문 대조 기준).' },
      { q: '연납하면 얼마나 줄어드나요?', a: '1월 등에 한꺼번에 내면 공제가 있지만 공제 이자율은 대통령령으로 정해져 이 계산기에는 반영하지 않았다. 위택스 고지 금액을 확인한다.' },
    ],
    seoContent: '<h2>자동차세 계산기</h2><p>비영업용 승용차의 연간 자동차세와 지방교육세를 계산한다. 세율은 국가법령정보센터 현행 원문과 대조한 정책 상수표에서 받아 쓰며 결과에 근거를 표시한다.</p><h2>차령 경감</h2><p>차령은 과세연도에서 최초 등록연도를 빼고 1을 더한 값이다. 차령 3년부터 기분세액에서 5% × (차령 − 2)를 빼며, 12년을 넘으면 12년으로 본다. 하반기에 등록한 차는 1기분 차령이 1 작다.</p><h2>반영하지 않는 것</h2><p>연납 공제, 조례에 따른 세율 가산, 영업용·승합·화물 차량, 10원 미만 끝전 처리는 들어 있지 않다.</p>', relatedCalcs: ['fuel-cost', 'car-installment'],
  },
  {
    slug: 'fuel-cost', emoji: '⛽', category: 'auto', categoryLabel: '자동차',
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
      { q: '연비 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '연비 계산기에서 가장 중요한 입력값은?', a: '주행거리·연비·유가로 월간/연간 유류비를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '연비 계산기는 무료인가요?', a: '네, 카더라 연비 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '연비 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>연비/유류비 계산기 완벽 가이드</h2><p>주행거리·연비·유가로 월간/연간 유류비를 계산.</p><h2>연비 계산기 계산 방식</h2><p>월간 유류비 = 월 주행거리 ÷ 연비 × 유가, 연간 = 월간 × 12, 월 소비량 = 주행거리 ÷ 연비 입니다. 유가는 입력한 값을 그대로 씁니다.</p><h2>이런 분들에게 추천</h2><p>정확한 자동차 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['vehicle-tax', 'ev-charge-cost'],

  },
  {
    slug: 'car-installment', emoji: '🚙', category: 'auto', categoryLabel: '자동차',
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
      { q: '자동차 할부 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '자동차 할부 계산기에서 가장 중요한 입력값은?', a: '자동차 할부 구매 시 월 납입금과 총 이자를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '자동차 할부 계산기는 무료인가요?', a: '네, 카더라 자동차 할부 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '자동차 할부 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>자동차 할부 계산기 완벽 가이드</h2><p>자동차 할부 구매 시 월 납입금과 총 이자를 계산.</p><h2>자동차 할부 계산기 계산 방식</h2><p>할부 원금 = 차량 가격 − 선수금. 원리금균등 방식으로 «원금 × 월이율 × (1+월이율)^개월 ÷ ((1+월이율)^개월 − 1)» 을 계산해 월 납입금을 구하고, 총 납입액 − 원금을 총 이자로 보여줍니다. 취등록세·보험료·할부 수수료는 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 자동차 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['loan-repayment', 'vehicle-tax'],
  },
  {
    slug: 'ev-charge-cost', emoji: '🔋', category: 'auto', categoryLabel: '자동차',
    title: '전기차 충전비 계산기', titleShort: '전기차 충전비 계산기',
    description: '월 주행거리·전비로 전기차 월 충전비를 계산. 가정용/공용 급속 단가 비교.',
    keywords: ['전기차 충전비','전기차 유지비','충전요금','전기차 전비'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'evChargeCost', resultLabel: '월간 충전비', resultUnit: '원',
    inputs: [
      { id: 'distance', label: '월 주행거리 (km)', type: 'number', default: 1500 },
      { id: 'efficiency', label: '전비 (km/kWh)', type: 'number', default: 5.5, min: 2, max: 10, step: 0.1 },
      { id: 'chargeType', label: '충전 유형', type: 'radio', default: 'home', options: [{ value: 'home', label: '가정용 (약 120원/kWh)' }, { value: 'public', label: '공용 급속 (약 350원/kWh)' }] },
    ],
    faqs: [
      { q: '전기차 충전비 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '전기차 충전비 계산기에서 가장 중요한 입력값은?', a: '월 주행거리·전비로 전기차 월 충전비를 계산. 가정용/공용 급속 단가 비교. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '전기차 충전비 계산기는 무료인가요?', a: '네, 카더라 전기차 충전비 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '전기차 충전비 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>전기차 충전비 계산기 완벽 가이드</h2><p>월 주행거리·전비로 전기차 월 충전비를 계산. 가정용/공용 급속 단가 비교.</p><h2>전기차 충전비 계산기 계산 방식</h2><p>월 충전비 = 월 주행거리 ÷ 전비(km/kWh) × kWh 단가 입니다. 단가는 충전 유형별 가정값(선택지와 결과 화면에 표시)이며, 실제 요금제·계절·시간대·충전사업자별 요금은 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 자동차 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['fuel-cost', 'vehicle-tax'],

  },

  // ════════════════════════════════════════
  // 쇼핑/소비 (4종)
  // ════════════════════════════════════════
  {
    slug: 'discount-calc', emoji: '🏷️', category: 'shopping', categoryLabel: '쇼핑/소비',
    title: '할인율 계산기', titleShort: '할인율 계산기',
    description: '정가와 할인가로 할인율과 할인 금액을 계산.',
    keywords: ['할인율 계산기','할인 퍼센트','세일 계산','가격 할인'],
    legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'discountCalc', resultLabel: '할인율', resultUnit: '%',
    inputs: [
      { id: 'original', label: '정가', type: 'currency', default: 100000 },
      { id: 'sale', label: '할인가', type: 'currency', default: 70000 },
    ],
    faqs: [
      { q: '할인율 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '할인율 계산기에서 가장 중요한 입력값은?', a: '정가와 할인가로 할인율과 할인 금액을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '할인율 계산기는 무료인가요?', a: '네, 카더라 할인율 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '할인율 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>할인율 계산기 완벽 가이드</h2><p>정가와 할인가로 할인율과 할인 금액을 계산.</p><h2>할인율 계산기 계산 방식</h2><p>할인율 = (정가 − 할인가) ÷ 정가 × 100, 할인 금액 = 정가 − 할인가 입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 쇼핑/소비 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['installment-interest'],
  },
  {
    slug: 'installment-interest', emoji: '💳', category: 'shopping', categoryLabel: '쇼핑/소비',
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
      { q: '할부 이자 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '할부 이자 계산기에서 가장 중요한 입력값은?', a: '카드 할부 결제 시 실제 부담 이자를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '할부 이자 계산기는 무료인가요?', a: '네, 카더라 할부 이자 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '할부 이자 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>할부 이자 계산기 완벽 가이드</h2><p>카드 할부 결제 시 실제 부담 이자를 계산.</p><h2>할부 이자 계산기 계산 방식</h2><p>총 이자 = 할부 금액 × 연 수수료율 × (개월 수 + 1) ÷ 24 입니다. 매달 원금을 똑같이 갚고 남은 잔액에 수수료가 붙는 방식을 근사한 값이며, 월 납입금은 (할부 금액 + 총 이자) ÷ 개월 수 입니다. 카드사별 회차 절사·무이자 행사는 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 쇼핑/소비 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['discount-calc', 'loan-repayment'],

  },
  {
    slug: 'customs-duty', emoji: '📦', category: 'shopping', categoryLabel: '쇼핑/소비',
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
      { q: '해외직구 관세 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 관세법, 수입물품 과세가격 결정에 관한 고시를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '해외직구 관세 계산기에서 가장 중요한 입력값은?', a: '해외 직구 시 관세·부가세를 계산. 미국/EU/일본 면세한도 안내. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '해외직구 관세 계산기는 무료인가요?', a: '네, 카더라 해외직구 관세 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '해외직구 관세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 포함 142종의 무료 계산기를 제공합니다.' },
    ],
    seoContent: '<h2>해외직구 관세 계산기 완벽 가이드</h2><p>해외 직구 시 관세·부가세를 계산. 미국/EU/일본 면세한도 안내. 카더라 해외직구 관세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>관세법, 수입물품 과세가격 결정에 관한 고시</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>쇼핑/소비 핵심 정보</h2><p>해외직구 면세한도: 미국 $200, 일반 $150. 초과분에 관세+부가세 부과. 카드 할부 이자는 무이자 외에 수수료가 포함되며, 일시불 대비 총 비용을 비교하세요.</p><h2>이런 분들에게 추천</h2><p>정확한 쇼핑/소비 계산이 필요한 분에게 유용합니다. 카더라는 쇼핑/소비 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['currency-convert'],
  },
  {
    slug: 'subscription-total', emoji: '📱', category: 'shopping', categoryLabel: '쇼핑/소비',
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
      { q: '구독료 합산 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '구독료 합산 계산기에서 가장 중요한 입력값은?', a: '넷플릭스·유튜브·스포티파이 등 월 구독 서비스 총 비용을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '구독료 합산 계산기는 무료인가요?', a: '네, 카더라 구독료 합산 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '구독료 합산 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>구독료 합산 계산기 완벽 가이드</h2><p>넷플릭스·유튜브·스포티파이 등 월 구독 서비스 총 비용을 계산.</p><h2>구독료 합산 계산기 계산 방식</h2><p>입력한 구독료 중 0보다 큰 항목만 더해 월 합계를 구하고, 연간 총액 = 월 합계 × 12 로 보여줍니다.</p><h2>이런 분들에게 추천</h2><p>정확한 쇼핑/소비 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['net-salary'],

  },

  // ════════════════════════════════════════
  // 군대/교육 (3종 추가)
  // ════════════════════════════════════════
  {
    slug: 'military-pay', emoji: '🪖', category: 'military', categoryLabel: '군대/교육',
    title: '군인 월급 계산기', titleShort: '군인 월급 계산기',
    description: '2026년 병사 계급별 월급을 확인. 이병~병장.',
    keywords: ['군인 월급','병사 월급','군대 월급','2026 군인 급여'],
    legalBasis: '국방부 병 봉급표', version: '2026.04', lastUpdated: '2026-04-05',
    pattern: 'simple', formula: 'militaryPay', resultLabel: '월급', resultUnit: '원',
    inputs: [
      { id: 'rank', label: '계급', type: 'select', default: 'private', options: [{ value: 'private', label: '이병' }, { value: 'pfc', label: '일병' }, { value: 'corporal', label: '상병' }, { value: 'sergeant', label: '병장' }] },
    ],
    faqs: [
      { q: '군인 월급 계산기 결과는 정확한가요?', a: '계산기에 설정된 계급별 봉급표 값을 보여주는 참고용 결과입니다. 매년 바뀌므로 국방부 최신 공고와 대조하세요.' },
      { q: '군인 월급 계산기에서 가장 중요한 입력값은?', a: '2026년 병사 계급별 월급을 확인. 이병~병장. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '군인 월급 계산기는 무료인가요?', a: '네, 카더라 군인 월급 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '군인 월급 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ],
    seoContent: '<h2>군인 월급 계산기 완벽 가이드</h2><p>2026년 병사 계급별 월급을 확인. 이병~병장.</p><p>본 계산기는 <strong>국방부 병 봉급표</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>군인 월급 계산기 계산 방식</h2><p>계급을 고르면 계산기에 설정된 계급별 월 봉급액을 보여주며, 기준 연도 표시는 결과 화면에 나옵니다. 봉급은 매년 국방부가 정하므로 실제 지급액은 최신 공고로 확인하세요. 적금 매칭 지원금 등 봉급 외 지원은 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>입대 예정자와 가족, 복무 중 월급으로 저축 계획을 세우려는 분에게 유용합니다. 본 계산기는 참고용입니다.</p>', relatedCalcs: ['discharge-date', 'net-salary'],
  },
  {
    slug: 'gpa-convert', emoji: '🎓', category: 'military', categoryLabel: '군대/교육',
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
      { q: '학점 환산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '학점 환산기에서 가장 중요한 입력값은?', a: '4.5/4.3/4.0 만점 학점을 백분율 또는 100점 만점으로 환산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '학점 환산기는 무료인가요?', a: '네, 카더라 학점 환산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '학점 환산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>학점 백분율 환산기 완벽 가이드</h2><p>4.5/4.3/4.0 만점 학점을 백분율 또는 100점 만점으로 환산.</p><h2>학점 환산기 계산 방식</h2><p>백분율 = 학점 ÷ 만점 기준 × 100 (소수 첫째 자리, 최대 100) 입니다. 학교·기업이 쓰는 별도 환산표와는 다를 수 있습니다.</p><h2>이런 분들에게 추천</h2><p>취업·대학원 지원서에 학점을 100점 만점으로 적어야 하는 분에게 유용합니다. 본 계산기는 참고용입니다.</p>', relatedCalcs: [],

  },

  // ════════════════════════════════════════
  // 추가 세금 (5종)
  // ════════════════════════════════════════
  {
    slug: 'comprehensive-income-tax', emoji: '📑', category: 'income-tax', categoryLabel: '소득세',
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
      { q: '종합소득세 계산기에 적용되는 세율은?', a: '과세표준에 따라 6~45% 8단계 누진세율이 적용됩니다. 소득세법 제55조를 기준으로 계산합니다.' },
      { q: '소득공제와 세액공제의 차이는?', a: '소득공제는 과세표준을 줄이고, 세액공제는 산출세액에서 직접 차감합니다.' },
      { q: '종합소득세 계산기 신고 기한은?', a: '근로소득은 연말정산(2월), 종합소득세는 5월, 양도소득은 양도 후 2개월입니다.' },
      { q: '종합소득세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ],
    seoContent: '<h2>종합소득세 계산기 완벽 가이드</h2><p>사업소득·프리랜서 등 종합소득에 대한 소득세를 누진세율로 계산.</p><p>본 계산기는 <strong>소득세법 제55조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>종합소득세 계산기 계산 방식</h2><p>과세표준 = 총 수입금액 − 필요경비 − 소득공제 합계. 여기에 소득세법 제55조 기본세율(8단계 누진)을 적용한 산출세액에서 세액공제 합계를 빼고(0 미만은 0), 지방소득세 10%를 더해 보여줍니다. 기납부세액·가산세는 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 프리랜서, 사업자 등 소득세 신고를 준비하는 모든 분에게 유용합니다.</p>', relatedCalcs: ['withholding-3-3', 'net-salary'],
  },
  {
    slug: 'property-tax', emoji: '🏘️', category: 'property-tax', categoryLabel: '부동산 세금',
    title: '재산세 계산기', titleShort: '재산세 계산기',
    description: '주택 공시가격으로 재산세·지방교육세·도시지역분을 계산. 2026년 1세대1주택 공정시장가액비율(43~45%)과 특례세율 반영.',
    keywords: ['재산세 계산기','재산세율','공시가격','아파트 재산세','1세대1주택 재산세','공정시장가액비율'],
    legalBasis: '지방세법 제110조·제111조·제111조의2·제112조, 시행령 제109조', version: '2026.09', lastUpdated: '2026-09-17',
    pattern: 'tax-bracket', formula: 'propertyTax', resultLabel: '재산세 합계', resultUnit: '원',
    inputs: [
      { id: 'publicPrice', label: '공시가격 (시가표준액)', type: 'currency', default: 500000000 },
      { id: 'oneHouse', label: '1세대 1주택', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], hint: '과세기준일(6월 1일) 현재 세대 전체가 이 주택 하나만 보유.' },
      { id: 'cityArea', label: '도시지역분 적용대상 지역', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], hint: '대부분의 시 동지역은 해당한다. 고지서의 「도시지역분」 줄로 확인한다.' },
    ],
    faqs: [
      { q: '1세대1주택은 재산세가 얼마나 줄어드나요?', a: '2026년도분은 공정시장가액비율이 공시가격 3억원 이하 43%·6억원 이하 44%·초과 45%(일반 60%)이고, 공시가격 9억원 이하면 특례세율(0.05~0.35%)을 쓴다. 공시가 5억 기준 합계는 약 62만원(일반 비율이면 110만원대). 지방세법·시행령 2026-07-01 시행본, 2026-09-17 원문 대조 기준.' },
      { q: '계산 결과가 고지서보다 많게 나와요', a: '과세표준상한제(직전연도 과세표준에서 일정 비율 이상 오르지 못하게 하는 장치)를 반영하지 않았다. 직전연도 과세표준이 필요해 이 계산기로는 알 수 없다. 조례 세율 가감·감면도 미반영이다.' },
      { q: '재산세는 언제 내나요?', a: '과세기준일은 6월 1일이고, 주택분은 7월과 9월에 절반씩 고지된다.' },
    ],
    seoContent: '<h2>재산세 계산기</h2><p>주택 공시가격으로 재산세, 지방교육세(재산세의 20%), 도시지역분(과세표준의 0.14%)을 계산한다. 비율과 세율은 국가법령정보센터 현행 원문과 대조한 정책 상수표에서 받아 쓴다.</p><h2>계산 순서</h2><p>과세표준 = 공시가격 × 공정시장가액비율. 1세대1주택은 2026년도분에 한해 43~45%, 그 밖의 주택은 60%다. 공시가격 9억원 이하 1세대1주택은 특례세율, 나머지는 표준세율(0.1~0.4%)을 적용한다.</p><h2>반영하지 않는 것</h2><p>과세표준상한제, 조례에 따른 세율·도시지역분 가감, 지방세특례제한법 감면은 들어 있지 않다. 1세대1주택 특례세율은 2026-12-28까지 성립한 납세의무에만 유효하다.</p>', relatedCalcs: ['comprehensive-property-tax', 'acquisition-tax'],

  },
  {
    slug: 'registration-cost', emoji: '📋', category: 'real-estate', categoryLabel: '부동산',
    title: '등기비용 계산기', titleShort: '등기비용 계산기',
    description: '주택 소유권이전등기에 드는 세금(취득세·지방교육세·농특세)과 인지세를 계산하고 법무사 보수를 더한다. 취득 원인 등기에는 등록면허세가 없다.',
    keywords: ['등기비용 계산기','소유권이전등기','법무사 비용','등기 세금','부동산 등기'],
    legalBasis: '지방세법 제11조·제23조, 인지세법 제3조·제6조', version: '2026.09', lastUpdated: '2026-09-17',
    pattern: 'simple', formula: 'registrationCost', resultLabel: '등기비용 합계', resultUnit: '원',
    inputs: [
      { id: 'price', label: '과세표준 (매매: 매매가 · 증여: 시가인정액 · 상속: 시가표준액)', type: 'currency', default: 500000000 },
      { id: 'type', label: '취득 유형', type: 'radio', default: 'purchase', options: [{ value: 'purchase', label: '매매' }, { value: 'gift', label: '증여' }, { value: 'inherit', label: '상속' }] },
      { id: 'houseCount', label: '보유 주택수 (취득 후)', type: 'stepper', default: 1, min: 1, max: 5, condition: 'type=purchase' },
      { id: 'regulated', label: '조정대상지역', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], hint: '2025-10-16 기준 서울 전역·경기 12곳. 최신 지정 현황은 국토교통부 공고를 확인한다.' },
      { id: 'standardValue', label: '시가표준액 (공시가격)', type: 'currency', default: 0, condition: 'type=gift' },
      { id: 'giftFrom1House', label: '1세대1주택자의 주택을 배우자·직계존비속이 받음', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], condition: 'type=gift' },
      { id: 'inherit1House', label: '상속 후 1가구 1주택 (무주택 상속인)', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], condition: 'type=inherit' },
      { id: 'area85', label: '전용면적', type: 'radio', default: 'under', options: [{ value: 'under', label: '85㎡ 이하' }, { value: 'over', label: '85㎡ 초과' }] },
      { id: 'lawyerFee', label: '법무사 보수 (견적)', type: 'currency', default: 0, hint: '법정 요금이 아니다. 받은 견적을 넣는다 — 비우면 합계에 넣지 않는다.' },
    ],
    faqs: [
      { q: '등록면허세도 내야 하나요?', a: '매매·증여·상속처럼 취득세를 내는 소유권이전등기에는 등록면허세가 없다(지방세법 §23 1호). 대출을 받아 근저당을 설정하면 그 등기에는 등록면허세가 붙는다 — 등록면허세 계산기에서 따로 계산한다.' },
      { q: '인지세는 얼마인가요?', a: '매매·증여 계약서 1통마다 기재금액 구간별로 붙고, 주택은 1억원 이하 비과세다. 1억 초과 10억 이하 15만원(인지세법 §3①, 2026-01-02 시행본 기준). 상속은 계약서가 없어 인지세가 없다.' },
      { q: '빠진 비용이 있나요?', a: '국민주택채권 매입(할인) 비용, 등기신청 수수료, 근저당 설정비는 이 합계에 없다.' },
    ],
    seoContent: '<h2>등기비용 계산기</h2><p>주택 소유권이전등기에 드는 비용 중 세금(취득세·지방교육세·농어촌특별세)과 인지세를 계산하고, 입력한 법무사 보수를 더한다. 취득세는 취득세 계산기와 같은 계산을 쓴다.</p><h2>등록면허세가 없는 이유</h2><p>취득을 원인으로 하는 등기는 등록면허세 과세 대상에서 제외된다(지방세법 §23 1호). 예전처럼 「등록세 2%」를 따로 더하면 이중 계산이다.</p><h2>반영하지 않는 것</h2><p>국민주택채권 매입 비용, 등기신청 수수료, 대출 근저당 설정 비용, 법무사 보수 시세는 들어 있지 않다.</p>', relatedCalcs: ['acquisition-tax', 'brokerage-fee', 'registration-license-tax'],
  },
  {
    slug: 'dsr-calc', emoji: '📊', category: 'real-estate', categoryLabel: '부동산',
    title: 'DSR 계산기', titleShort: 'DSR 계산기',
    seoTitle: 'DSR 계산기 — 스트레스 DSR 반영 한도 대조',
    description: '총부채원리금상환비율(DSR)을 업권별 한도·스트레스 금리까지 반영해 계산. 적용 근거와 발표일을 함께 표시.',
    keywords: ['DSR 계산기','총부채원리금상환비율','대출한도','스트레스 DSR','DSR 40%','주택담보대출'],
    legalBasis: '금융위원회 가계부채 관리방안(차주단위 DSR·스트레스 DSR)', version: '2026.09', lastUpdated: '2026-09-16',
    pattern: 'conditional', formula: 'dsrCalc', resultLabel: 'DSR', resultUnit: '%',
    inputs: [
      { id: 'annualIncome', label: '연소득', type: 'currency', default: 60000000 },
      { id: 'newLoan', label: '신규 대출 원금', type: 'currency', default: 300000000 },
      { id: 'newRate', label: '신규 대출 금리 (%)', type: 'percent', default: 4.5, step: 0.1 },
      { id: 'newYears', label: '신규 대출 기간 (년)', type: 'number', default: 30, min: 1, max: 40 },
      { id: 'existingAnnualRepay', label: '기존 대출 연간 상환액', type: 'currency', default: 0 },
      // K-9 ⓒ ② — 한도는 업권으로, 스트레스 금리는 지역으로 갈린다. 둘 다 물어야 답이 맞는다.
      { id: 'lender', label: '대출 기관', type: 'radio', default: 'bank', options: [{ value: 'bank', label: '은행권' }, { value: 'nonbank', label: '제2금융권' }] },
      { id: 'region', label: '지역', type: 'select', default: 'regulated', options: [{ value: 'regulated', label: '규제지역' }, { value: 'capital_nonreg', label: '수도권 비규제' }, { value: 'local_nonreg', label: '수도권 외 비규제' }], hint: '스트레스 DSR 가산금리가 지역에 따라 달라진다.' },
    ],
    faqs: [
      { q: '왜 입력 금리보다 높은 금리로 계산되나요?', a: '스트레스 DSR 때문입니다. 실제 심사는 금리 상승 위험을 반영해 가산금리를 얹은 금리로 상환액을 잡습니다. 이를 빼고 계산하면 「통과」라고 나와도 창구에서 거절될 수 있습니다.' },
      { q: 'DSR 한도는 40%인가요?', a: '업권에 따라 다릅니다. 이 계산기는 은행권·제2금융권 한도를 정책 표에서 받아 대조하고, 결과 화면에 적용 한도와 근거·발표일을 함께 표시합니다.' },
      { q: 'DSR 계산기 결과는 실제와 같나요?', a: '한도 대조 결과이며 승인 결과가 아닙니다. 실제 승인은 은행 심사·담보·소득 인정 방식에 따라 달라집니다.' },
      { q: 'DSR 계산기는 무료인가요?', a: '네, 카더라 DSR 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: 'DSR 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ],
    seoContent: '<h2>DSR 계산기 완벽 가이드</h2><p>총부채원리금상환비율(DSR)을 계산. 대출 가능 금액 추정.</p><p>본 계산기는 <strong>은행업감독규정</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>DSR 계산기 계산 방식</h2><p>신규 대출은 원리금균등 상환으로 가정해 월 상환액을 구하되, 입력 금리에 지역별 스트레스 가산금리를 더한 금리를 씁니다. 연간 원리금(신규 월 상환액 × 12 + 기존 대출 연간 상환액)을 연소득으로 나눠 DSR 을 구하고 업권별 한도와 대조합니다. 한도와 가산금리는 서버가 정책 표에서 읽어 넣으며, 한도를 받지 못하면 계산하지 않고 「규제 기준 미수신」으로 표시합니다.</p><h2>이런 분들에게 추천</h2><p>주택담보대출·신용대출 등 신규 대출을 받기 전에 DSR 한도 안인지 가늠하려는 분에게 유용합니다.</p>', relatedCalcs: ['loan-repayment', 'net-salary'],

  },
  {
    slug: 'jeonse-vs-wolse', emoji: '🔀', category: 'real-estate', categoryLabel: '부동산',
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
      { q: '전세vs월세 비교기 결과는 실제와 같나요?', a: '참고용이며, 지역·물건 특성에 따라 차이가 있을 수 있습니다.' },
      { q: '부동산 거래 시 꼭 확인할 것은?', a: '등기부등본, 건축물대장, 토지이용계획확인서를 반드시 확인하세요.' },
      { q: '전세vs월세 비교기는 무료인가요?', a: '네, 카더라 전세vs월세 비교기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '전세vs월세 비교기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>전세 vs 월세 비교기 완벽 가이드</h2><p>전세와 월세 중 어느 것이 유리한지 대출이자·기회비용 포함 비교.</p><h2>전세vs월세 비교기 계산 방식</h2><p>전세 연간 비용 = (전세 보증금 − 자기자금) × 전세대출 금리 + 자기자금 × 투자수익률(기회비용). 월세 연간 비용 = 월세 × 12 + 월세 보증금 × 투자수익률(기회비용). 두 값을 빼서 더 적은 쪽을 유리하다고 표시합니다. 중개보수·보증보험료·월세 보증금 대출 이자는 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>같은 집을 전세와 월세 중 어느 조건으로 계약할지 비교하려는 분에게 유용합니다.</p>', relatedCalcs: ['jeonse-wolse', 'loan-repayment'],
  },
  {
    slug: 'year-end-refund', emoji: '💸', category: 'year-end', categoryLabel: '연말정산',
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
      { q: '연말정산 환급액 계산기에서 최대 환급을 받으려면?', a: '연금저축/IRP, 신용카드/체크카드, 의료비·교육비·기부금 공제를 빠짐없이 챙기세요.' },
      { q: '연말정산은 언제 하나요?', a: '매년 1~2월 직장에서 진행. 간소화 서비스는 1월 15일경 오픈됩니다.' },
      { q: '연말정산 환급액 계산기 결과가 실제와 다를 수 있나요?', a: '인적공제, 기납부세액, 감면 등 세부 조건에 따라 차이가 발생합니다. 소득세법 제134조, 제137조를 기준으로 계산합니다.' },
      { q: '연말정산 환급액 계산기는 무료인가요?', a: '네, 카더라 연말정산 환급액 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 포함 142종의 무료 계산기를 제공합니다.' },
    ],
    seoContent: '<h2>연말정산 예상 환급액 계산기 완벽 가이드</h2><p>총급여·소득공제·세액공제를 입력하면 예상 환급(추가납부)액을 계산. 카더라 연말정산 환급액 계산기는 2026년 세법 기준으로 정확한 공제액을 계산합니다.</p><p>본 계산기는 <strong>소득세법 제134조, 제137조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>소득공제(인적공제, 신용카드, 주택청약)와 세액공제(의료비, 교육비, 기부금, 보험료, 연금저축)를 최대한 활용하면 상당한 환급을 받을 수 있습니다. 국세청 간소화 서비스(1월 15일 오픈)를 활용하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 연말정산 환급을 극대화하고 싶은 직장인에게 필수입니다. 체크카드 사용 비율 높이기, 연금저축/IRP 최대 납입, 월세 세액공제 신청이 핵심 전략입니다.</p>', relatedCalcs: ['net-salary', 'irp-deduction', 'credit-card-deduction'],

  },
  {
    slug: 'credit-card-deduction', emoji: '💳', category: 'year-end', categoryLabel: '연말정산',
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
      { q: '신용카드 공제 계산기에서 최대 환급을 받으려면?', a: '연금저축/IRP, 신용카드/체크카드, 의료비·교육비·기부금 공제를 빠짐없이 챙기세요.' },
      { q: '연말정산은 언제 하나요?', a: '매년 1~2월 직장에서 진행. 간소화 서비스는 1월 15일경 오픈됩니다.' },
      { q: '신용카드 공제 계산기 결과가 실제와 다를 수 있나요?', a: '인적공제, 기납부세액, 감면 등 세부 조건에 따라 차이가 발생합니다. 조세특례제한법 제126조의2를 기준으로 계산합니다.' },
      { q: '신용카드 공제 계산기는 무료인가요?', a: '네, 카더라 신용카드 공제 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 포함 142종의 무료 계산기를 제공합니다.' },
    ],
    seoContent: '<h2>신용카드 소득공제 계산기 완벽 가이드</h2><p>신용카드·체크카드·현금영수증 사용액으로 소득공제 금액을 계산. 카더라 신용카드 공제 계산기는 2026년 세법 기준으로 정확한 공제액을 계산합니다.</p><p>본 계산기는 <strong>조세특례제한법 제126조의2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>소득공제(인적공제, 신용카드, 주택청약)와 세액공제(의료비, 교육비, 기부금, 보험료, 연금저축)를 최대한 활용하면 상당한 환급을 받을 수 있습니다. 국세청 간소화 서비스(1월 15일 오픈)를 활용하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 연말정산 환급을 극대화하고 싶은 직장인에게 필수입니다. 체크카드 사용 비율 높이기, 연금저축/IRP 최대 납입, 월세 세액공제 신청이 핵심 전략입니다.</p>', relatedCalcs: ['year-end-refund', 'net-salary'],
  },
  {
    slug: 'monthly-rent-deduction', emoji: '🏠', category: 'year-end', categoryLabel: '연말정산',
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
      { q: '월세 세액공제 계산기에서 최대 환급을 받으려면?', a: '연금저축/IRP, 신용카드/체크카드, 의료비·교육비·기부금 공제를 빠짐없이 챙기세요.' },
      { q: '연말정산은 언제 하나요?', a: '매년 1~2월 직장에서 진행. 간소화 서비스는 1월 15일경 오픈됩니다.' },
      { q: '월세 세액공제 계산기 결과가 실제와 다를 수 있나요?', a: '인적공제, 기납부세액, 감면 등 세부 조건에 따라 차이가 발생합니다. 소득세법 제95조의2를 기준으로 계산합니다.' },
      { q: '월세 세액공제 계산기는 무료인가요?', a: '네, 카더라 월세 세액공제 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 포함 142종의 무료 계산기를 제공합니다.' },
    ],
    seoContent: '<h2>월세 세액공제 계산기 완벽 가이드</h2><p>무주택 세대주의 월세 세액공제(17%) 환급액을 계산. 카더라 월세 세액공제 계산기는 2026년 세법 기준으로 정확한 공제액을 계산합니다.</p><p>본 계산기는 <strong>소득세법 제95조의2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>소득공제(인적공제, 신용카드, 주택청약)와 세액공제(의료비, 교육비, 기부금, 보험료, 연금저축)를 최대한 활용하면 상당한 환급을 받을 수 있습니다. 국세청 간소화 서비스(1월 15일 오픈)를 활용하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 연말정산 환급을 극대화하고 싶은 직장인에게 필수입니다. 체크카드 사용 비율 높이기, 연금저축/IRP 최대 납입, 월세 세액공제 신청이 핵심 전략입니다.</p>', relatedCalcs: ['year-end-refund', 'jeonse-vs-wolse'],

  },
  {
    slug: 'inheritance-tax', emoji: '📜', category: 'inheritance', categoryLabel: '상속/증여',
    title: '상속세 계산기', titleShort: '상속세 계산기',
    description: '상속재산에서 일괄공제(또는 기초·인적공제)·배우자상속공제·금융재산상속공제를 빼고 누진세율과 신고세액공제까지 계산. 현행 유산세 방식.',
    keywords: ['상속세 계산기','상속세율','상속공제','일괄공제','배우자공제'],
    legalBasis: '상속세및증여세법 제18조~제22조·제26조·제69조', version: '2026.09', lastUpdated: '2026-09-17',
    pattern: 'tax-bracket', formula: 'inheritanceTax', resultLabel: '상속세', resultUnit: '원',
    inputs: [
      { id: 'totalEstate', label: '상속재산 총액', type: 'currency', default: 1000000000 },
      { id: 'debts', label: '채무·공과금·장례비', type: 'currency', default: 50000000 },
      { id: 'hasSpouse', label: '배우자 생존', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] },
      { id: 'childCount', label: '자녀 수 (태아 포함)', type: 'stepper', default: 2, min: 0, max: 10, hint: '자녀 1명당 인적공제. 0명이고 배우자가 있으면 배우자 단독상속으로 계산' },
      { id: 'spouseMode', label: '배우자가 실제 상속받는 금액', type: 'select', default: 'legal', options: [{ value: 'legal', label: '법정상속분만큼 (배우자 1.5 : 자녀 각 1)' }, { value: 'custom', label: '직접 입력' }] },
      { id: 'spouseAmount', label: '배우자 실제 상속액', type: 'currency', default: 500000000, condition: 'spouseMode=custom', hint: '신고기한 다음날부터 9개월 안에 분할(등기 등)한 금액' },
      { id: 'minorYears', label: '미성년 상속인·동거가족의 19세까지 남은 연수 합계', type: 'number', default: 0, min: 0, max: 200, hint: '배우자 제외. 1년 미만은 1년. 예: 10세·15세 자녀 → 9+4=13' },
      { id: 'seniorCount', label: '65세 이상 상속인·동거가족 수 (배우자 제외)', type: 'stepper', default: 0, min: 0, max: 10 },
      { id: 'netFinancial', label: '순금융재산 (예금·주식 등 − 금융채무)', type: 'currency', default: 0, hint: '최대주주 보유 주식·신고하지 않은 차명 금융재산은 제외' },
    ],
    faqs: [
      { q: '배우자상속공제는 얼마까지 되나요?', a: '배우자가 실제 상속받은 금액을 공제하되, 법정상속분으로 계산한 한도와 30억원 중 작은 금액이 한도입니다. 실제 상속액이 없거나 5억원 미만이면 5억원을 공제합니다(상속세및증여세법 제19조, 2026-01-01 시행 기준).' },
      { q: '일괄공제와 기초공제는 무엇이 다른가요?', a: '기초공제 2억원에 자녀·미성년자·연로자 인적공제를 더한 금액과 일괄공제 5억원 중 큰 금액을 공제합니다. 배우자 혼자 상속받으면 일괄공제를 쓸 수 없습니다(제21조, 2026-01-01 시행 기준).' },
      { q: '상속세 계산기 결과는 정확한가요?', a: '참고용입니다. 현행 유산세 방식(피상속인 재산 전체에 과세)으로 계산하며, 10년 내 사전증여 합산·동거주택상속공제·장애인공제·세대생략 할증은 반영하지 않습니다.' },
      { q: '상속세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 상속/증여 포함 142종의 무료 계산기를 제공합니다.' },
    ],
    seoContent: '<h2>상속세 계산기 완벽 가이드</h2><p>상속재산에서 채무를 빼고 일괄공제(또는 기초·인적공제), 배우자상속공제, 금융재산상속공제를 차감한 과세표준에 누진세율을 적용한 뒤 신고세액공제를 반영합니다. 배우자공제는 실제 상속액·법정상속분 한도·30억원 한도·5억원 최소를 모두 따집니다.</p><p>본 계산기는 <strong>상속세및증여세법 제18조~제22조·제26조·제69조</strong>를 기준으로 계산합니다(2026-01-01 시행 법령, 국가법령정보센터 원문 대조 2026-09-17). 규정은 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>상속·증여 핵심 정보</h2><p>상속세와 증여세는 같은 누진세율표(상속세 및 증여세법 제26조·제56조)를 쓰고, 기한 안에 신고하면 산출세액의 3%를 공제합니다(제69조, 2026-01-01 시행 기준). 증여재산공제는 수증자 기준 10년 합산 한도입니다. 계산기의 세율·공제액은 코드에 적지 않고 법령 상수표에서 받아 화면에 근거와 함께 표시합니다.</p><h2>이런 분들에게 추천</h2><p>자녀에게 재산을 이전하려는 부모, 상속 계획을 세우는 분, 부담부증여를 검토하는 분에게 유용합니다. 결과는 참고용이며 화면의 «미반영» 항목에 해당하면 실제 세액이 달라집니다.</p>', relatedCalcs: ['gift-tax', 'capital-gains-housing'],
  },
  {
    slug: 'vat-calc', emoji: '🧾', category: 'biz-tax', categoryLabel: '사업자 세금',
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
      { q: '부가세 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '부가세 계산기에서 가장 중요한 입력값은?', a: '공급가액↔VAT 역산. 부가세 포함/미포함 금액 변환. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '부가세 계산기는 무료인가요?', a: '네, 카더라 부가세 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '부가세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>부가가치세 계산기 완벽 가이드</h2><p>공급가액↔VAT 역산. 부가세 포함/미포함 금액 변환.</p><p>본 계산기는 <strong>부가가치세법 제29조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부가세 계산기 계산 방식</h2><p>공급가액 → VAT 포함: VAT = 공급가액 × 10%, 합계 = 공급가액 + VAT. VAT 포함 → 공급가액: 공급가액 = 금액 ÷ 1.1(원 단위 반올림), VAT = 금액 − 공급가액. 간이과세자 부가가치율·매입세액 공제는 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 사업자 세금 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['comprehensive-income-tax'],

  },

  // ════════════════════════════════════════
  // 추가 세금 (소득세 세분화 + 사업자 + 연말정산)
  // ════════════════════════════════════════
  { slug: 'earned-income-tax', emoji: '💼', category: 'income-tax', categoryLabel: '소득세', title: '근로소득세 간이세액 계산기', titleShort: '근로소득세 계산기', description: '월급에서 원천징수되는 근로소득세를 근사 계산. 간이세액표 자체가 아닌 근사식.', keywords: ['근로소득세','간이세액표','원천징수','월급 세금'], legalBasis: '소득세법 시행령 별표2', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'earnedIncomeTax', resultLabel: '월 원천징수세액', resultUnit: '원', inputs: [{ id: 'monthlySalary', label: '월 급여 (비과세 제외)', type: 'currency', default: 3500000 }, { id: 'family', label: '공제대상 가족수', type: 'stepper', default: 1, min: 1, max: 11 }, { id: 'children', label: '20세 이하 자녀수', type: 'stepper', default: 0, min: 0, max: 7, hint: '현재 계산에는 반영하지 않는다' }], faqs: [
      { q: '근로소득세 계산기에 적용되는 세율은?', a: '소득세법 기본세율(8단계 누진)을 적용합니다. 다만 간이세액표를 그대로 쓰지 않고 «월급 × 12 − 가족수 × 150만원 − 500만원» 에 세율을 적용해 12로 나눈 근사치라 실제 원천징수액과 차이가 납니다.' },
      { q: '근로소득세 계산기 신고 기한은?', a: '근로소득은 연말정산(2월), 종합소득세는 5월, 양도소득은 양도 후 2개월입니다.' },
      { q: '근로소득세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>근로소득세 간이세액 계산기 완벽 가이드</h2><p>월급에서 원천징수되는 근로소득세를 근사 계산. 간이세액표 자체가 아닌 근사식.</p><p>본 계산기는 <strong>소득세법 시행령 별표2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>근로소득세 계산기 계산 방식</h2><p>연간 급여(월급 × 12)에서 공제대상 가족수 × 150만원과 500만원을 뺀 금액에 소득세법 기본세율(8단계 누진)을 적용하고 12로 나눠 월 소득세를 구합니다. 지방소득세는 그 10%입니다. 간이세액표·근로소득공제·자녀 세액공제는 반영하지 않으므로 실제 원천징수액과 차이가 큽니다.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 프리랜서, 사업자 등 소득세 신고를 준비하는 모든 분에게 유용합니다.</p>', relatedCalcs: ['net-salary', 'year-end-refund'] },
  { slug: 'retirement-income-tax', emoji: '🎫', category: 'income-tax', categoryLabel: '소득세', title: '퇴직소득세 계산기', titleShort: '퇴직소득세 계산기', description: '퇴직금에 대한 퇴직소득세를 근속연수공제 등 적용하여 계산.', keywords: ['퇴직소득세','퇴직금 세금','근속연수공제','퇴직소득 과세'], legalBasis: '소득세법 제48조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'retirementIncomeTax', resultLabel: '퇴직소득세', resultUnit: '원', inputs: [{ id: 'retirementPay', label: '퇴직금 총액', type: 'currency', default: 100000000 }, { id: 'years', label: '근속연수', type: 'number', default: 10, min: 1, max: 40 }], faqs: [
      { q: '퇴직소득세 계산기에 적용되는 세율은?', a: '과세표준에 따라 6~45% 8단계 누진세율이 적용됩니다. 소득세법 제48조를 기준으로 계산합니다.' },
      { q: '소득공제와 세액공제의 차이는?', a: '소득공제는 과세표준을 줄이고, 세액공제는 산출세액에서 직접 차감합니다.' },
      { q: '퇴직소득세 계산기 신고 기한은?', a: '근로소득은 연말정산(2월), 종합소득세는 5월, 양도소득은 양도 후 2개월입니다.' },
      { q: '퇴직소득세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>퇴직소득세 계산기 완벽 가이드</h2><p>퇴직금에 대한 퇴직소득세를 근속연수공제 등 적용하여 계산. 카더라 퇴직소득세 계산기는 2026년 소득세법 기준 8단계 누진세율(6~45%)을 반영합니다.</p><p>본 계산기는 <strong>소득세법 제48조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>소득세 핵심 정보</h2><p>과세표준에 따라 1,400만원 이하 6%, 5,000만원 이하 15%, 8,800만원 이하 24%, 1.5억 이하 35%, 3억 이하 38%, 5억 이하 40%, 10억 이하 42%, 10억 초과 45%가 적용됩니다. 소득공제로 과세표준을 줄이고, 세액공제로 산출세액을 직접 차감하여 절세하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 프리랜서, 사업자 등 소득세 신고를 준비하는 모든 분에게 유용합니다. 연금저축/IRP 세액공제(최대 900만원 납입)를 활용하면 효과적으로 절세할 수 있습니다.</p>', relatedCalcs: ['retirement-pay', 'irp-deduction'] },

  { slug: 'other-income-tax', emoji: '📝', category: 'income-tax', categoryLabel: '소득세', title: '기타소득세 계산기', titleShort: '기타소득세 계산기', description: '강연료·원고료·사례금 등 기타소득에 대한 세금을 계산.', keywords: ['기타소득세','강연료 세금','원고료 세금','사례금'], legalBasis: '소득세법 제21조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'otherIncomeTax', resultLabel: '기타소득세', resultUnit: '원', inputs: [{ id: 'grossIncome', label: '기타소득 총수입', type: 'currency', default: 5000000 }, { id: 'expenseRate', label: '필요경비율', type: 'radio', default: '60', options: [{ value: '60', label: '60% (일반)' }, { value: '80', label: '80% (법정 의제 대상)' }, { value: 'actual', label: '실제 경비' }] }, { id: 'actualExpense', label: '실제 경비', type: 'currency', default: 0, condition: 'expenseRate=actual' }], faqs: [
      { q: '기타소득세 계산기에 적용되는 세율은?', a: '누진세율이 아니라 원천징수 세율 20%를 소득금액에 적용하고 지방소득세 10%를 더합니다. 종합과세로 합산 신고하면 실제 세액은 달라집니다.' },
      { q: '기타소득세 계산기 신고 기한은?', a: '근로소득은 연말정산(2월), 종합소득세는 5월, 양도소득은 양도 후 2개월입니다.' },
      { q: '기타소득세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>기타소득세 계산기 완벽 가이드</h2><p>강연료·원고료·사례금 등 기타소득에 대한 세금을 계산.</p><p>본 계산기는 <strong>소득세법 제21조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>기타소득세 계산기 계산 방식</h2><p>소득금액 = 총수입 − 필요경비(선택한 의제 경비율 또는 실제 경비). 원천징수 세율 20%를 적용한 소득세에 지방소득세 10%를 더해 보여줍니다. 소득금액이 300만원 이하면 분리과세로, 넘으면 종합과세 합산 가능 안내를 함께 표시합니다. 누진세율은 쓰지 않습니다.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 프리랜서, 사업자 등 소득세 신고를 준비하는 모든 분에게 유용합니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'withholding-3-3'] },
  { slug: 'interest-tax', emoji: '🏧', category: 'income-tax', categoryLabel: '소득세', title: '이자소득세 계산기', titleShort: '이자소득세 계산기', description: '예금·적금 이자에 대한 원천징수 세금(소득세·지방소득세·농어촌특별세)을 과세 유형별로 계산.', keywords: ['이자소득세','예금 이자 세금','15.4%','원천징수'], legalBasis: '소득세법 제129조 · 조세특례제한법 제89조의3·제88조의2 · 농어촌특별세법 제5조', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'interestTax', resultLabel: '이자 관련 세금 합계', resultUnit: '원', inputs: [{ id: 'interest', label: '이자 수입', type: 'currency', default: 1000000 }, { id: 'taxType', label: '과세 유형', type: 'radio', default: 'general', options: [{ value: 'general', label: '일반 과세 (은행 등)' }, { value: 'mutual', label: '상호금융 예탁금 (농협·수협·신협·새마을금고 등)' }, { value: 'taxFreeSavings', label: '비과세종합저축 (65세 이상 기초연금 수급자·장애인 등)' }] }, { id: 'joinYear', label: '가입 연도', type: 'select', default: '2026', condition: 'taxType=mutual', options: [{ value: '2025', label: '2025년 이전' }, { value: '2026', label: '2026년' }, { value: '2027', label: '2027년' }, { value: '2028', label: '2028년' }, { value: '2029', label: '2029년' }, { value: '2030', label: '2030년 이후' }], hint: '이자가 생긴 해가 아니라 «가입한 해» 로 갈린다' }, { id: 'eligible', label: '가입 당시 요건', type: 'radio', default: 'yes', condition: 'taxType=mutual', options: [{ value: 'yes', label: '충족' }, { value: 'no', label: '해당 없음' }], hint: '농협·수협·산림조합 조합원이거나, 직전 연도 총급여 7천만원 이하(또는 종합소득금액 6천만원 이하)' }, { id: 'farmExempt', label: '농어촌특별세 면제 대상', type: 'radio', default: 'no', condition: 'taxType=mutual', options: [{ value: 'no', label: '아니오' }, { value: 'yes', label: '예' }], hint: '농어민·임업인(5ha 이상 산림 소유자 제외)·연 총소득 2,500만원 이하 근로자' }], faqs: [
      { q: '이자소득세 계산기에 적용되는 세율은?', a: '누진세율이 아니라 원천징수 세율로 계산합니다. 일반 과세는 소득세+지방소득세, 상호금융 예탁금·비과세종합저축은 특례 세율과 농어촌특별세를 적용하며, 세율은 정책 표에서 받아 결과 화면에 표시합니다.' },
      { q: '이자소득세 계산기 신고 기한은?', a: '근로소득은 연말정산(2월), 종합소득세는 5월, 양도소득은 양도 후 2개월입니다.' },
      { q: '이자소득세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>이자소득세 계산기 완벽 가이드</h2><p>예금·적금 이자에 대한 원천징수 세금(소득세·지방소득세·농어촌특별세)을 과세 유형별로 계산.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>이자소득세 계산기 계산 방식</h2><p>일반 과세는 이자에 소득세율을 곱하고 지방소득세(소득세의 일정 비율)를 더합니다. 상호금융 예탁금·비과세종합저축은 가입 연도·요건에 따라 특례(저율 분리과세·비과세)와 농어촌특별세를 따로 계산하며, 원금을 묻지 않으므로 전액이 특례 한도 안이라고 가정합니다. 세율은 서버의 정책 표에서 받아 결과 화면에 표시하고, 받지 못하면 계산하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 프리랜서, 사업자 등 소득세 신고를 준비하는 모든 분에게 유용합니다.</p>', relatedCalcs: ['deposit-interest', 'financial-income-tax'] },

  { slug: 'income-bracket-lookup', emoji: '📊', category: 'income-tax', categoryLabel: '소득세', title: '소득세 누진세율 조회기', titleShort: '소득세율 조회', description: '과세표준 금액별 소득세 누진세율(6~45% 8단계)을 조회.', keywords: ['소득세율','누진세율','과세표준','세율표'], legalBasis: '소득세법 제55조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'incomeBracketLookup', resultLabel: '소득세', resultUnit: '원', inputs: [{ id: 'taxBase', label: '과세표준', type: 'currency', default: 50000000 }], faqs: [
      { q: '소득세율 조회에 적용되는 세율은?', a: '과세표준에 따라 6~45% 8단계 누진세율이 적용됩니다. 소득세법 제55조를 기준으로 계산합니다.' },
      { q: '소득공제와 세액공제의 차이는?', a: '소득공제는 과세표준을 줄이고, 세액공제는 산출세액에서 직접 차감합니다.' },
      { q: '소득세율 조회 신고 기한은?', a: '근로소득은 연말정산(2월), 종합소득세는 5월, 양도소득은 양도 후 2개월입니다.' },
      { q: '소득세율 조회는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>소득세 누진세율 조회기 완벽 가이드</h2><p>과세표준 금액별 소득세 누진세율(6~45% 8단계)을 조회. 카더라 소득세율 조회는 2026년 소득세법 기준 8단계 누진세율(6~45%)을 반영합니다.</p><p>본 계산기는 <strong>소득세법 제55조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>소득세 핵심 정보</h2><p>과세표준에 따라 1,400만원 이하 6%, 5,000만원 이하 15%, 8,800만원 이하 24%, 1.5억 이하 35%, 3억 이하 38%, 5억 이하 40%, 10억 이하 42%, 10억 초과 45%가 적용됩니다. 소득공제로 과세표준을 줄이고, 세액공제로 산출세액을 직접 차감하여 절세하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 프리랜서, 사업자 등 소득세 신고를 준비하는 모든 분에게 유용합니다. 연금저축/IRP 세액공제(최대 900만원 납입)를 활용하면 효과적으로 절세할 수 있습니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'net-salary'] },
  { slug: 'local-income-tax', emoji: '🏛️', category: 'income-tax', categoryLabel: '소득세', title: '지방소득세 계산기', titleShort: '지방소득세 계산기', description: '소득세의 10%를 자동 계산하는 지방소득세 계산기.', keywords: ['지방소득세','소득세 10%','지방세'], legalBasis: '지방세법 제86조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'localIncomeTax', resultLabel: '지방소득세', resultUnit: '원', inputs: [{ id: 'incomeTax', label: '소득세', type: 'currency', default: 5000000 }], faqs: [
      { q: '지방소득세 계산기에 적용되는 세율은?', a: '입력한 소득세의 10%를 지방소득세로 계산합니다. 누진세율표를 따로 적용하지 않습니다.' },
      { q: '지방소득세 계산기 신고 기한은?', a: '근로소득은 연말정산(2월), 종합소득세는 5월, 양도소득은 양도 후 2개월입니다.' },
      { q: '지방소득세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>지방소득세 계산기 완벽 가이드</h2><p>소득세의 10%를 자동 계산하는 지방소득세 계산기.</p><p>본 계산기는 <strong>지방세법 제86조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>지방소득세 계산기 계산 방식</h2><p>지방소득세 = 입력한 소득세 × 10% 이며, 소득세와 합계도 함께 보여줍니다. 과세표준·누진세율표는 쓰지 않습니다.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 프리랜서, 사업자 등 소득세 신고를 준비하는 모든 분에게 유용합니다.</p>', relatedCalcs: ['comprehensive-income-tax'] },


  // 사업자 세금 추가
  { slug: 'simplified-vat', emoji: '🏪', category: 'biz-tax', categoryLabel: '사업자 세금', title: '간이과세자 부가세 계산기', titleShort: '간이과세 부가세', description: '간이과세자 업종별 부가가치율(1.5~4%) 적용 부가세를 계산.', keywords: ['간이과세자','부가세','업종별 부가가치율','간이과세'], legalBasis: '부가가치세법 제61조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'simplifiedVat', resultLabel: '납부 부가세', resultUnit: '원', inputs: [{ id: 'revenue', label: '연 매출액', type: 'currency', default: 30000000 }, { id: 'industryRate', label: '업종별 부가가치율', type: 'select', default: '0.03', options: [{ value: '0.015', label: '전기/가스/수도 (1.5%)' }, { value: '0.02', label: '소매/음식 (2%)' }, { value: '0.03', label: '제조/건설/운수 (3%)' }, { value: '0.04', label: '서비스업 (4%)' }] }, { id: 'purchaseVat', label: '매입 부가세', type: 'currency', default: 500000 }], faqs: [
      { q: '간이과세 부가세 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 부가가치세법 제61조를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '간이과세 부가세에서 가장 중요한 입력값은?', a: '간이과세자 업종별 부가가치율(1.5~4%) 적용 부가세를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '간이과세 부가세는 무료인가요?', a: '네, 카더라 간이과세 부가세는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '간이과세 부가세는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>간이과세자 부가세 계산기 완벽 가이드</h2><p>간이과세자 업종별 부가가치율(1.5~4%) 적용 부가세를 계산. 카더라 간이과세 부가세는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>부가가치세법 제61조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>사업자 세금 핵심 정보</h2><p>일반과세자는 매출의 10% 부가세를 징수·납부하고, 간이과세자는 업종별 부가가치율(1.5~4%) 적용. 법인세는 2억 이하 9%, 200억 이하 19%, 3000억 이하 21%, 초과 24%입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 사업자 세금 계산이 필요한 분에게 유용합니다. 카더라는 사업자 세금 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['vat-calc', 'comprehensive-income-tax'] },
  { slug: 'corporate-tax', emoji: '🏢', category: 'biz-tax', categoryLabel: '사업자 세금', title: '법인세 계산기', titleShort: '법인세 계산기', description: '법인 과세표준별 법인세 산출세액과 법인지방소득세를 계산. 사업연도 개시일로 2026 개정 세율과 종전 세율을 구분.', keywords: ['법인세 계산기','법인세율','과세표준','법인 세금'], legalBasis: '법인세법 제55조 · 지방세법 제103조의20', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'tax-bracket', formula: 'corporateTax', resultLabel: '법인세', resultUnit: '원', inputs: [{ id: 'taxBase', label: '과세표준', type: 'currency', default: 500000000 }, { id: 'fiscalStart', label: '사업연도 개시일', type: 'select', default: 'y2026', options: [{ value: 'y2026', label: '2026-01-01 이후 개시 (개정 세율)' }, { value: 'pre2026', label: '2025-12-31 이전 개시 (종전 세율)' }], hint: '세율은 신고 시점이 아니라 사업연도 «개시일» 로 갈린다' }, { id: 'corpType', label: '법인 구분', type: 'select', default: 'general', options: [{ value: 'general', label: '일반 법인' }, { value: 'smallRental', label: '성실신고확인 소규모 법인 (부동산임대업 주업 등)' }] }], faqs: [
      { q: '2026년에 법인세율이 바뀌었나요?', a: '네. 법인세법 개정(법률 제21217호, 2025-12-23 공포)으로 2026-01-01 이후 개시하는 사업연도부터 과세표준 구간별 세율이 1%p씩 올라 10%·20%·22%·25%가 됐습니다. 그 전에 개시한 사업연도는 종전 세율 9%·19%·21%·24%입니다.' },
      { q: '법인세 계산기 결과는 정확한가요?', a: '산출세액 기준 참고값입니다. 세액공제·감면·최저한세, 사업연도 1년 미만 환산, 토지등 양도소득 법인세는 반영하지 않습니다. 법인세법 제55조를 기준으로 계산합니다.' },
      { q: '법인지방소득세는 얼마인가요?', a: '표준세율은 법인세율의 10분의 1(2026-01-01 이후 개시 사업연도 1.0~2.5%)이며, 지자체 조례로 50% 범위에서 가감될 수 있습니다(지방세법 제103조의20).' },
      { q: '법인세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>법인세 계산기 완벽 가이드</h2><p>법인 과세표준에 구간별 누진세율을 적용해 법인세 산출세액을 구하고, 법인지방소득세를 더해 보여 줍니다. 세율표는 사업연도 개시일(2026-01-01 전후)과 법인 구분(일반 / 성실신고확인 소규모 법인)으로 고릅니다.</p><p>본 계산기는 <strong>법인세법 제55조(법률 제21217호, 2026-01-01 시행)와 지방세법 제103조의20</strong>을 기준으로 계산합니다(국가법령정보센터 원문 대조 2026-09-17). 세율은 법령 상수표에서 받아 화면에 근거와 함께 표시합니다.</p><h2>2026 개정 핵심</h2><p>2026-01-01 이후 개시하는 사업연도부터 과세표준 2억원 이하 10%, 200억원 이하 20%, 3,000억원 이하 22%, 3,000억원 초과 25%가 적용됩니다(종전 9%·19%·21%·24%). 부동산임대업을 주업으로 하는 성실신고확인 소규모 법인은 200억원 이하 구간부터 20%입니다.</p><h2>이런 분들에게 추천</h2><p>법인 결산 전에 세 부담을 가늠하려는 대표, 사업연도 개시일에 따라 세율이 어떻게 달라지는지 확인하려는 분에게 유용합니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['vat-calc'] },

  { slug: 'penalty-tax', emoji: '⚠️', category: 'biz-tax', categoryLabel: '사업자 세금', title: '가산세 계산기', titleShort: '가산세 계산기', description: '무신고·과소신고·납부불성실 가산세를 계산.', keywords: ['가산세 계산기','무신고 가산세','과소신고','납부불성실'], legalBasis: '국세기본법 제47조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'penaltyTax', resultLabel: '가산세', resultUnit: '원', inputs: [{ id: 'type', label: '가산세 종류', type: 'radio', default: 'noFiling', options: [{ value: 'noFiling', label: '무신고 (20%)' }, { value: 'underReport', label: '과소신고 (10%)' }, { value: 'latePay', label: '납부불성실' }] }, { id: 'taxAmount', label: '세액', type: 'currency', default: 5000000 }, { id: 'days', label: '지연일수', type: 'number', default: 30, min: 1, max: 365, condition: 'type=latePay' }], faqs: [
      { q: '가산세 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 국세기본법 제47조를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '가산세 계산기에서 가장 중요한 입력값은?', a: '무신고·과소신고·납부불성실 가산세를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '가산세 계산기는 무료인가요?', a: '네, 카더라 가산세 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '가산세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>가산세 계산기 완벽 가이드</h2><p>무신고·과소신고·납부불성실 가산세를 계산. 카더라 가산세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>국세기본법 제47조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>사업자 세금 핵심 정보</h2><p>일반과세자는 매출의 10% 부가세를 징수·납부하고, 간이과세자는 업종별 부가가치율(1.5~4%) 적용. 법인세는 2억 이하 9%, 200억 이하 19%, 3000억 이하 21%, 초과 24%입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 사업자 세금 계산이 필요한 분에게 유용합니다. 카더라는 사업자 세금 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'vat-calc'] },
  { slug: 'expense-rate-lookup', emoji: '🔍', category: 'biz-tax', categoryLabel: '사업자 세금', title: '업종별 경비율 조회기', titleShort: '경비율 조회기', description: '총수입금액과 경비율(직접 입력)로 추정 필요경비와 소득금액을 계산.', keywords: ['단순경비율','기준경비율','업종별 경비율','추계신고'], legalBasis: '소득세법 시행령 제143조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'expenseRateLookup', resultLabel: '추정 소득금액', resultUnit: '원', inputs: [{ id: 'revenue', label: '총 수입금액', type: 'currency', default: 50000000 }, { id: 'rateType', label: '적용 경비율', type: 'radio', default: 'simple', options: [{ value: 'simple', label: '단순경비율' }, { value: 'standard', label: '기준경비율' }] }, { id: 'rate', label: '경비율 (%)', type: 'percent', default: 90.1, min: 0, max: 99 }], faqs: [
      { q: '경비율 조회기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '경비율 조회기에서 가장 중요한 입력값은?', a: '총수입금액과 경비율(직접 입력)로 추정 필요경비와 소득금액을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '경비율 조회기는 무료인가요?', a: '네, 카더라 경비율 조회기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '경비율 조회기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>업종별 경비율 조회기 완벽 가이드</h2><p>총수입금액과 경비율(직접 입력)로 추정 필요경비와 소득금액을 계산.</p><p>본 계산기는 <strong>소득세법 시행령 제143조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>경비율 조회기 계산 방식</h2><p>추정 필요경비 = 총 수입금액 × 경비율, 추정 소득금액 = 총 수입금액 − 필요경비 입니다. 업종코드별 단순·기준경비율은 자동으로 찾아 주지 않으므로 국세청 고시에서 확인해 경비율 칸에 넣으세요.</p><h2>이런 분들에게 추천</h2><p>정확한 사업자 세금 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'withholding-3-3'] },


  // 연말정산 추가
  { slug: 'medical-deduction', emoji: '🏥', category: 'year-end', categoryLabel: '연말정산', title: '의료비 세액공제 계산기', titleShort: '의료비 공제 계산기', description: '총급여 3% 초과 의료비에 대해 15% 세액공제를 계산.', keywords: ['의료비 세액공제','의료비 공제','연말정산 의료비'], legalBasis: '소득세법 제59조의4', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'medicalDeduction', resultLabel: '의료비 세액공제', resultUnit: '원', inputs: [{ id: 'annualSalary', label: '총급여', type: 'currency', default: 50000000 }, { id: 'totalMedical', label: '의료비 합계', type: 'currency', default: 3000000 }, { id: 'seniorMedical', label: '65세 이상·장애인 의료비', type: 'currency', default: 0 }], faqs: [
      { q: '의료비 공제 계산기에서 최대 환급을 받으려면?', a: '연금저축/IRP, 신용카드/체크카드, 의료비·교육비·기부금 공제를 빠짐없이 챙기세요.' },
      { q: '연말정산은 언제 하나요?', a: '매년 1~2월 직장에서 진행. 간소화 서비스는 1월 15일경 오픈됩니다.' },
      { q: '의료비 공제 계산기 결과가 실제와 다를 수 있나요?', a: '인적공제, 기납부세액, 감면 등 세부 조건에 따라 차이가 발생합니다. 소득세법 제59조의4를 기준으로 계산합니다.' },
      { q: '의료비 공제 계산기는 무료인가요?', a: '네, 카더라 의료비 공제 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>의료비 세액공제 계산기 완벽 가이드</h2><p>총급여 3% 초과 의료비에 대해 15% 세액공제를 계산. 카더라 의료비 공제 계산기는 2026년 세법 기준으로 정확한 공제액을 계산합니다.</p><p>본 계산기는 <strong>소득세법 제59조의4</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>소득공제(인적공제, 신용카드, 주택청약)와 세액공제(의료비, 교육비, 기부금, 보험료, 연금저축)를 최대한 활용하면 상당한 환급을 받을 수 있습니다. 국세청 간소화 서비스(1월 15일 오픈)를 활용하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 연말정산 환급을 극대화하고 싶은 직장인에게 필수입니다. 체크카드 사용 비율 높이기, 연금저축/IRP 최대 납입, 월세 세액공제 신청이 핵심 전략입니다.</p>', relatedCalcs: ['year-end-refund'] },
  { slug: 'education-deduction', emoji: '🎓', category: 'year-end', categoryLabel: '연말정산', title: '교육비 세액공제 계산기', titleShort: '교육비 공제 계산기', description: '본인·자녀 교육비에 대해 15% 세액공제를 계산.', keywords: ['교육비 세액공제','등록금 공제','연말정산 교육비'], legalBasis: '소득세법 제59조의4', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'educationDeduction', resultLabel: '교육비 세액공제', resultUnit: '원', inputs: [{ id: 'selfEdu', label: '본인 교육비', type: 'currency', default: 0, hint: '대학원 등 한도 없음' }, { id: 'childEdu', label: '자녀 교육비', type: 'currency', default: 3000000, hint: '1인당 연 300만원 한도' }, { id: 'childCount', label: '자녀수', type: 'stepper', default: 1, min: 0, max: 5 }], faqs: [
      { q: '교육비 공제 계산기에서 최대 환급을 받으려면?', a: '연금저축/IRP, 신용카드/체크카드, 의료비·교육비·기부금 공제를 빠짐없이 챙기세요.' },
      { q: '연말정산은 언제 하나요?', a: '매년 1~2월 직장에서 진행. 간소화 서비스는 1월 15일경 오픈됩니다.' },
      { q: '교육비 공제 계산기 결과가 실제와 다를 수 있나요?', a: '인적공제, 기납부세액, 감면 등 세부 조건에 따라 차이가 발생합니다. 소득세법 제59조의4를 기준으로 계산합니다.' },
      { q: '교육비 공제 계산기는 무료인가요?', a: '네, 카더라 교육비 공제 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>교육비 세액공제 계산기 완벽 가이드</h2><p>본인·자녀 교육비에 대해 15% 세액공제를 계산. 카더라 교육비 공제 계산기는 2026년 세법 기준으로 정확한 공제액을 계산합니다.</p><p>본 계산기는 <strong>소득세법 제59조의4</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>소득공제(인적공제, 신용카드, 주택청약)와 세액공제(의료비, 교육비, 기부금, 보험료, 연금저축)를 최대한 활용하면 상당한 환급을 받을 수 있습니다. 국세청 간소화 서비스(1월 15일 오픈)를 활용하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 연말정산 환급을 극대화하고 싶은 직장인에게 필수입니다. 체크카드 사용 비율 높이기, 연금저축/IRP 최대 납입, 월세 세액공제 신청이 핵심 전략입니다.</p>', relatedCalcs: ['year-end-refund'] },

  { slug: 'donation-deduction', emoji: '❤️', category: 'year-end', categoryLabel: '연말정산', title: '기부금 세액공제 계산기', titleShort: '기부금 공제 계산기', description: '법정·지정·종교 기부금에 대한 세액공제를 계산.', keywords: ['기부금 세액공제','기부금 공제','종교 기부금','연말정산 기부금'], legalBasis: '소득세법 제59조의4', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'donationDeduction', resultLabel: '기부금 세액공제', resultUnit: '원', inputs: [{ id: 'annualSalary', label: '총급여', type: 'currency', default: 50000000 }, { id: 'legalDonation', label: '법정 기부금', type: 'currency', default: 0 }, { id: 'designatedDonation', label: '지정 기부금', type: 'currency', default: 500000 }, { id: 'religiousDonation', label: '종교단체 기부금', type: 'currency', default: 1000000 }], faqs: [
      { q: '기부금 공제 계산기에서 최대 환급을 받으려면?', a: '연금저축/IRP, 신용카드/체크카드, 의료비·교육비·기부금 공제를 빠짐없이 챙기세요.' },
      { q: '연말정산은 언제 하나요?', a: '매년 1~2월 직장에서 진행. 간소화 서비스는 1월 15일경 오픈됩니다.' },
      { q: '기부금 공제 계산기 결과가 실제와 다를 수 있나요?', a: '인적공제, 기납부세액, 감면 등 세부 조건에 따라 차이가 발생합니다. 소득세법 제59조의4를 기준으로 계산합니다.' },
      { q: '기부금 공제 계산기는 무료인가요?', a: '네, 카더라 기부금 공제 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>기부금 세액공제 계산기 완벽 가이드</h2><p>법정·지정·종교 기부금에 대한 세액공제를 계산. 카더라 기부금 공제 계산기는 2026년 세법 기준으로 정확한 공제액을 계산합니다.</p><p>본 계산기는 <strong>소득세법 제59조의4</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>소득공제(인적공제, 신용카드, 주택청약)와 세액공제(의료비, 교육비, 기부금, 보험료, 연금저축)를 최대한 활용하면 상당한 환급을 받을 수 있습니다. 국세청 간소화 서비스(1월 15일 오픈)를 활용하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 연말정산 환급을 극대화하고 싶은 직장인에게 필수입니다. 체크카드 사용 비율 높이기, 연금저축/IRP 최대 납입, 월세 세액공제 신청이 핵심 전략입니다.</p>', relatedCalcs: ['year-end-refund'] },
  { slug: 'insurance-deduction', emoji: '🛡️', category: 'year-end', categoryLabel: '연말정산', title: '보험료 세액공제 계산기', titleShort: '보험료 공제 계산기', description: '보장성보험 연 100만원 한도, 12% 세액공제를 계산.', keywords: ['보험료 세액공제','보장성보험 공제','연말정산 보험'], legalBasis: '소득세법 제59조의4', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'insuranceDeduction', resultLabel: '보험료 세액공제', resultUnit: '원', inputs: [{ id: 'premium', label: '보장성보험료 합계', type: 'currency', default: 1200000, hint: '한도 연 100만원' }, { id: 'disabilityPremium', label: '장애인전용보험료', type: 'currency', default: 0, hint: '한도 연 100만원 별도' }], faqs: [
      { q: '보험료 공제 계산기에서 최대 환급을 받으려면?', a: '연금저축/IRP, 신용카드/체크카드, 의료비·교육비·기부금 공제를 빠짐없이 챙기세요.' },
      { q: '연말정산은 언제 하나요?', a: '매년 1~2월 직장에서 진행. 간소화 서비스는 1월 15일경 오픈됩니다.' },
      { q: '보험료 공제 계산기 결과가 실제와 다를 수 있나요?', a: '인적공제, 기납부세액, 감면 등 세부 조건에 따라 차이가 발생합니다. 소득세법 제59조의4를 기준으로 계산합니다.' },
      { q: '보험료 공제 계산기는 무료인가요?', a: '네, 카더라 보험료 공제 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>보험료 세액공제 계산기 완벽 가이드</h2><p>보장성보험 연 100만원 한도, 12% 세액공제를 계산. 카더라 보험료 공제 계산기는 2026년 세법 기준으로 정확한 공제액을 계산합니다.</p><p>본 계산기는 <strong>소득세법 제59조의4</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연말정산 핵심 정보</h2><p>소득공제(인적공제, 신용카드, 주택청약)와 세액공제(의료비, 교육비, 기부금, 보험료, 연금저축)를 최대한 활용하면 상당한 환급을 받을 수 있습니다. 국세청 간소화 서비스(1월 15일 오픈)를 활용하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 연말정산 환급을 극대화하고 싶은 직장인에게 필수입니다. 체크카드 사용 비율 높이기, 연금저축/IRP 최대 납입, 월세 세액공제 신청이 핵심 전략입니다.</p>', relatedCalcs: ['year-end-refund'] },

  { slug: 'child-credit', emoji: '👶', category: 'year-end', categoryLabel: '연말정산', title: '자녀 세액공제 계산기', titleShort: '자녀 공제 계산기', description: '자녀수별 세액공제 + 출산/입양 추가공제를 계산.', keywords: ['자녀 세액공제','자녀 공제','출산 공제','연말정산 자녀'], legalBasis: '소득세법 제59조의2', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'childCredit', resultLabel: '자녀 세액공제', resultUnit: '원', inputs: [{ id: 'childCount', label: '8세 이상 자녀수', type: 'stepper', default: 2, min: 0, max: 7 }, { id: 'newborn', label: '출산/입양 자녀수', type: 'stepper', default: 0, min: 0, max: 3 }], faqs: [
      { q: '자녀 공제 계산기에서 최대 환급을 받으려면?', a: '연금저축/IRP, 신용카드/체크카드, 의료비·교육비·기부금 공제를 빠짐없이 챙기세요.' },
      { q: '연말정산은 언제 하나요?', a: '매년 1~2월 직장에서 진행. 간소화 서비스는 1월 15일경 오픈됩니다.' },
      { q: '자녀 공제 계산기 결과가 실제와 다를 수 있나요?', a: '인적공제, 기납부세액, 감면 등 세부 조건에 따라 차이가 발생합니다. 소득세법 제59조의2를 기준으로 계산합니다.' },
      { q: '자녀 공제 계산기는 무료인가요?', a: '네, 카더라 자녀 공제 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>자녀 세액공제 계산기 완벽 가이드</h2><p>자녀수별 세액공제 + 출산/입양 추가공제를 계산.</p><p>본 계산기는 <strong>소득세법 제59조의2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>자녀 공제 계산기 계산 방식</h2><p>자녀 수에 따라 첫째·둘째·셋째 이후 공제액을 더하고, 출산·입양 자녀 수에 따라 추가 공제를 더합니다. 공제 금액은 계산기에 설정된 표를 쓰며 결과 화면에 기본공제와 출산·입양 공제로 나눠 보여줍니다. 나이·기본공제대상 요건은 판단하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 연말정산 환급을 극대화하고 싶은 직장인에게 필수입니다. 체크카드 사용 비율 높이기, 연금저축/IRP 최대 납입, 월세 세액공제 신청이 핵심 전략입니다.</p>', relatedCalcs: ['year-end-refund'] },
  { slug: 'housing-fund-deduction', emoji: '🏠', category: 'year-end', categoryLabel: '연말정산', title: '주택자금 소득공제 계산기', titleShort: '주택자금 공제 계산기', description: '주택청약·주택담보대출 이자에 대한 소득공제를 계산.', keywords: ['주택자금 소득공제','주택청약 공제','주담대 이자 공제'], legalBasis: '소득세법 제52조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'housingFundDeduction', resultLabel: '소득공제 금액', resultUnit: '원', inputs: [{ id: 'subscription', label: '주택청약 납입액', type: 'currency', default: 2400000, hint: '한도 연 300만원 (무주택 세대주)' }, { id: 'mortgageInterest', label: '장기주담대 이자 상환액', type: 'currency', default: 0, hint: '상환기간별 공제 한도는 계산에 적용하지 않는다 — 한도 안의 금액을 넣는다' }], faqs: [
      { q: '주택자금 공제 계산기에서 최대 환급을 받으려면?', a: '연금저축/IRP, 신용카드/체크카드, 의료비·교육비·기부금 공제를 빠짐없이 챙기세요.' },
      { q: '연말정산은 언제 하나요?', a: '매년 1~2월 직장에서 진행. 간소화 서비스는 1월 15일경 오픈됩니다.' },
      { q: '주택자금 공제 계산기 결과가 실제와 다를 수 있나요?', a: '인적공제, 기납부세액, 감면 등 세부 조건에 따라 차이가 발생합니다. 소득세법 제52조를 기준으로 계산합니다.' },
      { q: '주택자금 공제 계산기는 무료인가요?', a: '네, 카더라 주택자금 공제 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연말정산 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>주택자금 소득공제 계산기 완벽 가이드</h2><p>주택청약·주택담보대출 이자에 대한 소득공제를 계산.</p><p>본 계산기는 <strong>소득세법 제52조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>주택자금 공제 계산기 계산 방식</h2><p>주택청약 납입액은 연 300만원까지를, 장기주택저당차입금 이자 상환액은 입력한 금액을 그대로 더해 보여줍니다. 청약저축 소득공제율(납입액의 일정 비율), 상환기간·금리 방식별 이자 공제 한도, 무주택 세대주·총급여 요건은 판단하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 연말정산 환급을 극대화하고 싶은 직장인에게 필수입니다. 체크카드 사용 비율 높이기, 연금저축/IRP 최대 납입, 월세 세액공제 신청이 핵심 전략입니다.</p>', relatedCalcs: ['year-end-refund', 'loan-repayment'] },


  // 부동산 세금 추가
  { slug: 'comprehensive-property-tax', emoji: '🏘️', category: 'property-tax', categoryLabel: '부동산 세금', title: '종합부동산세 계산기', titleShort: '종부세 계산기', description: '공시가격 합계로 주택분 종합부동산세와 농어촌특별세를 계산. 주택 수별 세율표·1세대1주택 고령자·장기보유 공제 반영(재산세 공제 전).', keywords: ['종합부동산세 계산기','종부세','공시가격','1세대1주택'], legalBasis: '종합부동산세법 제8조·제9조 · 농어촌특별세법 제5조', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'tax-bracket', formula: 'comprehensivePropertyTax', resultLabel: '종부세', resultUnit: '원', inputs: [{ id: 'publicPrice', label: '본인 소유 주택 공시가격 합계', type: 'currency', default: 1500000000 }, { id: 'houseCount', label: '본인 소유 주택 수', type: 'stepper', default: 1, min: 1, max: 10, hint: '3주택 이상이면 과세표준 12억원 초과 구간에 높은 세율표' }, { id: 'oneHouse', label: '1세대1주택자', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '예 (12억 공제)' }, { value: 'no', label: '아니오 (9억 공제)' }] }, { id: 'elderAge', label: '과세기준일 나이', type: 'select', default: 'none', condition: 'oneHouse=yes', options: [{ value: 'none', label: '만 60세 미만' }, { value: 'a60', label: '만 60~65세 미만' }, { value: 'a65', label: '만 65~70세 미만' }, { value: 'a70', label: '만 70세 이상' }] }, { id: 'holdPeriod', label: '주택 보유기간', type: 'select', default: 'none', condition: 'oneHouse=yes', options: [{ value: 'none', label: '5년 미만' }, { value: 'h5', label: '5~10년 미만' }, { value: 'h10', label: '10~15년 미만' }, { value: 'h15', label: '15년 이상' }] }], faqs: [
      { q: '종부세 계산기 결과는 실제 고지액과 같나요?', a: '아닙니다. 재산세로 부과된 세액 중 종부세 과세표준분 공제와 세부담상한은 반영하지 않아 실제 고지액보다 크게 나옵니다. 법인·합산배제 임대주택·토지분도 제외입니다.' },
      { q: '주택 수에 따라 세율이 다른가요?', a: '네. 2주택 이하와 3주택 이상의 세율표가 따로 있고 과세표준 12억원 초과 구간부터 달라집니다. 조정대상지역 여부는 현행 세율 구분에 쓰이지 않습니다(종합부동산세법 제9조, 2026-01-01 시행 기준).' },
      { q: '1세대1주택자 공제는 무엇이 있나요?', a: '공시가격에서 12억원을 공제하고, 산출세액에서 고령자 공제(만 60세 이상)와 장기보유 공제(5년 이상)를 합계 80% 한도로 뺍니다(제8조·제9조, 2026-01-01 시행 기준).' },
      { q: '종부세 계산기는 모바일에서도 되나요?', a: '네, 모바일·태블릿·PC 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 공유 가능합니다.' },
    ], seoContent: '<h2>종합부동산세 계산기 완벽 가이드</h2><p>본인 소유 주택의 공시가격 합계에서 공제액(1세대1주택자 12억원, 그 외 9억원)을 빼고 공정시장가액비율을 곱한 과세표준에, 보유 주택 수(2주택 이하 / 3주택 이상)에 맞는 누진세율표를 적용합니다. 1세대1주택자는 고령자·장기보유 공제를 반영하고, 종부세의 20%인 농어촌특별세를 더합니다.</p><p>본 계산기는 <strong>종합부동산세법 제8조·제9조, 같은 법 시행령 제2조의4, 농어촌특별세법 제5조</strong>를 기준으로 계산합니다(2026년 시행 법령, 국가법령정보센터 원문 대조 2026-09-17). 세율·공제액은 법령 상수표에서 받아 화면에 근거와 함께 표시합니다.</p><h2>계산하지 않는 것</h2><p>재산세 상당액 공제(제9조제3항)와 세부담상한(제10조)은 산식을 원문 대조하지 않아 계산하지 않습니다. 그래서 결과는 실제 고지액보다 큰 «공제 전» 금액입니다. 법인·합산배제 임대주택·토지분 종부세도 제외합니다.</p><h2>이런 분들에게 추천</h2><p>보유 주택의 종부세 규모를 가늠하려는 분, 주택 수를 늘리거나 줄일 때 세율표가 어떻게 바뀌는지 보려는 분에게 유용합니다. 정확한 세액은 고지서나 세무사 상담으로 확인하세요.</p>', relatedCalcs: ['property-tax', 'acquisition-tax'] },
  { slug: 'rental-income-tax', emoji: '🏠', category: 'property-tax', categoryLabel: '부동산 세금', title: '주택임대소득세 계산기', titleShort: '임대소득세 계산기', description: '주택 임대소득에 대한 분리과세/종합과세 세금을 비교 계산.', keywords: ['주택임대소득세','임대소득 세금','분리과세','종합과세'], legalBasis: '소득세법 제64조의2', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'rentalIncomeTax', resultLabel: '임대소득세', resultUnit: '원', inputs: [{ id: 'annualRent', label: '연간 임대수입', type: 'currency', default: 15000000 }, { id: 'otherIncome', label: '기타 종합소득', type: 'currency', default: 40000000 }, { id: 'registered', label: '임대사업자 등록', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '등록 (60% 경비율)' }, { value: 'no', label: '미등록 (50% 경비율)' }] }], faqs: [
      { q: '임대소득세 계산기 결과는 실제 세금과 같나요?', a: '참고용이며, 감면·중과·특례 등에 따라 차이가 있습니다. 소득세법 제64조의2를 기준으로 계산합니다. 정확한 세액은 세무사 상담을 권장합니다.' },
      { q: '임대소득세 계산기에서 조정대상지역은 반영되나요?', a: '네, 조정대상지역 여부에 따른 세율 차이를 반영합니다. 최신 규제지역은 국토교통부에서 확인하세요.' },
      { q: '부동산 세금 절세 방법은?', a: '1세대1주택 비과세, 장기보유특별공제, 생애최초 감면 등을 활용하세요.' },
      { q: '임대소득세 계산기는 모바일에서도 되나요?', a: '네, 모바일·태블릿·PC 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 공유 가능합니다.' },
    ], seoContent: '<h2>주택임대소득세 계산기 완벽 가이드</h2><p>주택 임대소득에 대한 분리과세/종합과세 세금을 비교 계산. 카더라 임대소득세 계산기는 2026년 최신 세법을 반영하여 조정대상지역, 주택 수, 면적, 취득 원인에 따른 세율을 자동 적용합니다.</p><p>본 계산기는 <strong>소득세법 제64조의2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 세금 핵심 포인트</h2><p>부동산 거래 시 취득세(1~12%), 양도소득세(6~45%+중과), 재산세, 종합부동산세 등 다양한 세금이 부과됩니다. 1세대1주택 비과세(12억까지), 장기보유특별공제(최대 80%), 생애최초 감면(200만원 한도) 등 절세 제도를 적극 활용하세요.</p><h2>이런 분들에게 추천</h2><p>주택 매매·매도를 계획 중인 분, 다주택 중과세 영향을 파악하고 싶은 분, 부동산 투자 수익률을 계산하고 싶은 분에게 유용합니다. 카더라는 부동산 세금 포함 142종의 무료 계산기를 제공합니다.</p>', relatedCalcs: ['rental-yield', 'comprehensive-income-tax'] },


  // 금융 세금 추가
  { slug: 'crypto-tax', emoji: '🪙', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: '가상자산(코인) 세금 계산기', titleShort: '코인 세금 계산기', description: '2027년 시행 예정 가상자산 과세 — 250만원 공제, 22% 세율 시뮬레이션.', keywords: ['코인 세금','가상자산 과세','비트코인 세금','암호화폐 세금','250만원 공제'], legalBasis: '소득세법 제37조 (2027년 시행)', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'cryptoTax', resultLabel: '가상자산 소득세', resultUnit: '원', inputs: [{ id: 'profit', label: '양도차익', type: 'currency', default: 10000000 }], faqs: [
      { q: '코인 세금 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 소득세법 제37조 (2027년 시행)를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '코인 세금 계산기에서 가장 중요한 입력값은?', a: '2027년 시행 예정 가상자산 과세 — 250만원 공제, 22% 세율 시뮬레이션. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '코인 세금 계산기는 무료인가요?', a: '네, 카더라 코인 세금 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '코인 세금 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>가상자산(코인) 세금 계산기 완벽 가이드</h2><p>2027년 시행 예정 가상자산 과세 — 250만원 공제, 22% 세율 시뮬레이션. 카더라 코인 세금 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제37조 (2027년 시행)</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>금융/투자 세금 핵심 정보</h2><p>금융투자 수익 과세: 국내 상장주식은 대주주만 양도세, 해외주식은 250만원 초과 시 22%, ETF 배당은 15.4%, ISA 비과세 한도는 일반 200만원·서민 400만원입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 금융/투자 세금 계산이 필요한 분에게 유용합니다. 카더라는 금융/투자 세금 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['overseas-cgt', 'financial-income-tax'] },
  { slug: 'etf-tax', emoji: '📈', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: 'ETF 과세 계산기', titleShort: 'ETF 과세 계산기', description: '국내/해외 ETF 매도 시 배당소득세 또는 양도소득세를 계산.', keywords: ['ETF 세금','국내 ETF 과세','해외 ETF 세금','배당소득세'], legalBasis: '소득세법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'etfTax', resultLabel: 'ETF 세금', resultUnit: '원', inputs: [{ id: 'type', label: 'ETF 유형', type: 'radio', default: 'domestic', options: [{ value: 'domestic', label: '국내 ETF (배당소득세 15.4%)' }, { value: 'overseas', label: '해외 ETF (양도세 22%)' }] }, { id: 'profit', label: '매도 차익', type: 'currency', default: 5000000 }], faqs: [
      { q: 'ETF 과세 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 소득세법를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: 'ETF 과세 계산기에서 가장 중요한 입력값은?', a: '국내/해외 ETF 매도 시 배당소득세 또는 양도소득세를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: 'ETF 과세 계산기는 무료인가요?', a: '네, 카더라 ETF 과세 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: 'ETF 과세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>ETF 과세 계산기 완벽 가이드</h2><p>국내/해외 ETF 매도 시 배당소득세 또는 양도소득세를 계산. 카더라 ETF 과세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>금융/투자 세금 핵심 정보</h2><p>금융투자 수익 과세: 국내 상장주식은 대주주만 양도세, 해외주식은 250만원 초과 시 22%, ETF 배당은 15.4%, ISA 비과세 한도는 일반 200만원·서민 400만원입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 금융/투자 세금 계산이 필요한 분에게 유용합니다. 카더라는 금융/투자 세금 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['overseas-cgt', 'financial-income-tax', 'dividend-calc'] },

  { slug: 'isa-tax-free', emoji: '💎', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: 'ISA 비과세 한도 계산기', titleShort: 'ISA 비과세 계산기', description: 'ISA 계좌 비과세 한도(일반 200만/서민 400만)와 절세 효과를 계산.', keywords: ['ISA 비과세','ISA 한도','개인종합자산관리계좌','ISA 절세'], legalBasis: '조세특례제한법 제91조의18', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'isaTaxFree', resultLabel: '절세 금액', resultUnit: '원', inputs: [{ id: 'profit', label: 'ISA 수익', type: 'currency', default: 3000000 }, { id: 'type', label: 'ISA 유형', type: 'radio', default: 'general', options: [{ value: 'general', label: '일반형 (200만 비과세)' }, { value: 'lowIncome', label: '서민형 (400만 비과세)' }] }], faqs: [
      { q: 'ISA 비과세 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 조세특례제한법 제91조의18를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: 'ISA 비과세 계산기에서 가장 중요한 입력값은?', a: 'ISA 계좌 비과세 한도(일반 200만/서민 400만)와 절세 효과를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: 'ISA 비과세 계산기는 무료인가요?', a: '네, 카더라 ISA 비과세 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: 'ISA 비과세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>ISA 비과세 한도 계산기 완벽 가이드</h2><p>ISA 계좌 비과세 한도(일반 200만/서민 400만)와 절세 효과를 계산. 카더라 ISA 비과세 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>조세특례제한법 제91조의18</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>금융/투자 세금 핵심 정보</h2><p>금융투자 수익 과세: 국내 상장주식은 대주주만 양도세, 해외주식은 250만원 초과 시 22%, ETF 배당은 15.4%, ISA 비과세 한도는 일반 200만원·서민 400만원입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 금융/투자 세금 계산이 필요한 분에게 유용합니다. 카더라는 금융/투자 세금 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['irp-deduction', 'deposit-interest'] },

  // 법률/가정
  { slug: 'child-support', emoji: '👨‍👩‍👧', category: 'law', categoryLabel: '법률/가정', title: '양육비 계산기', titleShort: '양육비 계산기', description: '부모 월소득·자녀 나이·자녀 수로 월 양육비를 단순 추정. 산정기준표 금액을 그대로 옮긴 값은 아님.', keywords: ['양육비 계산기','양육비 산정','이혼 양육비','자녀 양육비'], legalBasis: '양육비 산정기준표 (대법원)', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'childSupport', resultLabel: '월 양육비', resultUnit: '원', inputs: [{ id: 'fatherIncome', label: '부 월소득', type: 'currency', default: 4000000 }, { id: 'motherIncome', label: '모 월소득', type: 'currency', default: 3000000 }, { id: 'childAge', label: '자녀 나이', type: 'number', default: 10, min: 0, max: 18 }, { id: 'childCount', label: '자녀수', type: 'stepper', default: 1, min: 1, max: 4 }], faqs: [
      { q: '양육비 계산기 결과는 정확한가요?', a: '단순화한 추정치입니다. 대법원 양육비 산정기준표의 금액을 그대로 쓰지 않고 소득 구간 기본액 × 나이 계수 × 자녀 수 × 소득 비율로 계산합니다. 정확한 금액은 기준표와 변호사 상담으로 확인하세요.' },
      { q: '양육비 계산기에서 가장 중요한 입력값은?', a: '부모 월소득·자녀 나이·자녀 수로 월 양육비를 단순 추정. 산정기준표 금액을 그대로 옮긴 값은 아님. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '양육비 계산기는 무료인가요?', a: '네, 카더라 양육비 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '양육비 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 법률/가정 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>양육비 계산기 완벽 가이드</h2><p>부모 월소득·자녀 나이·자녀 수로 월 양육비를 단순 추정. 산정기준표 금액을 그대로 옮긴 값은 아님.</p><p>본 계산기는 <strong>양육비 산정기준표 (대법원)</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>양육비 계산기 계산 방식</h2><p>부모 합산 월소득을 네 구간으로 나눈 기본액에 자녀 나이 계수와 자녀 수를 곱하고, 부(父)의 소득 비율만큼을 부담액으로 보여줍니다. 대법원 양육비 산정기준표를 단순화한 추정이며 기준표의 소득 구간·금액을 그대로 옮긴 값이 아닙니다. 실제 양육비는 기준표와 법원 판단으로 정해집니다.</p><h2>이런 분들에게 추천</h2><p>정확한 법률/가정 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: [] },

  { slug: 'accident-compensation', emoji: '🚑', category: 'law', categoryLabel: '법률/가정', title: '교통사고 합의금 추정기', titleShort: '교통사고 합의금', description: '치료비·위자료·휴업손해 등으로 교통사고 합의금을 추정.', keywords: ['교통사고 합의금','합의금 계산','위자료','휴업손해'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'accidentCompensation', resultLabel: '추정 합의금', resultUnit: '원', inputs: [{ id: 'treatmentCost', label: '치료비', type: 'currency', default: 3000000 }, { id: 'treatmentDays', label: '치료기간 (일)', type: 'number', default: 30, min: 1, max: 365 }, { id: 'dailyWage', label: '일 소득', type: 'currency', default: 150000 }, { id: 'disability', label: '장해 등급', type: 'select', default: '0', options: [{ value: '0', label: '장해 없음' }, { value: '14', label: '14급 (경미)' }, { value: '12', label: '12급' }, { value: '10', label: '10급' }, { value: '8', label: '8급' }, { value: '5', label: '5급' }, { value: '1', label: '1급 (중증)' }] }], faqs: [
      { q: '교통사고 합의금 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 전문가 상담을 권장합니다.' },
      { q: '교통사고 합의금에서 가장 중요한 입력값은?', a: '치료비·위자료·휴업손해 등으로 교통사고 합의금을 추정. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '교통사고 합의금는 무료인가요?', a: '네, 카더라 교통사고 합의금는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '교통사고 합의금는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 법률/가정 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>교통사고 합의금 추정기 완벽 가이드</h2><p>치료비·위자료·휴업손해 등으로 교통사고 합의금을 추정. 카더라 교통사고 합의금는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><h2>법률/가정 핵심 정보</h2><p>양육비는 산정기준표에 따라 양육자 소득·자녀 나이를 기준으로 결정됩니다. 위자료, 재산분할 비율은 혼인 기간, 유책 사유에 따라 달라집니다. 정확한 금액은 변호사 상담을 권장합니다.</p><h2>이런 분들에게 추천</h2><p>정확한 법률/가정 계산이 필요한 분에게 유용합니다. 카더라는 법률/가정 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: [] },

  // 추가 대출
  { slug: 'prepayment-fee', emoji: '💸', category: 'loan', categoryLabel: '대출/예적금', title: '중도상환수수료 계산기', titleShort: '중도상환수수료', description: '대출 중도상환 시 발생하는 수수료를 계산.', keywords: ['중도상환수수료','조기상환수수료','대출 상환'], legalBasis: '금융소비자보호법 제20조 · 금융소비자 보호에 관한 감독규정 제14조', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'prepaymentFee', resultLabel: '중도상환수수료', resultUnit: '원', inputs: [{ id: 'repayAmount', label: '상환 금액', type: 'currency', default: 100000000 }, { id: 'contract', label: '대출 계약 시기', type: 'select', default: 'y2026', options: [{ value: 'y2026', label: '2026년' }, { value: 'y2025', label: '2025-01-13 ~ 2025년 말' }, { value: 'pre2025', label: '2025-01-12 이전' }], hint: '요율은 계약일 기준으로 적용된다' }, { id: 'loanType', label: '대출 종류', type: 'radio', default: 'secured', options: [{ value: 'secured', label: '부동산 담보(주담대 등)' }, { value: 'otherSecured', label: '보증서·기타 담보(전세 등)' }, { value: 'credit', label: '신용' }] }, { id: 'rateType', label: '금리 방식', type: 'radio', default: 'fixed', options: [{ value: 'fixed', label: '고정' }, { value: 'variable', label: '변동' }] }, { id: 'rateMode', label: '요율', type: 'radio', default: 'representative', options: [{ value: 'representative', label: '5대 은행 대표값' }, { value: 'custom', label: '약정 요율 직접 입력' }] }, { id: 'feeRate', label: '약정 수수료율 (%)', type: 'percent', default: 0.65, min: 0, max: 3, step: 0.01, condition: 'rateMode=custom' }, { id: 'elapsedMonths', label: '대출 후 경과 기간 (개월)', type: 'number', default: 12, min: 0, max: 360 }, { id: 'loanMonths', label: '대출 기간 (개월)', type: 'number', default: 360, min: 1, max: 480 }, { id: 'feePeriodMonths', label: '수수료 적용기간 (개월)', type: 'number', default: 36, min: 1, max: 36, hint: '약정으로 정하되 법정 상한은 3년' }], faqs: [
      { q: '금리 방식(고정·변동)은 어떻게 쓰이나요?', a: '계약 시기·대출 종류와 함께 5대 은행 대표 수수료율 표에서 어느 칸을 쓸지 고르는 데 쓰입니다. 약정서의 수수료율이 정본이므로 알고 있다면 직접 입력하세요.' },
      { q: '중도상환수수료는 실제 청구액과 차이가 있나요?', a: '있을 수 있습니다. 대표 요율은 은행 공시에서 옮긴 값이고 약정서 요율이 정본입니다. 또 표준 산식은 일수 기준인데 이 계산기는 개월로 근사합니다.' },
      { q: '중도상환수수료는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>중도상환수수료 계산기 완벽 가이드</h2><p>대출 중도상환 시 발생하는 수수료를 계산.</p><h2>중도상환수수료 계산 방식</h2><p>중도상환수수료 = 상환 금액 × 수수료율 × 잔여기간 ÷ 분모 입니다. 분모는 대출기간과 수수료 적용기간 중 짧은 쪽이며, 적용기간은 법정 상한 3년(36개월)으로 자릅니다. 대출 후 3년이 지났으면 「부과 불가」로 표시합니다. 수수료율은 계약 시기·대출 종류·금리 방식별 5대 은행 대표값(중앙값)을 쓰거나 약정 요율을 직접 넣을 수 있습니다. 표준 산식은 일수 기준이지만 여기서는 개월로 근사합니다.</p><h2>이런 분들에게 추천</h2><p>대출을 일부·전액 갚기 전에 수수료를 미리 확인하려는 분, 대환을 고려하는 분에게 유용합니다.</p>', relatedCalcs: ['loan-repayment'] },


  // 추가 연금
  { slug: 'housing-pension', emoji: '🏡', category: 'pension', categoryLabel: '연금/은퇴', title: '주택연금 수령액 계산기', titleShort: '주택연금 계산기', seoTitle: '주택연금 계산기 — 나이·집값별 월 수령액', description: '주택가격·나이로 주택연금 예상 월 수령액을 한국주택금융공사 월지급금 예시표 기준으로 계산.', keywords: ['주택연금 계산기','주택연금 수령액','주택연금 월지급금','역모기지','노후 주거'], legalBasis: '한국주택금융공사 월지급금 예시(2026-03-01 적용)', version: '2026.09', lastUpdated: '2026-09-16', pattern: 'simple', formula: 'housingPension', resultLabel: '예상 월 수령액', resultUnit: '원', inputs: [{ id: 'housePrice', label: '주택 시가', type: 'currency', default: 500000000, hint: '표는 12억원까지 다룬다. 넘으면 상한에서 계산한다.' }, { id: 'age', label: '가입 나이', type: 'number', default: 65, min: 55, max: 90, hint: '부부 중 연소자 기준. 만 55세부터 가입 대상이다.' }], faqs: [
      { q: '주택연금 계산기 결과는 정확한가요?', a: '한국주택금융공사 월지급금 예시표를 주택가격·나이로 보간한 추정치입니다. 지급 방식·주택 유형에 따라 달라지므로 확정액은 공사 시뮬레이터에서 확인하세요.' },
      { q: '주택연금 계산기에서 가장 중요한 입력값은?', a: '주택가격·나이로 주택연금 예상 월 수령액을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '주택연금 계산기는 무료인가요?', a: '네, 카더라 주택연금 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '주택연금 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>주택연금 수령액 계산기 완벽 가이드</h2><p>주택가격·나이로 주택연금 예상 월 수령액을 계산.</p><p>본 계산기는 <strong>한국주택금융공사법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>주택연금 계산기 계산 방식</h2><p>주택가격과 가입 나이(부부 중 연소자)로 한국주택금융공사 월지급금 예시표를 보간해 예상 월 수령액을 구합니다. 표가 다루는 주택가격 상한을 넘으면 상한에서 계산하고, 가입 연령 미만이면 「가입 대상 아님」으로 표시합니다. 적용 시점과 조건은 결과 화면에 표시됩니다.</p><h2>이런 분들에게 추천</h2><p>정확한 연금/은퇴 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['national-pension', 'fire-calc'] },
  { slug: 'retirement-pension-sim', emoji: '📊', category: 'pension', categoryLabel: '연금/은퇴', title: '퇴직연금 수령 시뮬레이터', titleShort: '퇴직연금 시뮬', description: '퇴직연금을 연금으로 수령 시 vs 일시금 수령 시 세금 비교.', keywords: ['퇴직연금 수령','연금 vs 일시금','퇴직소득세','연금소득세'], legalBasis: '소득세법 제22조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'retirementPensionSim', resultLabel: '비교 결과', resultUnit: '', inputs: [{ id: 'totalAmount', label: '퇴직금 총액', type: 'currency', default: 200000000 }, { id: 'years', label: '근속연수', type: 'number', default: 20, min: 1, max: 40 }, { id: 'pensionYears', label: '연금 수령 기간 (년)', type: 'range', default: 10, min: 5, max: 30 }], faqs: [
      { q: '퇴직연금 시뮬 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 소득세법 제22조를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '퇴직연금 시뮬에서 가장 중요한 입력값은?', a: '퇴직연금을 연금으로 수령 시 vs 일시금 수령 시 세금 비교. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '퇴직연금 시뮬는 무료인가요?', a: '네, 카더라 퇴직연금 시뮬는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '퇴직연금 시뮬는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>퇴직연금 수령 시뮬레이터 완벽 가이드</h2><p>퇴직연금을 연금으로 수령 시 vs 일시금 수령 시 세금 비교. 카더라 퇴직연금 시뮬는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제22조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연금/은퇴 핵심 정보</h2><p>국민연금 수령액은 가입기간과 소득에 따라 달라집니다. 퇴직연금(DB/DC), 개인연금(IRP, 연금저축)을 합산하면 안정적인 노후 소득을 설계할 수 있습니다. FIRE 운동의 핵심은 저축률(50%+)과 투자 수익률입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 연금/은퇴 계산이 필요한 분에게 유용합니다. 카더라는 연금/은퇴 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['retirement-pay', 'irp-deduction', 'national-pension'] },


  // 생활 추가
  { slug: 'alcohol-calc', emoji: '🍺', category: 'life', categoryLabel: '생활/건강', title: '혈중알코올 농도 계산기', titleShort: '혈중알코올 계산기', description: '체중·음주량·시간으로 혈중알코올 농도(BAC)를 추정.', keywords: ['혈중알코올농도','음주운전','BAC','위드마크 공식'], legalBasis: 'Widmark 공식', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'alcoholCalc', resultLabel: '추정 혈중알코올', resultUnit: '%', inputs: [{ id: 'gender', label: '성별', type: 'radio', default: 'male', options: [{ value: 'male', label: '남성' }, { value: 'female', label: '여성' }] }, { id: 'weight', label: '체중 (kg)', type: 'number', default: 70, min: 30, max: 150 }, { id: 'drinks', label: '음주량 (잔)', type: 'number', default: 3, min: 1, max: 20, hint: '소주잔 기준' }, { id: 'drinkType', label: '주종', type: 'select', default: 'soju', options: [{ value: 'soju', label: '소주 (17%)' }, { value: 'beer', label: '맥주 (5%)' }, { value: 'wine', label: '와인 (13%)' }, { value: 'whiskey', label: '위스키 (40%)' }] }, { id: 'hours', label: '음주 후 경과시간', type: 'number', default: 2, min: 0, max: 24, step: 0.5 }], faqs: [
      { q: '혈중알코올 계산기 결과는 의학적으로 정확한가요?', a: '일반적인 공식 기반 참고 수치입니다. 정확한 건강 판단은 의료 전문가와 상담하세요.' },
      { q: '혈중알코올 계산기는 남녀 기준이 다른가요?', a: '대부분의 건강 지표는 성별에 따라 다른 기준을 적용합니다. 성별 선택 시 자동 반영됩니다.' },
      { q: '혈중알코올 계산기는 무료인가요?', a: '네, 카더라 혈중알코올 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '혈중알코올 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>혈중알코올 농도 계산기 완벽 가이드</h2><p>체중·음주량·시간으로 혈중알코올 농도(BAC)를 추정. 카더라 혈중알코올 계산기는 과학적 공식과 최신 기준을 반영합니다.</p><p>본 계산기는 <strong>Widmark 공식</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>건강·생활 핵심 정보</h2><p>BMI(18.5~22.9 정상), 체지방률, 기초대사량 등 건강 지표는 종합적으로 판단해야 합니다. 대한비만학회 기준은 WHO보다 엄격하여 BMI 23부터 과체중으로 분류합니다. 정확한 건강 평가는 의료 전문가와 상담하시기 바랍니다.</p><h2>이런 분들에게 추천</h2><p>체중 관리, 건강 관리를 계획 중인 분, 출산·육아를 준비하는 분, 일상의 궁금한 계산이 필요한 분에게 유용합니다. 정기적으로 계산하여 변화 추이를 기록하면 효과적입니다.</p>', relatedCalcs: [] },
  { slug: 'unit-convert', emoji: '🔄', category: 'life', categoryLabel: '생활/건강', title: '단위 환산기', titleShort: '단위 환산기', description: '길이(cm↔inch)·무게(kg↔lb)·온도(°C↔°F) 단위를 환산.', keywords: ['단위 환산기','cm inch','kg lb','면적 변환'], legalBasis: '계량법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'unitConvert', resultLabel: '변환 결과', resultUnit: '', inputs: [{ id: 'category', label: '단위 종류', type: 'select', default: 'length', options: [{ value: 'length', label: '길이 (cm↔inch)' }, { value: 'weight', label: '무게 (kg↔lb)' }, { value: 'temperature', label: '온도 (°C↔°F)' }] }, { id: 'value', label: '값', type: 'number', default: 170, step: 0.1 }, { id: 'direction', label: '방향', type: 'radio', default: 'aToB', options: [{ value: 'aToB', label: 'A → B' }, { value: 'bToA', label: 'B → A' }] }], faqs: [
      { q: '단위 환산기 결과는 정확한가요?', a: '표준 환산식을 그대로 적용한 값이며 소수 둘째 자리에서 반올림해 보여줍니다.' },
      { q: '단위 환산기는 무료인가요?', a: '네, 카더라 단위 환산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '단위 환산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>단위 환산기 완벽 가이드</h2><p>길이(cm↔inch)·무게(kg↔lb)·온도(°C↔°F) 단위를 환산.</p><p>본 계산기는 <strong>계량법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>단위 환산기 계산 방식</h2><p>길이는 1inch = 2.54cm, 무게는 1kg = 2.20462lb, 온도는 °F = °C × 9/5 + 32 환산식을 적용해 소수 둘째 자리까지 보여줍니다.</p><h2>이런 분들에게 추천</h2><p>해외 쇼핑·요리·여행에서 길이·무게·온도 단위를 바꿔 봐야 하는 분에게 유용합니다.</p>', relatedCalcs: ['pyeong-sqm'] },


  // 추가 자동차/보험
  { slug: 'lease-vs-installment', emoji: '🔀', category: 'auto', categoryLabel: '자동차', title: '리스 vs 할부 비교기', titleShort: '리스vs할부 비교', description: '자동차 리스와 할부의 총 비용을 비교.', keywords: ['리스 할부 비교','자동차 리스','장기렌트','할부 이자'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'leaseVsInstallment', resultLabel: '비교 결과', resultUnit: '', inputs: [{ id: 'carPrice', label: '차량 가격', type: 'currency', default: 40000000 }, { id: 'leaseMonthly', label: '리스 월 납입금', type: 'currency', default: 600000 }, { id: 'leaseMonths', label: '리스 기간 (개월)', type: 'number', default: 48 }, { id: 'leaseResidual', label: '잔존가치', type: 'currency', default: 16000000 }, { id: 'installRate', label: '할부 금리 (%)', type: 'percent', default: 5.9 }, { id: 'downPayment', label: '선수금', type: 'currency', default: 10000000 }], faqs: [
      { q: '리스vs할부 비교 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '리스vs할부 비교에서 가장 중요한 입력값은?', a: '자동차 리스와 할부의 총 비용을 비교. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '리스vs할부 비교는 무료인가요?', a: '네, 카더라 리스vs할부 비교는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '리스vs할부 비교는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>리스 vs 할부 비교기 완벽 가이드</h2><p>자동차 리스와 할부의 총 비용을 비교.</p><h2>리스vs할부 비교 계산 방식</h2><p>리스 총비용 = 리스 월 납입금 × 기간 + 잔존가치(만기 인수 가정). 할부 총비용 = 선수금 + 원리금균등 월 납입금 × 같은 기간(할부 원금 = 차량 가격 − 선수금). 두 값을 빼 더 적은 쪽을 유리하다고 표시합니다. 보험료·자동차세·리스 보증금·세제 효과는 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 자동차 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['car-installment', 'vehicle-tax'] },

  // 급여 추가
  { slug: 'overtime-pay', emoji: '🌙', category: 'salary', categoryLabel: '급여/노동', title: '야간/연장 수당 계산기', titleShort: '야간수당 계산기', description: '연장·야간·휴일 근무 수당을 통상임금 기준으로 계산.', keywords: ['야간수당 계산기','연장근로 수당','휴일수당','통상임금'], legalBasis: '근로기준법 제56조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'overtimePay', resultLabel: '추가 수당', resultUnit: '원', inputs: [{ id: 'hourlyWage', label: '시급 (통상임금)', type: 'currency', default: 15000 }, { id: 'overtimeHours', label: '연장근로 시간', type: 'number', default: 10, min: 0, max: 100 }, { id: 'nightHours', label: '야간근로 시간', type: 'number', default: 0, min: 0, max: 100 }, { id: 'holidayHours', label: '휴일근로 시간', type: 'number', default: 0, min: 0, max: 100 }], faqs: [
      { q: '야간수당 계산기에서 4대보험은 어떻게 적용되나요?', a: '적용하지 않습니다. 통상시급에 연장·야간·휴일 가산 배수를 곱한 세전 수당만 계산합니다.' },
      { q: '야간수당 계산기 결과가 실제와 다를 수 있나요?', a: '네. 휴일근로 8시간 초과분 가산, 연장과 야간이 겹치는 시간, 상시 5인 미만 사업장 여부에 따라 실제 수당이 달라집니다. 이 계산기는 입력한 시간에 배수만 곱합니다.' },
      { q: '야간수당 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>야간/연장 수당 계산기 완벽 가이드</h2><p>연장·야간·휴일 근무 수당을 통상임금 기준으로 계산.</p><p>본 계산기는 <strong>근로기준법 제56조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>야간수당 계산기 계산 방식</h2><p>연장수당 = 통상시급 × 연장근로 시간 × 1.5, 야간수당 = 통상시급 × 야간근로 시간 × 0.5(가산분), 휴일수당 = 통상시급 × 휴일근로 시간 × 1.5 로 계산해 더합니다. 휴일근로 8시간 초과분의 추가 가산은 반영하지 않으며, 세금·4대보험을 빼지 않은 세전 금액입니다.</p><h2>이런 분들에게 추천</h2><p>연봉 협상 중인 직장인, 첫 취업을 앞둔 구직자, 급여 명세서를 이해하고 싶은 분에게 유용합니다.</p>', relatedCalcs: ['hourly-annual', 'net-salary'] },

  { slug: 'annual-leave-pay', emoji: '🏖️', category: 'salary', categoryLabel: '급여/노동', title: '연차 수당 계산기', titleShort: '연차수당 계산기', description: '미사용 연차에 대한 연차수당을 통상임금 기준으로 계산.', keywords: ['연차수당 계산기','연차 미사용 수당','통상임금','유급휴가'], legalBasis: '근로기준법 제60조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'annualLeavePay', resultLabel: '연차수당', resultUnit: '원', inputs: [{ id: 'monthlySalary', label: '월 통상임금', type: 'currency', default: 3500000 }, { id: 'unusedDays', label: '미사용 연차 (일)', type: 'number', default: 5, min: 0, max: 25 }, { id: 'weeklyHours', label: '주당 근로시간', type: 'number', default: 40 }], faqs: [
      { q: '연차수당 계산기에서 4대보험은 어떻게 적용되나요?', a: '적용하지 않습니다. 1일 통상임금 × 미사용 연차 일수로 세전 연차수당만 계산합니다.' },
      { q: '연차수당 계산기 결과가 실제와 다를 수 있나요?', a: '네. 통상임금에 들어가는 수당 범위와 회사의 연차 사용 촉진 여부에 따라 실제 지급액이 달라집니다.' },
      { q: '연차수당 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>연차 수당 계산기 완벽 가이드</h2><p>미사용 연차에 대한 연차수당을 통상임금 기준으로 계산.</p><p>본 계산기는 <strong>근로기준법 제60조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연차수당 계산기 계산 방식</h2><p>1일 통상임금 = 월 통상임금 ÷ (주당 근로시간 × 52 ÷ 12) × (주당 근로시간 ÷ 5) 로 구하고, 여기에 미사용 연차 일수를 곱합니다. 세금·4대보험을 빼지 않은 세전 금액입니다.</p><h2>이런 분들에게 추천</h2><p>연봉 협상 중인 직장인, 첫 취업을 앞둔 구직자, 급여 명세서를 이해하고 싶은 분에게 유용합니다.</p>', relatedCalcs: ['net-salary', 'overtime-pay'] },

  // ════ 3차 배치: 부동산 추가 ════
  { slug: 'capital-gains-land', emoji: '🌾', category: 'property-tax', categoryLabel: '부동산 세금', title: '양도소득세 계산기 (토지)', titleShort: '토지 양도세 계산기', description: '토지 매도 시 양도소득세를 계산. 비사업용 토지 중과.', keywords: ['토지 양도소득세','비사업용 토지','토지 세금'], legalBasis: '소득세법 제104조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'capitalGainsLand', resultLabel: '양도소득세', resultUnit: '원', inputs: [{ id: 'sellPrice', label: '양도가액', type: 'currency', default: 300000000 }, { id: 'buyPrice', label: '취득가액', type: 'currency', default: 200000000 }, { id: 'expenses', label: '필요경비', type: 'currency', default: 5000000 }, { id: 'holdYears', label: '보유기간 (년)', type: 'number', default: 5 }, { id: 'nonBusiness', label: '비사업용 토지', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예 (+10% 중과)' }, { value: 'no', label: '아니오' }] }], faqs: [
      { q: '토지 양도세 계산기 결과는 실제 세금과 같나요?', a: '참고용이며, 감면·중과·특례 등에 따라 차이가 있습니다. 소득세법 제104조를 기준으로 계산합니다. 정확한 세액은 세무사 상담을 권장합니다.' },
      { q: '토지 양도세 계산기에서 조정대상지역은 반영되나요?', a: '아니요. 조정대상지역·주택 수 입력이 없습니다. 토지 양도차익에 장기보유특별공제·기본공제·기본세율(비사업용 토지는 가산 근사)만 적용합니다.' },
      { q: '토지 양도세 계산기는 모바일에서도 되나요?', a: '네, 모바일·태블릿·PC 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 공유 가능합니다.' },
    ], seoContent: '<h2>양도소득세 계산기 (토지) 완벽 가이드</h2><p>토지 매도 시 양도소득세를 계산. 비사업용 토지 중과.</p><p>본 계산기는 <strong>소득세법 제104조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>토지 양도세 계산기 계산 방식</h2><p>양도차익 = 양도가액 − 취득가액 − 필요경비. 보유기간별 장기보유특별공제율(3년 이상부터)을 적용하고 기본공제 250만원을 뺀 과세표준에 기본세율(8단계 누진)을 적용합니다. 비사업용 토지는 산출세액을 1.1배로 근사하므로 세율에 가산하는 법정 방식과 결과가 다를 수 있습니다. 지방소득세 10%를 더합니다. 단기 보유 세율·조정대상지역·감면은 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>토지 매도를 앞두고 양도소득세를 대략 가늠하려는 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공합니다.</p>', relatedCalcs: ['capital-gains-housing', 'acquisition-tax'] },

  { slug: 'multi-house-sim', emoji: '🏘️', category: 'property-tax', categoryLabel: '부동산 세금', title: '다주택자 중과세 시뮬레이터', titleShort: '다주택 중과 시뮬', description: '새로 사는 주택의 취득세(주택 수·조정 여부별 중과)와 파는 주택의 양도소득세(2026-05-10 이후 중과 재적용)를 거래별로 나눠 계산.', keywords: ['다주택자 세금','2주택 세금','3주택 중과','다주택 양도세','취득세 중과'], legalBasis: '지방세법 제11조, 제13조의2 · 소득세법 제95조, 제104조 · 시행령 제167조의3, 제167조의10', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'conditional', formula: 'multiHouseSim', resultLabel: '두 거래 세금', resultUnit: '원', inputs: [{ id: 'acqPrice', label: '① 새로 사는 주택 가격', type: 'currency', default: 800000000 }, { id: 'acqHouseCount', label: '① 취득 후 주택 수 (새 주택 포함)', type: 'stepper', default: 2, min: 1, max: 5 }, { id: 'acqRegulated', label: '① 새 주택이 조정대상지역', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] }, { id: 'sellPrice', label: '② 파는 주택 매도가', type: 'currency', default: 800000000 }, { id: 'sellBuyPrice', label: '② 파는 주택 취득가', type: 'currency', default: 500000000 }, { id: 'sellExpenses', label: '② 필요경비', type: 'currency', default: 0 }, { id: 'sellHoldYears', label: '② 보유기간 (년)', type: 'number', default: 3, min: 0, max: 30 }, { id: 'sellLiveYears', label: '② 거주기간 (년)', type: 'number', default: 0, min: 0, max: 30 }, { id: 'sellHouseCount', label: '② 양도 당시 주택 수 (파는 주택 포함)', type: 'stepper', default: 2, min: 1, max: 5 }, { id: 'sellRegulated', label: '② 파는 주택이 «양도 당시» 조정대상지역', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] }, { id: 'sellAcqRegulated', label: '② 파는 주택이 «취득 당시» 조정대상지역', type: 'radio', default: 'no', condition: 'sellHouseCount=1', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] }, { id: 'saleTiming', label: '양도 시기 (다주택 중과 유예)', type: 'radio', default: 'after', options: [{ value: 'after', label: '2026-05-10 이후 양도' }, { value: 'grace', label: '유예 적용분' }], hint: '유예 적용분 = 2026-05-09까지 양도했거나, 5-09까지 계약(토지거래허가 대상은 허가 신청)해 경과규정 기한 안에 양도한 경우(시행령 §167의10①12의2). 보유 2년 이상 주택만' }], faqs: [
      { q: '왜 취득과 양도를 따로 입력하나요?', a: '취득세는 «새로 사는» 주택 가격에, 양도세는 «파는» 주택의 차익에 붙습니다. 두 세금은 과세대상이 달라 한 가격으로 합칠 수 없습니다.' },
      { q: '취득세 중과 기준은?', a: '조정대상지역 2주택 8%·3주택 이상 12%, 비조정 3주택 8%·4주택 이상 12%(지방세법 §13조의2). 일시적 2주택은 중과 제외입니다. 여기서는 본세만 보여 주고 지방교육세·농어촌특별세는 취득세 계산기에서 봅니다.' },
      { q: '양도세 중과는 지금도 적용되나요?', a: '유예가 2026-05-09 양도분까지로 끝나 2026-05-10 이후 양도분부터 «양도 당시» 조정대상지역 2주택 +20%p·3주택 이상 +30%p, 장기보유특별공제 배제가 다시 적용됩니다(2026-09-17 원문 대조 기준).' },
      { q: '다주택 중과 시뮬는 모바일에서도 되나요?', a: '네, 모바일·태블릿·PC 모든 기기에서 앱 설치 없이 사용 가능합니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 공유 가능합니다.' },
    ], seoContent: '<h2>다주택자 중과세 시뮬레이터</h2><p>새로 사는 주택의 취득세와 파는 주택의 양도소득세를 거래별로 나눠 계산합니다. 취득세 세율은 취득세 계산기와 같은 정책 상수(지방세법 §11①8·§13조의2)를, 양도세는 주택 양도세 계산기와 같은 계산 함수(소득세법 §55·§95·§104⑦)를 씁니다.</p><h2>2026년 다주택 중과 (2026-09-17 원문 대조 기준)</h2><p>양도세 중과 유예는 2026-05-09 양도분까지로 종료됐습니다. 2026-05-10 이후 «양도 당시» 조정대상지역 주택을 팔면 2주택 +20%p, 3주택 이상 +30%p가 붙고 장기보유특별공제를 받지 못합니다. 보유 2년 미만이면 단기세율과 비교해 큰 세액을 씁니다.</p><p>중과 제외 주택(장기임대·저가주택 등)과 지방교육세·농어촌특별세는 반영하지 않습니다. 참고용입니다.</p>', relatedCalcs: ['acquisition-tax', 'capital-gains-housing'] },
  // ════ 투자 추가 ════
  { slug: 'investment-type-test', emoji: '🧪', category: 'investment', categoryLabel: '주식/투자', title: '투자 성향 진단기', titleShort: '투자 성향 진단', description: '3개 질문으로 안전형부터 적극투자형까지 투자 성향을 진단.', keywords: ['투자 성향 진단','투자 성향 테스트','위험 성향'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'diagnose', formula: 'investmentTypeTest', resultLabel: '투자 성향', resultUnit: '', inputs: [{ id: 'q1', label: '투자 경험', type: 'radio', default: '2', options: [{ value: '1', label: '없음' }, { value: '2', label: '1~3년' }, { value: '3', label: '3년 이상' }] }, { id: 'q2', label: '원금 손실 감내', type: 'radio', default: '2', options: [{ value: '1', label: '10% 이하' }, { value: '2', label: '20~30%' }, { value: '3', label: '50% 이상' }] }, { id: 'q3', label: '투자 기간', type: 'radio', default: '2', options: [{ value: '1', label: '1년 미만' }, { value: '2', label: '1~5년' }, { value: '3', label: '5년 이상' }] }], faqs: [
      { q: '투자 성향 진단은 어떻게 점수를 매기나요?', a: '투자 경험·원금 손실 감내·투자 기간 3문항 점수를 더해(9점 만점) 4단계 성향과 예시 자산배분을 보여줍니다. 세금·수익률 계산은 하지 않습니다.' },
      { q: '투자 성향 진단는 무료인가요?', a: '네, 카더라 투자 성향 진단는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '투자 성향 진단는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>투자 성향 진단기 완벽 가이드</h2><p>3개 질문으로 안전형부터 적극투자형까지 투자 성향을 진단.</p><h2>투자 성향 진단 계산 방식</h2><p>투자 경험·원금 손실 감내 수준·투자 기간 3문항의 점수를 더해(9점 만점) 안전형·안정추구형·위험중립형·적극투자형 중 하나로 분류하고, 성향별 예시 자산배분을 보여줍니다. 금융회사가 받는 공식 투자자 정보 확인서를 대신하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>투자를 시작하기 전에 내 위험 감내 수준을 간단히 점검하려는 분에게 유용합니다. 투자에는 원금 손실 위험이 있으며, 본 계산기는 참고용입니다.</p>', relatedCalcs: ['compound-interest', 'fire-calc'] },

  // ════ 급여 추가 ════
  { slug: 'daily-worker-tax', emoji: '👷', category: 'salary', categoryLabel: '급여/노동', title: '일용직 소득세 계산기', titleShort: '일용직 세금 계산기', description: '일용직 근로자의 일당에서 원천징수되는 세금을 계산.', keywords: ['일용직 세금','일용근로소득세','일당 세금','6%'], legalBasis: '소득세법 제129조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'dailyWorkerTax', resultLabel: '원천징수세액', resultUnit: '원', inputs: [{ id: 'dailyWage', label: '일당', type: 'currency', default: 200000 }], faqs: [
      { q: '일용직 세금 계산기에서 4대보험은 어떻게 적용되나요?', a: '국민연금 4.5%, 건강보험 3.545%, 장기요양 0.45%, 고용보험 0.9% — 합계 약 9.4%가 공제됩니다.' },
      { q: '비과세 급여란?', a: '식대(월 20만원), 자가운전보조금(월 20만원), 출산보육수당(월 20만원) 등 소득세 면제 항목입니다.' },
      { q: '일용직 세금 계산기 결과가 실제와 다를 수 있나요?', a: '부양가족 수, 비과세 항목, 보험 상한 등에 따라 차이가 발생합니다. 소득세법 제129조를 기준으로 계산합니다.' },
      { q: '일용직 세금 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>일용직 소득세 계산기 완벽 가이드</h2><p>일용직 근로자의 일당에서 원천징수되는 세금을 계산. 카더라 일용직 세금 계산기는 2026년 4대보험 요율과 근로소득 간이세액표를 반영합니다.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>급여 핵심 정보</h2><p>직장인 세전 급여에서 국민연금(4.5%), 건강보험(3.545%), 장기요양(0.45%), 고용보험(0.9%) 합계 약 9.4%가 공제됩니다. 여기에 근로소득세와 지방소득세가 추가됩니다. 비과세 급여(식대 20만원, 자가운전보조금 20만원)를 활용하면 실수령액을 높일 수 있습니다.</p><h2>이런 분들에게 추천</h2><p>연봉 협상 중인 직장인, 첫 취업을 앞둔 구직자, 급여 명세서를 이해하고 싶은 분에게 유용합니다. 연말정산 환급을 극대화하려면 체크카드 사용 비율을 높이고, IRP/연금저축에 최대 납입하세요.</p>', relatedCalcs: ['withholding-3-3', 'net-salary'] },
  { slug: 'freelancer-tax', emoji: '💻', category: 'salary', categoryLabel: '급여/노동', title: '프리랜서 세금 계산기', titleShort: '프리랜서 세금 계산기', description: '프리랜서 연 수입으로 예상 종합소득세와 환급액을 계산.', keywords: ['프리랜서 세금','종합소득세','경비율','5월 신고'], legalBasis: '소득세법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'freelancerTax', resultLabel: '예상 종합소득세', resultUnit: '원', inputs: [{ id: 'annualRevenue', label: '연 수입', type: 'currency', default: 50000000 }, { id: 'expenseType', label: '경비 유형', type: 'radio', default: 'simple', options: [{ value: 'simple', label: '단순경비율' }, { value: 'actual', label: '실제경비' }] }, { id: 'expenseRate', label: '경비율/경비액', type: 'percent', default: 64.1, hint: '현재는 경비율(%)로만 계산한다 — 실제 경비는 수입 대비 %로 환산해 넣는다' }, { id: 'withheld', label: '기납부 3.3% 합계', type: 'currency', default: 1650000 }], faqs: [
      { q: '프리랜서 세금 계산기에서 4대보험은 어떻게 적용되나요?', a: '적용하지 않습니다. 사업소득에 대한 종합소득세·지방소득세와 기납부 3.3%만 비교하며 지역가입자 보험료는 계산에 들어 있지 않습니다.' },
      { q: '프리랜서 세금 계산기 결과가 실제와 다를 수 있나요?', a: '네. 실제 신고에서는 인적공제·각종 소득공제·세액공제, 다른 소득과의 합산에 따라 세액이 달라집니다. 이 계산기는 공제를 500만원으로 근사합니다.' },
      { q: '프리랜서 세금 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>프리랜서 세금 계산기 완벽 가이드</h2><p>프리랜서 연 수입으로 예상 종합소득세와 환급액을 계산.</p><p>본 계산기는 <strong>소득세법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>프리랜서 세금 계산기 계산 방식</h2><p>소득금액 = 연 수입 × (1 − 경비율). 여기서 500만원을 공제 근사값으로 빼 과세표준을 만들고 소득세법 기본세율(8단계 누진)을 적용합니다. 지방소득세는 소득세의 10%입니다. 기납부 3.3% 합계에서 두 세금을 빼 양수면 환급, 음수면 추가 납부로 보여줍니다. 국민연금·건강보험 지역가입자 보험료는 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>연봉 협상 중인 직장인, 첫 취업을 앞둔 구직자, 급여 명세서를 이해하고 싶은 분에게 유용합니다.</p>', relatedCalcs: ['withholding-3-3', 'comprehensive-income-tax'] },

  // ════ 대출 추가 ════
  { slug: 'car-loan', emoji: '🚗', category: 'loan', categoryLabel: '대출/예적금', title: '자동차 대출 계산기', titleShort: '자동차 대출 계산기', description: '자동차 구매 대출의 월 상환액과 총 이자를 계산.', keywords: ['자동차 대출','차량 대출','할부금 계산'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'amortize', formula: 'carInstallment', resultLabel: '월 상환액', resultUnit: '원', inputs: [{ id: 'carPrice', label: '차량 가격', type: 'currency', default: 35000000 }, { id: 'downPayment', label: '선수금', type: 'currency', default: 7000000 }, { id: 'rate', label: '금리 (%)', type: 'percent', default: 5.5 }, { id: 'months', label: '기간 (개월)', type: 'select', default: '48', options: [{ value: '24', label: '24개월' }, { value: '36', label: '36개월' }, { value: '48', label: '48개월' }, { value: '60', label: '60개월' }] }], faqs: [
      { q: '상환 방식은 무엇으로 계산하나요?', a: '원리금균등 상환(매달 같은 금액)만 계산합니다. 원금균등·만기일시 방식과 비교하려면 대출 이자/상환 계산기를 쓰세요.' },
      { q: '자동차 대출 계산기는 실제 대출과 차이가 있나요?', a: '참고용이며, 은행별 우대금리·수수료 등에 따라 차이가 있습니다.' },
      { q: '자동차 대출 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>자동차 대출 계산기 완벽 가이드</h2><p>자동차 구매 대출의 월 상환액과 총 이자를 계산.</p><h2>자동차 대출 계산기 계산 방식</h2><p>대출 원금 = 차량 가격 − 선수금. 원리금균등 상환으로 «원금 × 월이율 × (1+월이율)^개월 ÷ ((1+월이율)^개월 − 1)» 을 계산해 월 납입금을 구하고, 총 납입액 − 원금을 총 이자로 보여줍니다. 월이율은 연 금리 ÷ 12 입니다. 취급수수료·보증료·보험료는 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>자동차 구매 대출의 월 부담과 총 이자를 금리·기간별로 비교하려는 분에게 유용합니다.</p>', relatedCalcs: ['loan-repayment', 'car-installment'] },
  { slug: 'student-loan', emoji: '🎓', category: 'loan', categoryLabel: '대출/예적금', title: '학자금 대출 상환 계산기', titleShort: '학자금 대출 계산기', description: '학자금 대출 원금·이자율·기간으로 원리금균등/원금균등 월 상환액과 총 이자를 계산.', keywords: ['학자금 대출','한국장학재단','등록금 대출','ICL'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'amortize', formula: 'loanRepayment', resultLabel: '월 상환액', resultUnit: '원', inputs: [{ id: 'principal', label: '대출 원금', type: 'currency', default: 20000000 }, { id: 'rate', label: '이자율 (%)', type: 'percent', default: 1.7 }, { id: 'years', label: '상환 기간 (년)', type: 'range', default: 10, min: 1, max: 20 }, { id: 'method', label: '상환 방식', type: 'radio', default: 'equal', options: [{ value: 'equal', label: '원리금균등' }, { value: 'principal', label: '원금균등' }] }, { id: 'grace', label: '거치기간 (개월)', type: 'number', default: 0, hint: '현재 계산에는 반영하지 않는다' }], faqs: [
      { q: '어떤 상환방식이 유리한가요?', a: '원금균등이 총 이자가 적지만 초기 부담이 큽니다. 원리금균등은 매월 동일 금액으로 예산 관리가 쉽습니다.' },
      { q: '학자금 대출 계산기는 실제 대출과 차이가 있나요?', a: '참고용이며, 은행별 우대금리·수수료 등에 따라 차이가 있습니다.' },
      { q: '학자금 대출 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>학자금 대출 상환 계산기 완벽 가이드</h2><p>학자금 대출 원금·이자율·기간으로 원리금균등/원금균등 월 상환액과 총 이자를 계산.</p><h2>학자금 대출 계산기 계산 방식</h2><p>원리금균등은 매달 같은 금액을, 원금균등은 첫 달 상환액(원금 ÷ 개월 + 원금 × 월이율)과 총 이자를 계산합니다. 월이율은 이자율 ÷ 12 입니다. 거치기간 입력과 취업 후 상환(소득 연동) 방식은 현재 계산에 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>학자금 대출 상환을 시작하기 전에 상환 방식별 월 부담과 총 이자를 비교하려는 분에게 유용합니다.</p>', relatedCalcs: ['loan-repayment'] },

  // ════ 쇼핑 추가 ════
  { slug: 'telecom-compare', emoji: '📱', category: 'shopping', categoryLabel: '쇼핑/소비', title: '통신비 비교 계산기', titleShort: '통신비 비교기', description: '알뜰폰 vs 일반 요금제 월/연 비용을 비교.', keywords: ['통신비 비교','알뜰폰','요금제 비교','핸드폰 요금'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'telecomCompare', resultLabel: '연간 절약액', resultUnit: '원', inputs: [{ id: 'currentPlan', label: '현재 월 요금', type: 'currency', default: 69000 }, { id: 'newPlan', label: '비교 요금제', type: 'currency', default: 33000 }], faqs: [
      { q: '통신비 비교기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '통신비 비교기에서 가장 중요한 입력값은?', a: '알뜰폰 vs 일반 요금제 월/연 비용을 비교. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '통신비 비교기는 무료인가요?', a: '네, 카더라 통신비 비교기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '통신비 비교기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>통신비 비교 계산기 완벽 가이드</h2><p>알뜰폰 vs 일반 요금제 월/연 비용을 비교.</p><h2>통신비 비교기 계산 방식</h2><p>월 절약액 = 현재 월 요금 − 비교 요금제, 연간 절약액 = 월 절약액 × 12, 2년 절약액 = 월 절약액 × 24 입니다. 단말기 할부금·약정 위약금은 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 쇼핑/소비 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['subscription-total'] },
  // ════ 군대/교육 추가 ════
  { slug: 'graduation-year', emoji: '🎓', category: 'military', categoryLabel: '군대/교육', title: '졸업/전역 연도 계산기', titleShort: '졸업 연도 계산기', description: '생년월일로 초중고·대학 졸업연도와 전역 예상연도를 계산.', keywords: ['졸업 연도','전역 연도','학교 졸업','입학 연도'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'graduationYear', resultLabel: '졸업/전역 연도', resultUnit: '', inputs: [{ id: 'birthYear', label: '출생연도', type: 'number', default: 2000, min: 1970, max: 2020 }, { id: 'birthMonth', label: '출생월', type: 'number', default: 6, min: 1, max: 12 }], faqs: [
      { q: '졸업 연도 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '졸업 연도 계산기에서 가장 중요한 입력값은?', a: '생년월일로 초중고·대학 졸업연도와 전역 예상연도를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '졸업 연도 계산기는 무료인가요?', a: '네, 카더라 졸업 연도 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '졸업 연도 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>졸업/전역 연도 계산기 완벽 가이드</h2><p>생년월일로 초중고·대학 졸업연도와 전역 예상연도를 계산.</p><h2>졸업 연도 계산기 계산 방식</h2><p>1~2월생은 출생연도 + 6년, 그 외는 + 7년에 초등학교에 입학한다고 보고 초등 6년·중 3년·고 3년·대학 4년을 더해 졸업 연도를 구합니다. 1~2월생 조기 입학 규칙은 출생연도와 관계없이 적용하므로, 이 규칙이 적용되지 않은 세대라면 1년을 더해 보세요. 재수·휴학·군 휴학은 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>동창·입학 연도를 따져 보거나 졸업 연도를 확인하려는 분에게 유용합니다. 본 계산기는 참고용입니다.</p>', relatedCalcs: ['discharge-date', 'age-calc'] },

  // ════ 상속/증여 추가 ════
  { slug: 'gift-exemption-lookup', emoji: '🔍', category: 'inheritance', categoryLabel: '상속/증여', title: '증여 면제한도 조회기', titleShort: '증여 면제한도 조회', description: '수증자 관계별 증여재산공제 한도(10년 합산)와 혼인·출산 증여재산공제를 조회.', keywords: ['증여 면제한도','증여 공제','가족 증여','10년 합산'], legalBasis: '상속세및증여세법 제53조·제53조의2', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'giftExemptionLookup', resultLabel: '면제한도', resultUnit: '원', inputs: [{ id: 'relationship', label: '누구로부터 받나', type: 'select', default: 'adultChild', options: [{ value: 'spouse', label: '배우자' }, { value: 'adultChild', label: '부모·조부모 (성년 수증자)' }, { value: 'minorChild', label: '부모·조부모 (미성년 수증자)' }, { value: 'descendant', label: '자녀·손자녀 (자녀 → 부모)' }, { value: 'otherRelative', label: '4촌 이내 혈족·3촌 이내 인척' }, { value: 'other', label: '그 밖의 사람' }] }, { id: 'marriageBirth', label: '혼인·출산 증여재산공제 대상', type: 'radio', default: 'no', options: [{ value: 'no', label: '아니오' }, { value: 'yes', label: '예' }], hint: '부모·조부모로부터 혼인신고일 전후 2년 또는 자녀 출생·입양일부터 2년 안의 증여' }], faqs: [
      { q: '증여 면제한도는 관계별로 얼마인가요?', a: '배우자 6억원, 부모·조부모로부터 성년 5천만원(미성년 2천만원), 자녀·손자녀로부터 5천만원, 4촌 이내 혈족·3촌 이내 인척 1천만원이며 수증자 기준 10년 합산 한도입니다(상속세및증여세법 제53조, 2026-01-01 시행 기준).' },
      { q: '혼인·출산 증여공제는 따로 받을 수 있나요?', a: '네. 부모·조부모로부터 혼인신고일 전후 2년 또는 자녀 출생·입양일부터 2년 안에 받은 증여는 위 공제와 별개로 1억원을 공제합니다. 혼인과 출산을 합쳐 1억원이 한도입니다(제53조의2, 2026-01-01 시행 기준).' },
      { q: '증여 면제한도 조회 결과는 정확한가요?', a: '공제 한도 조회용입니다. 10년 안에 이미 받은 공제가 있으면 남은 한도는 그만큼 줄어듭니다.' },
      { q: '증여 면제한도 조회는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 상속/증여 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>증여 면제한도 조회기 완벽 가이드</h2><p>증여세 과세가액에서 빼는 증여재산공제 한도를 증여자와의 관계별로 조회합니다. 부모·조부모로부터의 혼인·출산 증여공제는 별도 항목으로 보여 줍니다.</p><p>본 계산기는 <strong>상속세및증여세법 제53조·제53조의2</strong>를 기준으로 계산합니다(2026-01-01 시행 법령, 국가법령정보센터 원문 대조 2026-09-17). 규정은 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>상속·증여 핵심 정보</h2><p>상속세와 증여세는 같은 누진세율표(상속세 및 증여세법 제26조·제56조)를 쓰고, 기한 안에 신고하면 산출세액의 3%를 공제합니다(제69조, 2026-01-01 시행 기준). 증여재산공제는 수증자 기준 10년 합산 한도입니다. 계산기의 세율·공제액은 코드에 적지 않고 법령 상수표에서 받아 화면에 근거와 함께 표시합니다.</p><h2>이런 분들에게 추천</h2><p>자녀에게 재산을 이전하려는 부모, 상속 계획을 세우는 분, 부담부증여를 검토하는 분에게 유용합니다. 결과는 참고용이며 화면의 «미반영» 항목에 해당하면 실제 세액이 달라집니다.</p>', relatedCalcs: ['gift-tax', 'inheritance-tax'] },
  { slug: 'burden-gift', emoji: '📋', category: 'inheritance', categoryLabel: '상속/증여', title: '부담부증여 세금 계산기', titleShort: '부담부증여 계산기', description: '부담부증여 시 증여세(채무 제외분)와 양도소득세·지방소득세(인수채무분)를 함께 계산.', keywords: ['부담부증여','부담부증여 세금','증여 양도세'], legalBasis: '상속세및증여세법 제47조 · 소득세법 시행령 제159조', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'conditional', formula: 'burdenGift', resultLabel: '세금 합계', resultUnit: '원', inputs: [{ id: 'propertyValue', label: '증여 재산가액', type: 'currency', default: 500000000 }, { id: 'debt', label: '인수 채무 (대출 등)', type: 'currency', default: 200000000 }, { id: 'buyPrice', label: '증여자 취득가액', type: 'currency', default: 300000000 }, { id: 'holdYears', label: '증여자 보유기간 (년)', type: 'number', default: 10, min: 0, max: 50, hint: '3년 이상이면 장기보유특별공제' }, { id: 'cgtCase', label: '채무분 양도세', type: 'select', default: 'general', options: [{ value: 'general', label: '일반 과세 (기본세율)' }, { value: 'oneHouseExempt', label: '1세대1주택 비과세 대상' }] }, { id: 'relationship', label: '수증자 관계', type: 'select', default: 'adultChild', options: [{ value: 'spouse', label: '배우자' }, { value: 'adultChild', label: '성년 자녀' }, { value: 'minorChild', label: '미성년 자녀' }] }], faqs: [
      { q: '부담부증여에서 증여재산공제는 얼마인가요?', a: '배우자 6억원, 직계존속으로부터 성년 5천만원·미성년 2천만원이며 수증자 기준 10년 합산 한도입니다(상속세및증여세법 제53조, 2026-01-01 시행 기준).' },
      { q: '가족 간 부담부증여의 채무는 모두 인정되나요?', a: '배우자·직계존비속 간에는 채무가 인수되지 않은 것으로 추정합니다. 금융기관 대출처럼 객관적으로 입증되는 채무만 증여재산에서 빠집니다(제47조제3항).' },
      { q: '부담부증여 계산기 결과는 정확한가요?', a: '참고용입니다. 다주택 중과세율, 보유 2년 미만 단기세율, 12억원 초과 1세대1주택 안분은 반영하지 않습니다.' },
      { q: '부담부증여 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 상속/증여 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>부담부증여 세금 계산기 완벽 가이드</h2><p>증여재산에서 인수채무를 뺀 부분에는 증여세를, 채무 부분은 증여자가 양도한 것으로 보아 양도소득세와 지방소득세를 계산합니다. 채무분 양도차익은 (재산가액 − 취득가액) × 채무 ÷ 재산가액입니다.</p><p>본 계산기는 <strong>상속세및증여세법 제47조 · 소득세법 시행령 제159조</strong>를 기준으로 계산합니다(2026-01-01 시행 법령, 국가법령정보센터 원문 대조 2026-09-17). 규정은 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>상속·증여 핵심 정보</h2><p>상속세와 증여세는 같은 누진세율표(상속세 및 증여세법 제26조·제56조)를 쓰고, 기한 안에 신고하면 산출세액의 3%를 공제합니다(제69조, 2026-01-01 시행 기준). 증여재산공제는 수증자 기준 10년 합산 한도입니다. 계산기의 세율·공제액은 코드에 적지 않고 법령 상수표에서 받아 화면에 근거와 함께 표시합니다.</p><h2>이런 분들에게 추천</h2><p>자녀에게 재산을 이전하려는 부모, 상속 계획을 세우는 분, 부담부증여를 검토하는 분에게 유용합니다. 결과는 참고용이며 화면의 «미반영» 항목에 해당하면 실제 세액이 달라집니다.</p>', relatedCalcs: ['gift-tax', 'capital-gains-housing'] },


  // ════ 4차 최종 배치 (43종) ════
  // 부동산세 +4
  { slug: 'capital-gains-rights', emoji: '📝', category: 'property-tax', categoryLabel: '부동산 세금', title: '양도소득세 계산기 (분양권)', titleShort: '분양권 양도세', description: '분양권 전매 시 양도소득세를 계산. 보유기간과 무관하게 최저 60%, 1년 미만 70%.', keywords: ['분양권 양도세','분양권 전매','단기양도'], legalBasis: '소득세법 제103조, 제104조제1항 · 지방세법 제103조의3', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'capitalGainsRights', resultLabel: '양도소득세 (지방소득세 포함)', resultUnit: '원', inputs: [{ id: 'sellPrice', label: '양도가액', type: 'currency', default: 500000000 }, { id: 'buyPrice', label: '취득가액 (분양가+프리미엄)', type: 'currency', default: 400000000 }, { id: 'expenses', label: '필요경비 (중개보수 등)', type: 'currency', default: 0 }, { id: 'holdYears', label: '보유기간 (년)', type: 'number', default: 1, min: 0, max: 10 }], faqs: [
      { q: '분양권 양도세율은?', a: '1년 미만 70%, 1년 이상은 보유기간과 무관하게 60%입니다(소득세법 §104①1 괄호·①2·①3). 지방소득세는 소득세의 1/10 구조로 따로 붙습니다(2026-09-17 원문 대조 기준).' },
      { q: '조정대상지역이면 세율이 달라지나요?', a: '분양권 자체의 세율은 조정대상지역과 무관합니다. 다만 분양권을 가진 채 주택을 팔면 그 주택의 비과세·중과 판정이 달라질 수 있으며, 이 계산기는 그 판정을 하지 않습니다.' },
      { q: '장기보유특별공제는?', a: '분양권은 장기보유특별공제 대상 자산이 아닙니다(소득세법 §95②).' },
      { q: '분양권 양도세는 모바일에서도 되나요?', a: '네, 모바일·태블릿·PC 모든 기기에서 앱 설치 없이 사용 가능합니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 공유 가능합니다.' },
    ], seoContent: '<h2>분양권 양도소득세 계산기</h2><p>분양권 전매 차익(양도가액 − 취득가액 − 필요경비)에서 기본공제를 뺀 과세표준에 세율을 곱합니다. 분양권은 보유기간과 무관하게 최저 60%, 1년 미만 70%입니다(소득세법 §104①). 지방소득세는 소득세 세율의 1/10 구조입니다(지방세법 §103의3①).</p><p>2026-09-17 원문 대조 기준. 참고용이며 정확한 세액은 세무 전문가 확인을 권장합니다.</p>', relatedCalcs: ['capital-gains-housing'] },
  { slug: 'registration-license-tax', emoji: '📜', category: 'property-tax', categoryLabel: '부동산 세금', title: '등록면허세 계산기', titleShort: '등록면허세 계산기', description: '근저당·전세권 설정, 가압류·가처분 등기의 등록면허세와 지방교육세를 계산. 취득세를 내는 소유권이전은 0원.', keywords: ['등록면허세','근저당 설정 등록면허세','전세권 설정','등록세'], legalBasis: '지방세법 제23조·제28조·제151조', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'registrationLicenseTax', resultLabel: '등록면허세 합계', resultUnit: '원', inputs: [{ id: 'type', label: '등기 유형', type: 'radio', default: 'mortgage', options: [{ value: 'mortgage', label: '저당권(근저당) 설정' }, { value: 'jeonse', label: '전세권 설정' }, { value: 'seizure', label: '경매신청·가압류·가처분·가등기' }, { value: 'other', label: '그 밖의 등기 (건당)' }, { value: 'transfer', label: '매매·증여·상속 소유권이전' }] }, { id: 'price', label: '채권금액 · 전세금액', type: 'currency', default: 300000000, hint: '근저당은 설정 채권최고액, 전세권은 전세금을 넣는다.' }], faqs: [
      { q: '매매로 소유권이전등기를 하면 등록면허세를 내나요?', a: '내지 않는다. 취득세가 과세되는 취득을 원인으로 한 등기는 등록면허세 대상에서 제외된다(지방세법 §23 1호). 취득세 계산기를 쓴다.' },
      { q: '근저당 설정 등록면허세는?', a: '채권금액의 0.2%이고 산출세액이 6천원보다 적으면 6천원이다. 지방교육세로 등록면허세의 20%가 더해진다(지방세법 2026-07-01 시행본, 2026-09-17 원문 대조).' },
      { q: '지역마다 다른가요?', a: '지자체 조례로 표준세율의 50% 범위에서 가감할 수 있다. 대도시 법인 등기 중과는 이 계산기에 없다.' },
    ], seoContent: '<h2>등록면허세 계산기</h2><p>재산권 등의 설정·변경을 등기할 때 내는 등록면허세와 지방교육세를 계산한다. 세율은 국가법령정보센터 현행 원문과 대조한 정책 상수표에서 받아 쓴다.</p><h2>대상</h2><p>근저당권·전세권 설정(0.2%), 경매신청·가압류·가처분·가등기(0.2%), 그 밖의 등기(건당 6천원). 매매·증여·상속·신축처럼 취득세를 내는 소유권 등기는 대상이 아니다.</p><h2>반영하지 않는 것</h2><p>조례 세율 가감, 대도시 법인 중과, 부과제척기간 경과 등 예외적 소유권 등기 과세는 들어 있지 않다.</p>', relatedCalcs: ['registration-cost', 'acquisition-tax'] },
  { slug: 'deemed-rent', emoji: '🏠', category: 'property-tax', categoryLabel: '부동산 세금', title: '간주임대료 계산기', titleShort: '간주임대료 계산기', description: '전세보증금에 대한 간주임대료(이자 상당액)를 계산.', keywords: ['간주임대료','전세 간주임대','보증금 이자'], legalBasis: '소득세법 제25조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'deemedRent', resultLabel: '간주임대료', resultUnit: '원', inputs: [{ id: 'deposit', label: '보증금 합계', type: 'currency', default: 500000000 }, { id: 'threshold', label: '3억 초과분 기준', type: 'currency', default: 300000000 }], faqs: [
      { q: '간주임대료 계산기 결과는 실제 세금과 같나요?', a: '참고용이며, 감면·중과·특례 등에 따라 차이가 있습니다. 소득세법 제25조를 기준으로 계산합니다. 정확한 세액은 세무사 상담을 권장합니다.' },
      { q: '간주임대료 계산기에서 조정대상지역은 반영되나요?', a: '네, 조정대상지역 여부에 따른 세율 차이를 반영합니다. 최신 규제지역은 국토교통부에서 확인하세요.' },
      { q: '부동산 세금 절세 방법은?', a: '1세대1주택 비과세, 장기보유특별공제, 생애최초 감면 등을 활용하세요.' },
      { q: '간주임대료 계산기는 모바일에서도 되나요?', a: '네, 모바일·태블릿·PC 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 공유 가능합니다.' },
    ], seoContent: '<h2>간주임대료 계산기 완벽 가이드</h2><p>전세보증금에 대한 간주임대료(이자 상당액)를 계산. 카더라 간주임대료 계산기는 2026년 최신 세법을 반영하여 조정대상지역, 주택 수, 면적, 취득 원인에 따른 세율을 자동 적용합니다.</p><p>본 계산기는 <strong>소득세법 제25조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 세금 핵심 포인트</h2><p>부동산 거래 시 취득세(1~12%), 양도소득세(6~45%+중과), 재산세, 종합부동산세 등 다양한 세금이 부과됩니다. 1세대1주택 비과세(12억까지), 장기보유특별공제(최대 80%), 생애최초 감면(200만원 한도) 등 절세 제도를 적극 활용하세요.</p><h2>이런 분들에게 추천</h2><p>주택 매매·매도를 계획 중인 분, 다주택 중과세 영향을 파악하고 싶은 분, 부동산 투자 수익률을 계산하고 싶은 분에게 유용합니다. 카더라는 부동산 세금 포함 142종의 무료 계산기를 제공합니다.</p>', relatedCalcs: ['rental-income-tax'] },
  { slug: 'one-house-check', emoji: '✅', category: 'property-tax', categoryLabel: '부동산 세금', title: '1세대1주택 비과세 판정기', titleShort: '1세대1주택 판정', description: '보유·거주 요건(취득 당시 조정대상지역), 12억원 기준, 일시적 2주택 특례로 1세대1주택 비과세 해당 여부를 판정.', keywords: ['1세대1주택 비과세','비과세 요건','보유기간','거주기간','일시적 2주택'], legalBasis: '소득세법 제89조제1항제3호 · 시행령 제154조, 제155조제1항, 제160조', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'diagnose', formula: 'oneHouseCheck', resultLabel: '비과세 판정', resultUnit: '', inputs: [{ id: 'houseCount', label: '보유 주택수 (양도 당시)', type: 'stepper', default: 1, min: 1, max: 5 }, { id: 'newAfter1y', label: '종전 주택 취득 후 1년 이상 지나 새 주택을 샀나요?', type: 'radio', default: 'no', condition: 'houseCount=2', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] }, { id: 'within3y', label: '새 주택 취득일부터 3년 이내에 종전 주택을 파나요?', type: 'radio', default: 'no', condition: 'houseCount=2', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }] }, { id: 'holdYears', label: '파는 주택 보유기간 (년)', type: 'number', default: 3 }, { id: 'liveYears', label: '파는 주택 거주기간 (년)', type: 'number', default: 2 }, { id: 'sellPrice', label: '양도가액', type: 'currency', default: 900000000 }, { id: 'acqRegulated', label: '«취득 당시» 조정대상지역', type: 'radio', default: 'no', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], hint: '양도 당시가 아니라 취득 당시 기준 — 조정대상지역에서 취득했을 때만 거주 2년 필요(시행령 §154①)' }], faqs: [
      { q: '비과세 요건은?', a: '양도일 현재 1주택, 보유 2년 이상, «취득 당시» 조정대상지역이면 거주 2년 이상. 양도가액 12억원 이하 전액 비과세, 초과하면 초과분 비율만큼 과세(소득세법 §89①3, 시행령 §154①, 2026-09-17 원문 대조 기준).' },
      { q: '2주택인데 비과세가 되나요?', a: '종전 주택 취득 후 1년 이상 지나 새 주택을 사고, 새 주택 취득일부터 3년 이내에 종전 주택을 팔면 일시적 2주택으로 1주택처럼 판정합니다(시행령 §155①).' },
      { q: '이 판정기가 보지 않는 것은?', a: '상속·동거봉양·혼인 합가 특례, 임대주택·수용·해외이주 등 보유기간 예외, 조합원입주권·분양권 보유 시 판정은 하지 않습니다. 해당하면 세무 전문가 확인이 필요합니다.' },
      { q: '1세대1주택 판정는 모바일에서도 되나요?', a: '네, 모바일·태블릿·PC 모든 기기에서 앱 설치 없이 사용 가능합니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 공유 가능합니다.' },
    ], seoContent: '<h2>1세대1주택 비과세 판정기</h2><p>양도일 현재 1주택을 보유하고 2년 이상 보유했는지, «취득 당시» 조정대상지역 주택이면 보유기간 중 2년 이상 거주했는지, 양도가액이 12억원 이하인지로 비과세 여부를 판정합니다(소득세법 §89①3, 시행령 §154①). 일시적 2주택(시행령 §155①)도 판정합니다.</p><p>상속·동거봉양·혼인 특례와 보유기간 예외는 판정하지 않습니다. 2026-09-17 원문 대조 기준.</p>', relatedCalcs: ['capital-gains-housing'] },

  // 소득세 +3
  { slug: 'business-income-tax', emoji: '🏪', category: 'income-tax', categoryLabel: '소득세', title: '사업소득세 계산기', titleShort: '사업소득세 계산기', description: '총수입금액에서 필요경비를 뺀 사업소득에 근사 공제 후 기본세율로 소득세를 계산.', keywords: ['사업소득세','사업자 소득세','경비율'], legalBasis: '소득세법 제19조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'tax-bracket', formula: 'businessIncomeTax', resultLabel: '사업소득세', resultUnit: '원', inputs: [{ id: 'revenue', label: '총 수입금액', type: 'currency', default: 100000000 }, { id: 'expenses', label: '필요경비', type: 'currency', default: 60000000 }], faqs: [
      { q: '사업소득세 계산기에 적용되는 세율은?', a: '소득세법 기본세율(8단계 누진)을 적용합니다. 과세표준은 «총수입 − 필요경비 − 500만원(공제 근사값)» 이며 지방소득세 10%를 더해 보여줍니다.' },
      { q: '사업소득세 계산기 신고 기한은?', a: '근로소득은 연말정산(2월), 종합소득세는 5월, 양도소득은 양도 후 2개월입니다.' },
      { q: '사업소득세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>사업소득세 계산기 완벽 가이드</h2><p>총수입금액에서 필요경비를 뺀 사업소득에 근사 공제 후 기본세율로 소득세를 계산.</p><p>본 계산기는 <strong>소득세법 제19조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>사업소득세 계산기 계산 방식</h2><p>사업소득 = 총 수입금액 − 필요경비. 과세표준 = 사업소득 − 500만원(공제 근사값). 소득세법 기본세율(8단계 누진)을 적용한 소득세에 지방소득세 10%를 더한 금액을 보여줍니다. 실제 인적공제·세액공제·기납부세액은 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 프리랜서, 사업자 등 소득세 신고를 준비하는 모든 분에게 유용합니다.</p>', relatedCalcs: ['comprehensive-income-tax'] },
  { slug: 'pension-income-tax', emoji: '🏛️', category: 'income-tax', categoryLabel: '소득세', title: '연금소득세 계산기', titleShort: '연금소득세 계산기', description: '공적/사적연금 수령 시 연금소득세를 계산.', keywords: ['연금소득세','연금 세금','연금수령 세율'], legalBasis: '소득세법 제129조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'pensionIncomeTax', resultLabel: '연금소득세', resultUnit: '원', inputs: [{ id: 'annualPension', label: '연간 연금수령액', type: 'currency', default: 12000000 }, { id: 'age', label: '수령 나이', type: 'number', default: 65, min: 55, max: 90 }, { id: 'type', label: '연금 유형', type: 'radio', default: 'private', options: [{ value: 'public', label: '공적연금 (국민연금)' }, { value: 'private', label: '사적연금 (IRP/연금저축)' }] }], faqs: [
      { q: '연금소득세 계산기에 적용되는 세율은?', a: '과세표준에 따라 6~45% 8단계 누진세율이 적용됩니다. 소득세법 제129조를 기준으로 계산합니다.' },
      { q: '소득공제와 세액공제의 차이는?', a: '소득공제는 과세표준을 줄이고, 세액공제는 산출세액에서 직접 차감합니다.' },
      { q: '연금소득세 계산기 신고 기한은?', a: '근로소득은 연말정산(2월), 종합소득세는 5월, 양도소득은 양도 후 2개월입니다.' },
      { q: '연금소득세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>연금소득세 계산기 완벽 가이드</h2><p>공적/사적연금 수령 시 연금소득세를 계산. 카더라 연금소득세 계산기는 2026년 소득세법 기준 8단계 누진세율(6~45%)을 반영합니다.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>소득세 핵심 정보</h2><p>과세표준에 따라 1,400만원 이하 6%, 5,000만원 이하 15%, 8,800만원 이하 24%, 1.5억 이하 35%, 3억 이하 38%, 5억 이하 40%, 10억 이하 42%, 10억 초과 45%가 적용됩니다. 소득공제로 과세표준을 줄이고, 세액공제로 산출세액을 직접 차감하여 절세하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 프리랜서, 사업자 등 소득세 신고를 준비하는 모든 분에게 유용합니다. 연금저축/IRP 세액공제(최대 900만원 납입)를 활용하면 효과적으로 절세할 수 있습니다.</p>', relatedCalcs: ['national-pension', 'irp-deduction'] },

  { slug: 'dividend-income-tax', emoji: '💰', category: 'income-tax', categoryLabel: '소득세', title: '배당소득세 계산기', titleShort: '배당소득세 계산기', description: '국내/해외 배당소득에 대한 원천징수세액을 계산.', keywords: ['배당소득세','배당세금','국내배당','해외배당'], legalBasis: '소득세법 제129조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'dividendIncomeTax', resultLabel: '배당소득세', resultUnit: '원', inputs: [{ id: 'dividend', label: '배당금', type: 'currency', default: 5000000 }, { id: 'market', label: '시장', type: 'radio', default: 'kr', options: [{ value: 'kr', label: '국내 (15.4%)' }, { value: 'us', label: '미국 (15%)' }] }], faqs: [
      { q: '배당소득세 계산기에 적용되는 세율은?', a: '과세표준에 따라 6~45% 8단계 누진세율이 적용됩니다. 소득세법 제129조를 기준으로 계산합니다.' },
      { q: '소득공제와 세액공제의 차이는?', a: '소득공제는 과세표준을 줄이고, 세액공제는 산출세액에서 직접 차감합니다.' },
      { q: '배당소득세 계산기 신고 기한은?', a: '근로소득은 연말정산(2월), 종합소득세는 5월, 양도소득은 양도 후 2개월입니다.' },
      { q: '배당소득세 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 소득세 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>배당소득세 계산기 완벽 가이드</h2><p>국내/해외 배당소득에 대한 원천징수세액을 계산. 카더라 배당소득세 계산기는 2026년 소득세법 기준 8단계 누진세율(6~45%)을 반영합니다.</p><p>본 계산기는 <strong>소득세법 제129조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>소득세 핵심 정보</h2><p>과세표준에 따라 1,400만원 이하 6%, 5,000만원 이하 15%, 8,800만원 이하 24%, 1.5억 이하 35%, 3억 이하 38%, 5억 이하 40%, 10억 이하 42%, 10억 초과 45%가 적용됩니다. 소득공제로 과세표준을 줄이고, 세액공제로 산출세액을 직접 차감하여 절세하세요.</p><h2>이런 분들에게 추천</h2><p>근로소득자, 프리랜서, 사업자 등 소득세 신고를 준비하는 모든 분에게 유용합니다. 연금저축/IRP 세액공제(최대 900만원 납입)를 활용하면 효과적으로 절세할 수 있습니다.</p>', relatedCalcs: ['dividend-calc', 'financial-income-tax'] },
  // 금융세 +3
  { slug: 'major-shareholder-cgt', emoji: '📊', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: '대주주 양도세 계산기', titleShort: '대주주 양도세', description: '국내 상장·비상장 주식 대주주의 양도소득세를 계산. 과세표준 3억원 구간 20/25%, 1년 미만 비중소기업 30%, 지방소득세 별도.', keywords: ['대주주 양도세','국내주식 양도세','대주주 기준'], legalBasis: '소득세법 제94조제1항제3호, 제103조제1항제2호, 제104조제1항제11호 · 시행령 제157조, 제167조의8 · 지방세법 제103조의3', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'majorShareholderCgt', resultLabel: '양도소득세 (지방소득세 포함)', resultUnit: '원', inputs: [{ id: 'profit', label: '양도차익 (양도가−취득가−필요경비)', type: 'currency', default: 50000000 }, { id: 'holdPeriod', label: '보유기간', type: 'radio', default: 'long', options: [{ value: 'short', label: '1년 미만' }, { value: 'long', label: '1년 이상' }] }, { id: 'sme', label: '중소기업 주식', type: 'radio', default: 'no', condition: 'holdPeriod=short', options: [{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }], hint: '1년 미만이어도 중소기업 주식이면 30% 단기세율이 아니다' }, { id: 'deductionUsed', label: '올해 기본공제(250만원)를 다른 주식 양도에서 이미 썼나요?', type: 'radio', default: 'no', options: [{ value: 'no', label: '아니오' }, { value: 'yes', label: '이미 사용' }], hint: '해외주식 등과 합산해 연 1회' }], faqs: [
      { q: '대주주 양도세율은?', a: '과세표준 3억원 이하 20%, 초과분 25%(6천만원 + 초과액×25%). 1년 미만 보유한 중소기업 외 법인 주식은 30%입니다(소득세법 §104①11가). 지방소득세는 소득세의 1/10 구조로 별도입니다(2026-09-17 원문 대조 기준).' },
      { q: '대주주 기준은?', a: '직전 사업연도 말 지분율 코스피 1%·코스닥 2%·코넥스 4% 이상이거나 종목별 시가총액 50억원 이상(특수관계인 합산 단서 있음, 소득세법 시행령 §157①·②). 비상장은 4% 또는 10억원(벤처 40억원, §167조의8). 2026-09-17 원문 대조 기준.' },
      { q: '3억원 구간은 양도차익 기준인가요?', a: '아니요. 기본공제를 뺀 «과세표준» 기준입니다.' },
      { q: '대주주 양도세는 모바일에서도 되나요?', a: '네, 모바일·태블릿·PC 모든 기기에서 앱 설치 없이 사용 가능합니다.' },
      { q: '결과를 공유할 수 있나요?', a: '계산 완료 후 공유 버튼으로 카카오톡, URL 복사 등으로 공유 가능합니다.' },
    ], seoContent: '<h2>대주주 양도세 계산기</h2><p>국내 주식 대주주가 주식을 양도할 때 양도차익에서 기본공제를 뺀 과세표준에 3억원 이하 20%, 초과분 25%를 적용합니다. 1년 미만 보유한 중소기업 외 법인 주식은 30%입니다(소득세법 §104①11가). 지방소득세는 같은 구조의 1/10(지방세법 §103의3①11)입니다.</p><p>대주주 판정(시행령 §157·§167조의8) 자체와 차손 통산은 계산하지 않습니다. 2026-09-17 원문 대조 기준.</p>', relatedCalcs: ['overseas-cgt', 'stock-roi'] },

  { slug: 'foreign-dividend-credit', emoji: '🌍', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: '해외 배당 이중과세 환급 계산기', titleShort: '외국납부세액공제', description: '해외주식 배당에서 원천징수된 외국세액의 공제(환급)를 계산.', keywords: ['외국납부세액공제','해외배당 이중과세','배당세 환급'], legalBasis: '소득세법 제57조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'foreignDividendCredit', resultLabel: '환급 가능액', resultUnit: '원', inputs: [{ id: 'foreignTax', label: '외국 원천징수세액', type: 'currency', default: 750000 }, { id: 'domesticTax', label: '국내 산출세액', type: 'currency', default: 770000 }], faqs: [
      { q: '외국납부세액공제 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '외국납부세액공제에서 가장 중요한 입력값은?', a: '해외주식 배당에서 원천징수된 외국세액의 공제(환급)를 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '외국납부세액공제는 무료인가요?', a: '네, 카더라 외국납부세액공제는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '외국납부세액공제는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>해외 배당 이중과세 환급 계산기 완벽 가이드</h2><p>해외주식 배당에서 원천징수된 외국세액의 공제(환급)를 계산.</p><p>본 계산기는 <strong>소득세법 제57조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>외국납부세액공제 계산 방식</h2><p>외국납부세액공제 = 외국 원천징수세액과 국내 산출세액 중 작은 금액 입니다. 법정 한도는 산출세액 중 국외원천소득이 차지하는 비율만큼이지만, 이 계산기는 입력한 국내 산출세액 전체를 한도로 봅니다.</p><h2>이런 분들에게 추천</h2><p>정확한 금융/투자 세금 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['dividend-calc', 'overseas-cgt'] },
  { slug: 'fis-tax-sim', emoji: '📈', category: 'finance-tax', categoryLabel: '금융/투자 세금', title: '금융투자소득세 시뮬레이터', titleShort: '금투세 시뮬레이터', description: '금융투자소득세 시행 시 국내주식 과세 예상액을 시뮬레이션.', keywords: ['금융투자소득세','금투세','국내주식 과세'], legalBasis: '소득세법 제87조의2 (시행 미정)', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'fisTaxSim', resultLabel: '금투세 (시뮬)', resultUnit: '원', inputs: [{ id: 'profit', label: '연간 국내주식 수익', type: 'currency', default: 80000000 }], faqs: [
      { q: '금투세 시뮬레이터 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 소득세법 제87조의2 (시행 미정)를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '금투세 시뮬레이터에서 가장 중요한 입력값은?', a: '금융투자소득세 시행 시 국내주식 과세 예상액을 시뮬레이션. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '금투세 시뮬레이터는 무료인가요?', a: '네, 카더라 금투세 시뮬레이터는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '금투세 시뮬레이터는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 금융/투자 세금 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>금융투자소득세 시뮬레이터 완벽 가이드</h2><p>금융투자소득세 시행 시 국내주식 과세 예상액을 시뮬레이션. 카더라 금투세 시뮬레이터는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제87조의2 (시행 미정)</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>금융/투자 세금 핵심 정보</h2><p>금융투자 수익 과세: 국내 상장주식은 대주주만 양도세, 해외주식은 250만원 초과 시 22%, ETF 배당은 15.4%, ISA 비과세 한도는 일반 200만원·서민 400만원입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 금융/투자 세금 계산이 필요한 분에게 유용합니다. 카더라는 금융/투자 세금 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['overseas-cgt', 'stock-roi'] },

  // 상속/증여 +2
  { slug: 'family-business', emoji: '🏭', category: 'inheritance', categoryLabel: '상속/증여', title: '가업승계 세금 계산기', titleShort: '가업승계 계산기', description: '가업상속공제(피상속인 경영기간별 한도)를 적용하기 전과 후의 상속세를 비교해 절감액을 계산.', keywords: ['가업승계','가업상속공제','중소기업 상속'], legalBasis: '상속세및증여세법 제18조의2', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'familyBusiness', resultLabel: '상속세 절감', resultUnit: '원', inputs: [{ id: 'businessValue', label: '가업상속 재산가액', type: 'currency', default: 3000000000, hint: '사업무관자산을 뺀 가업상속 재산가액을 넣는다(범위는 시행령 위임)' }, { id: 'years', label: '피상속인 계속 경영기간 (년)', type: 'number', default: 15, min: 10, max: 50 }, { id: 'revenueOver', label: '직전 3개 사업연도 매출액 평균 5천억원 이상', type: 'radio', default: 'no', options: [{ value: 'no', label: '아니오' }, { value: 'yes', label: '예 (공제 제외)' }] }], faqs: [
      { q: '가업상속공제 한도는 얼마인가요?', a: '피상속인이 10년 이상 20년 미만 경영했으면 300억원, 20년 이상 30년 미만 400억원, 30년 이상 600억원입니다. 직전 3개 사업연도 매출액 평균 5천억원 이상인 기업은 제외됩니다(상속세및증여세법 제18조의2, 2026-01-01 시행 기준).' },
      { q: '공제받은 뒤 지켜야 할 것이 있나요?', a: '상속 후 5년 동안 가업용 자산 40% 이상 처분, 가업 미종사, 지분 감소, 고용·총급여 평균 90% 미달이 생기면 공제액을 추징합니다(제18조의2제5항).' },
      { q: '가업승계 계산기 결과는 정확한가요?', a: '참고용입니다. 가업 재산만 과세표준으로 놓고 공제 전후를 비교하므로 다른 상속재산·공제가 있으면 실제 절감액이 달라집니다.' },
      { q: '가업승계 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 상속/증여 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>가업승계 세금 계산기 완벽 가이드</h2><p>가업상속공제를 적용하기 전과 후의 상속세(신고세액공제 반영)를 비교합니다. 공제 한도는 피상속인의 계속 경영기간으로 정해집니다.</p><p>본 계산기는 <strong>상속세및증여세법 제18조의2</strong>를 기준으로 계산합니다(2026-01-01 시행 법령, 국가법령정보센터 원문 대조 2026-09-17). 규정은 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>상속·증여 핵심 정보</h2><p>상속세와 증여세는 같은 누진세율표(상속세 및 증여세법 제26조·제56조)를 쓰고, 기한 안에 신고하면 산출세액의 3%를 공제합니다(제69조, 2026-01-01 시행 기준). 증여재산공제는 수증자 기준 10년 합산 한도입니다. 계산기의 세율·공제액은 코드에 적지 않고 법령 상수표에서 받아 화면에 근거와 함께 표시합니다.</p><h2>이런 분들에게 추천</h2><p>자녀에게 재산을 이전하려는 부모, 상속 계획을 세우는 분, 부담부증여를 검토하는 분에게 유용합니다. 결과는 참고용이며 화면의 «미반영» 항목에 해당하면 실제 세액이 달라집니다.</p>', relatedCalcs: ['inheritance-tax'] },
  { slug: 'generation-skip', emoji: '👨‍👦‍👦', category: 'inheritance', categoryLabel: '상속/증여', title: '세대생략증여 할증 계산기', titleShort: '세대생략 할증 계산기', description: '조부모가 손자녀에게 증여할 때 세대생략 할증을 포함한 증여세를 계산(미성년 손자녀 공제·할증 구분).', keywords: ['세대생략증여','손자 증여','30% 할증','세대 건너뛰기'], legalBasis: '상속세및증여세법 제57조', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'generationSkip', resultLabel: '증여세 (할증 후)', resultUnit: '원', inputs: [{ id: 'amount', label: '증여 재산가액', type: 'currency', default: 200000000 }, { id: 'minor', label: '손자녀가 미성년자', type: 'radio', default: 'no', options: [{ value: 'no', label: '아니오' }, { value: 'yes', label: '예' }] }, { id: 'marriageBirth', label: '혼인·출산 증여재산공제 대상', type: 'radio', default: 'no', options: [{ value: 'no', label: '아니오' }, { value: 'yes', label: '예' }], hint: '혼인신고일 전후 2년 또는 자녀 출생·입양일부터 2년 안의 증여' }, { id: 'parentDeceased', label: '손자녀의 부모(증여자의 자녀)가 사망', type: 'radio', default: 'no', options: [{ value: 'no', label: '아니오' }, { value: 'yes', label: '예 (할증 없음)' }] }], faqs: [
      { q: '세대생략 할증률은 얼마인가요?', a: '수증자가 증여자의 자녀가 아닌 직계비속이면 증여세 산출세액의 30%를 더하고, 미성년자이면서 증여재산가액이 20억원을 초과하면 40%를 더합니다. 손자녀의 부모가 사망한 경우는 할증하지 않습니다(상속세및증여세법 제57조, 2026-01-01 시행 기준).' },
      { q: '손자녀 증여재산공제는 얼마인가요?', a: '조부모도 직계존속이라 성년 5천만원, 미성년 2천만원이며 10년 합산 한도입니다(제53조, 2026-01-01 시행 기준).' },
      { q: '세대생략 할증 계산기 결과는 정확한가요?', a: '참고용입니다. 10년 안에 이미 받은 증여·공제는 반영하지 않습니다.' },
      { q: '세대생략 할증 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 상속/증여 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>세대생략증여 할증 계산기 완벽 가이드</h2><p>손자녀 증여는 자녀를 거치는 두 번의 과세를 건너뛰므로 증여세 산출세액에 할증액을 더합니다. 미성년 손자녀 여부, 혼인·출산 공제, 부모 사망 여부에 따라 공제와 할증률이 달라집니다.</p><p>본 계산기는 <strong>상속세및증여세법 제57조</strong>를 기준으로 계산합니다(2026-01-01 시행 법령, 국가법령정보센터 원문 대조 2026-09-17). 규정은 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>상속·증여 핵심 정보</h2><p>상속세와 증여세는 같은 누진세율표(상속세 및 증여세법 제26조·제56조)를 쓰고, 기한 안에 신고하면 산출세액의 3%를 공제합니다(제69조, 2026-01-01 시행 기준). 증여재산공제는 수증자 기준 10년 합산 한도입니다. 계산기의 세율·공제액은 코드에 적지 않고 법령 상수표에서 받아 화면에 근거와 함께 표시합니다.</p><h2>이런 분들에게 추천</h2><p>자녀에게 재산을 이전하려는 부모, 상속 계획을 세우는 분, 부담부증여를 검토하는 분에게 유용합니다. 결과는 참고용이며 화면의 «미반영» 항목에 해당하면 실제 세액이 달라집니다.</p>', relatedCalcs: ['gift-tax'] },

  // 사업자 +3
  { slug: 'withholding-calc', emoji: '✂️', category: 'biz-tax', categoryLabel: '사업자 세금', title: '원천징수세액 계산기', titleShort: '원천징수 계산기', description: '급여/사업/기타소득별 원천징수세액을 계산.', keywords: ['원천징수','원천징수세액','소득별 원천징수'], legalBasis: '소득세법 제127조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'withholdingCalc', resultLabel: '원천징수세액', resultUnit: '원', inputs: [{ id: 'type', label: '소득 유형', type: 'select', default: 'salary', options: [{ value: 'salary', label: '근로소득' }, { value: 'business', label: '사업소득 (3.3%)' }, { value: 'other', label: '기타소득 (8.8%)' }, { value: 'interest', label: '이자소득 (15.4%)' }] }, { id: 'amount', label: '지급액', type: 'currency', default: 3000000 }], faqs: [
      { q: '원천징수 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 소득세법 제127조를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '원천징수 계산기에서 가장 중요한 입력값은?', a: '급여/사업/기타소득별 원천징수세액을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '원천징수 계산기는 무료인가요?', a: '네, 카더라 원천징수 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '원천징수 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>원천징수세액 계산기 완벽 가이드</h2><p>급여/사업/기타소득별 원천징수세액을 계산. 카더라 원천징수 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>소득세법 제127조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>사업자 세금 핵심 정보</h2><p>일반과세자는 매출의 10% 부가세를 징수·납부하고, 간이과세자는 업종별 부가가치율(1.5~4%) 적용. 법인세는 2억 이하 9%, 200억 이하 19%, 3000억 이하 21%, 초과 24%입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 사업자 세금 계산이 필요한 분에게 유용합니다. 카더라는 사업자 세금 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['withholding-3-3', 'net-salary'] },
  { slug: 'stamp-tax', emoji: '📃', category: 'biz-tax', categoryLabel: '사업자 세금', title: '인지세 계산기', titleShort: '인지세 계산기', description: '부동산 매매·증여 계약서와 금전소비대차 계약서의 인지세를 기재금액 구간으로 계산. 주택 1억원 이하 비과세.', keywords: ['인지세','계약서 인지세','인지대','수입인지','부동산 인지세'], legalBasis: '인지세법 제3조·제6조', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'stampTax', resultLabel: '인지세', resultUnit: '원', inputs: [{ id: 'contractAmount', label: '계약서 기재금액', type: 'currency', default: 500000000 }, { id: 'docType', label: '문서 종류', type: 'radio', default: 'house', options: [{ value: 'house', label: '주택 소유권 이전 (매매·증여)' }, { value: 'realty', label: '주택 외 부동산 소유권 이전' }, { value: 'loan', label: '금융기관 금전소비대차 (대출)' }] }, { id: 'copies', label: '계약서 통수', type: 'number', default: 1, min: 1, max: 10, hint: '과세문서 1통마다 인지세를 낸다.' }], faqs: [
      { q: '부동산 계약서 인지세는 얼마인가요?', a: '기재금액 1천만원 초과 3천만원 이하 2만원, 5천만원 이하 4만원, 1억원 이하 7만원, 10억원 이하 15만원, 10억원 초과 35만원이다. 주택은 1억원 이하 비과세(인지세법 §3①·§6, 2026-01-02 시행본 기준).' },
      { q: '매수인·매도인 중 누가 내나요?', a: '공동으로 작성한 문서는 연대 납세 의무가 있다. 실제 부담 비율은 당사자 약정으로 정한다.' },
      { q: '대출 계약서에도 붙나요?', a: '금융기관과의 금전소비대차 증서도 같은 구간 세액이며, 5천만원 이하는 비과세다.' },
    ], seoContent: '<h2>인지세 계산기</h2><p>계약서 기재금액과 문서 종류로 인지세를 계산한다. 구간 세액은 국가법령정보센터 현행 원문과 대조한 정책 상수표에서 받아 쓴다.</p><h2>구간은 «초과~이하»</h2><p>1억원 정각은 7만원, 1억원을 1원이라도 넘으면 15만원이다. 주택 소유권 이전 증서는 1억원 이하가 비과세다.</p><h2>반영하지 않는 것</h2><p>도급·위임 증서, 동산 양도 증서, 상품권·통장 등 다른 과세문서와 전자수입인지 수수료는 들어 있지 않다.</p>', relatedCalcs: ['registration-cost'] },
  { slug: 'simple-bookkeeping', emoji: '📒', category: 'biz-tax', categoryLabel: '사업자 세금', title: '간편장부 소득금액 계산기', titleShort: '간편장부 계산기', description: '간편장부로 사업소득금액을 계산.', keywords: ['간편장부','사업소득','필요경비','소규모 사업자'], legalBasis: '소득세법 시행령 제131조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'simpleBookkeeping', resultLabel: '소득금액', resultUnit: '원', inputs: [{ id: 'revenue', label: '총수입금액', type: 'currency', default: 30000000 }, { id: 'expenses', label: '필요경비', type: 'currency', default: 15000000 }], faqs: [
      { q: '간편장부 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '간편장부 계산기에서 가장 중요한 입력값은?', a: '간편장부로 사업소득금액을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '간편장부 계산기는 무료인가요?', a: '네, 카더라 간편장부 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '간편장부 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 사업자 세금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>간편장부 소득금액 계산기 완벽 가이드</h2><p>간편장부로 사업소득금액을 계산.</p><p>본 계산기는 <strong>소득세법 시행령 제131조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>간편장부 계산기 계산 방식</h2><p>소득금액 = 총수입금액 − 필요경비 (0 미만이면 0) 입니다. 세액 계산은 하지 않으므로 소득세는 종합소득세 계산기에서 확인하세요.</p><h2>이런 분들에게 추천</h2><p>정확한 사업자 세금 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['comprehensive-income-tax', 'expense-rate-lookup'] },
  // 부동산 +4
  // K-9 ⓒ ② — LTV 를 «사용자가 %를 고르는» 곱셈기에서 «조건으로 정해지는» 계산기로.
  //   예전 옵션(70 일반 / 60 조정 / 50 투기 / 80 생초)은 현행 규제와도 맞지 않았다.
  //   이제 지역·보유 상태를 고르면 policy_constants 의 confirmed 값이 적용된다.
  { slug: 'ltv-calc', emoji: '📊', category: 'real-estate', categoryLabel: '부동산', title: 'LTV 대출한도 계산기', titleShort: 'LTV 계산기', seoTitle: 'LTV 계산기 — 지역·주택수별 대출한도', description: '지역과 주택 보유 상태를 고르면 현행 규제 기준 LTV 한도와 대출 가능액을 계산. 적용 근거와 발표일을 함께 표시.', keywords: ['LTV 계산기','주택담보대출','대출한도','담보비율','규제지역 LTV','생애최초 LTV'], legalBasis: '금융위원회 가계부채 관리방안·국토교통부 규제지역 지정', version: '2026.09', lastUpdated: '2026-09-16', pattern: 'conditional', formula: 'ltvCalc', resultLabel: '대출 가능액', resultUnit: '원', inputs: [{ id: 'housePrice', label: '주택 시가', type: 'currency', default: 600000000 }, { id: 'region', label: '지역', type: 'select', default: 'regulated', options: [{ value: 'regulated', label: '규제지역(투기과열·조정대상)' }, { value: 'capital_nonreg', label: '수도권 비규제' }, { value: 'local_nonreg', label: '수도권 외 비규제' }] }, { id: 'owner', label: '주택 보유', type: 'select', default: 'none', options: [{ value: 'none', label: '무주택' }, { value: 'first_home', label: '생애최초' }, { value: 'disposal', label: '처분조건부 1주택' }, { value: 'owner', label: '1주택 보유(미처분)' }, { value: 'multi', label: '2주택 이상' }] }, { id: 'existingLoan', label: '기존 담보대출', type: 'currency', default: 0 }], faqs: [
      { q: 'LTV 계산기 결과는 실제와 같나요?', a: '참고용이며, 지역·물건 특성에 따라 차이가 있을 수 있습니다. 은행업감독규정를 기준으로 계산합니다.' },
      { q: '부동산 거래 시 꼭 확인할 것은?', a: '등기부등본, 건축물대장, 토지이용계획확인서를 반드시 확인하세요.' },
      { q: 'LTV 계산기는 무료인가요?', a: '네, 카더라 LTV 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: 'LTV 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>LTV 대출한도 계산기 완벽 가이드</h2><p>주택담보대출 LTV 비율로 대출 가능 금액을 추정. 카더라 LTV 계산기는 2026년 최신 기준을 반영합니다.</p><p>본 계산기는 <strong>은행업감독규정</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>부동산 거래 핵심 정보</h2><p>부동산 거래 시 중개수수료(0.4~0.9%), 등기비용, 취득세, 대출이자 등 다양한 비용이 발생합니다. 사전에 총 비용을 정확히 계산하면 예상치 못한 지출을 방지할 수 있습니다. 등기부등본·건축물대장·토지이용계획확인서는 반드시 확인하세요.</p><h2>이런 분들에게 추천</h2><p>주택 매매·전세·월세를 계획 중인 분, 부동산 투자 수익률을 분석하고 싶은 분, 대출 가능 금액을 확인하고 싶은 분에게 유용합니다.</p>', relatedCalcs: ['dsr-calc', 'loan-repayment'] },

  { slug: 'housing-bond', emoji: '📋', category: 'real-estate', categoryLabel: '부동산', title: '국민주택채권 매입금액 계산기', titleShort: '주택채권 계산기', seoTitle: '국민주택채권 계산기 — 매입금액·할인율 즉시 계산', description: '부동산 등기 시 매입해야 하는 국민주택채권 금액을 시가표준액 구간별 법정 매입률로 계산.', keywords: ['국민주택채권','국민주택채권 계산기','채권매입','등기 채권','할인율','매입률'], legalBasis: '주택도시기금법 시행령 별표', version: '2026.09', lastUpdated: '2026-09-16', pattern: 'tax-bracket', formula: 'housingBond', resultLabel: '채권 매입금액', resultUnit: '원', inputs: [{ id: 'housePrice', label: '부동산 시가표준액', type: 'currency', default: 500000000 }, { id: 'region', label: '지역', type: 'radio', default: 'metro', options: [{ value: 'metro', label: '특별시/광역시' }, { value: 'other', label: '기타 지역' }] }, { id: 'discountRate', label: '당일 고시 할인율 (%)', type: 'number', default: 0, min: 0, max: 30, step: 0.01, unit: '%', hint: '즉시매도 시에만 필요. 매일 바뀌므로 주택도시기금 홈페이지의 당일 고시값을 넣는다. 비워 두면 법정 매입금액만 계산한다.' }], faqs: [
      { q: '주택채권 계산기 결과는 실제와 같나요?', a: '매매로 인한 주택 소유권 이전등기를 전제로 한 법정 매입금액입니다. 등기 원인·부동산 종류가 다르면 적용 매입률이 달라지니 등기소·법무사 안내로 확인하세요.' },
      { q: '주택채권 계산기는 무료인가요?', a: '네, 카더라 주택채권 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '주택채권 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>국민주택채권 매입금액 계산기 완벽 가이드</h2><p>부동산 등기 시 매입해야 하는 국민주택채권 금액을 계산.</p><p>본 계산기는 <strong>주택도시기금법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>주택채권 계산기 계산 방식</h2><p>시가표준액과 지역(특별시·광역시 / 그 밖의 지역)으로 법정 매입률(1,000분의 N)을 찾아 «시가표준액 × 매입률» 로 채권 매입금액을 구합니다. 당일 고시 할인율을 넣으면 «매입금액 × 할인율» 로 즉시매도 시 실부담도 함께 보여줍니다. 전제는 매매로 인한 주택 소유권 이전등기이며, 시가표준액 2,000만원 미만은 매입 대상이 아닌 것으로 계산합니다.</p><h2>이런 분들에게 추천</h2><p>아파트 매매 잔금·소유권 이전등기를 앞두고 채권 부담액을 미리 확인하려는 분에게 유용합니다.</p>', relatedCalcs: ['registration-cost'] },
  { slug: 'far-bcr', emoji: '🏗️', category: 'real-estate', categoryLabel: '부동산', title: '건폐율/용적률 계산기', titleShort: '건폐율/용적률', description: '대지면적·건축면적·연면적으로 건폐율과 용적률을 계산.', keywords: ['건폐율','용적률','건축면적','연면적','대지면적'], legalBasis: '건축법 제55조, 제56조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'farBcr', resultLabel: '건폐율/용적률', resultUnit: '', inputs: [{ id: 'landArea', label: '대지면적 (㎡)', type: 'number', default: 500 }, { id: 'buildingArea', label: '건축면적 (㎡)', type: 'number', default: 300 }, { id: 'totalFloorArea', label: '연면적 (㎡)', type: 'number', default: 1500 }], faqs: [
      { q: '건폐율/용적률 결과는 실제와 같나요?', a: '입력한 면적으로 비율만 계산합니다. 허용 한도는 용도지역과 지자체 조례로 정해지므로 토지이용계획확인서와 조례에서 확인하세요.' },
      { q: '부동산 거래 시 꼭 확인할 것은?', a: '등기부등본, 건축물대장, 토지이용계획확인서를 반드시 확인하세요.' },
      { q: '건폐율/용적률는 무료인가요?', a: '네, 카더라 건폐율/용적률는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '건폐율/용적률는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>건폐율/용적률 계산기 완벽 가이드</h2><p>대지면적·건축면적·연면적으로 건폐율과 용적률을 계산.</p><p>본 계산기는 <strong>건축법 제55조, 제56조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>건폐율/용적률 계산 방식</h2><p>건폐율 = 건축면적 ÷ 대지면적 × 100, 용적률 = 연면적 ÷ 대지면적 × 100 으로 계산합니다. 입력한 연면적을 그대로 쓰므로 용적률 산정에서 빼는 면적(지하층 등)은 미리 제외하고 넣으세요. 용도지역별 법정·조례 상한과는 자동으로 대조하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>신축·증축 전에 대지에 대한 건폐율·용적률을 확인하려는 분에게 유용합니다.</p>', relatedCalcs: ['pyeong-sqm'] },

  { slug: 'auction-profit', emoji: '🔨', category: 'real-estate', categoryLabel: '부동산', title: '경매 수익률 계산기', titleShort: '경매 수익률', description: '경매 낙찰가 대비 시세 차익과 수익률을 계산.', keywords: ['경매 수익률','부동산 경매','낙찰가','감정가'], legalBasis: '지방세법 §11(취득세)·§151(지방교육세)·농어촌특별세법 §5', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'auctionProfit', resultLabel: '예상 수익률', resultUnit: '%', inputs: [{ id: 'appraisal', label: '감정가', type: 'currency', default: 500000000 }, { id: 'bidPrice', label: '낙찰 예상가', type: 'currency', default: 350000000 }, { id: 'marketPrice', label: '예상 매도가 (비우면 감정가)', type: 'currency', default: 500000000 }, { id: 'propertyType', label: '물건 종류', type: 'select', default: 'house', options: [{ value: 'house', label: '주택' }, { value: 'other', label: '주택 외 (상가·토지·오피스텔)' }] }, { id: 'houseCount', label: '취득 후 보유 주택수', type: 'select', default: '1', options: [{ value: '1', label: '1주택' }, { value: '2', label: '2주택' }, { value: '3', label: '3주택' }, { value: '4', label: '4주택 이상' }] }, { id: 'regulated', label: '조정대상지역', type: 'select', default: 'no', options: [{ value: 'no', label: '아니오' }, { value: 'yes', label: '예' }] }, { id: 'area85', label: '전용면적', type: 'select', default: 'under', options: [{ value: 'under', label: '85㎡ 이하' }, { value: 'over', label: '85㎡ 초과' }] }, { id: 'repairCost', label: '수리비', type: 'currency', default: 20000000 }, { id: 'otherCosts', label: '기타 부대비용 (등기·법무·명도·중개)', type: 'currency', default: 0 }], faqs: [
      { q: '경매 취득세는 무엇을 기준으로 내나요?', a: '감정가가 아니라 «낙찰가»(매각대금)가 과세표준입니다. 주택은 보유 주택수·조정대상지역·전용면적에 따라 1.1%~13.4%, 주택 외 부동산은 4.6%(취득세 4%+지방교육세 0.4%+농특세 0.2%)입니다.' },
      { q: '이 계산에 빠져 있는 비용은?', a: '양도소득세·대출이자·보유세는 들어 있지 않습니다. 등기비·법무비·명도비·체납관리비·중개보수는 물건마다 편차가 커서 대표값을 두지 않고 「기타 부대비용」에 직접 넣도록 했습니다.' },
      { q: '감정가를 시세로 봐도 되나요?', a: '아닙니다. 감정평가는 매각기일보다 6~12개월 앞선 시점 기준이고, 유찰이 거듭될수록 격차가 벌어집니다. 출구가격은 「예상 매도가」에 따로 넣으세요. 낙찰가율만 정의상 감정가 대비로 계산합니다.' },
      { q: '경매 수익률 결과는 실제와 같나요?', a: '참고용이며, 지역·물건 특성에 따라 차이가 있을 수 있습니다.' },
      { q: '부동산 거래 시 꼭 확인할 것은?', a: '등기부등본, 건축물대장, 토지이용계획확인서를 반드시 확인하세요.' },
      { q: '경매 수익률는 무료인가요?', a: '네, 카더라 경매 수익률는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '경매 수익률는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 부동산 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>경매 수익률 계산기 완벽 가이드</h2><p>경매 낙찰가 대비 시세 차익과 수익률을 계산. 카더라 경매 수익률는 2026년 최신 기준을 반영합니다.</p><h2>부동산 거래 핵심 정보</h2><p>부동산 거래 시 중개수수료(0.4~0.9%), 등기비용, 취득세, 대출이자 등 다양한 비용이 발생합니다. 사전에 총 비용을 정확히 계산하면 예상치 못한 지출을 방지할 수 있습니다. 등기부등본·건축물대장·토지이용계획확인서는 반드시 확인하세요.</p><h2>이런 분들에게 추천</h2><p>주택 매매·전세·월세를 계획 중인 분, 부동산 투자 수익률을 분석하고 싶은 분, 대출 가능 금액을 확인하고 싶은 분에게 유용합니다.</p>', relatedCalcs: ['rental-yield', 'acquisition-tax'] },
  // 투자 +3
  { slug: 'drip-sim', emoji: '💹', category: 'investment', categoryLabel: '주식/투자', title: '배당 재투자(DRIP) 시뮬레이터', titleShort: 'DRIP 시뮬레이터', description: '배당금을 재투자할 때 장기 복리 효과를 시뮬레이션.', keywords: ['DRIP','배당 재투자','배당 복리','배당 성장'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'amortize', formula: 'dripSim', resultLabel: '최종 자산', resultUnit: '원', inputs: [{ id: 'investment', label: '초기 투자금', type: 'currency', default: 50000000 }, { id: 'yieldRate', label: '배당수익률 (%)', type: 'percent', default: 4 }, { id: 'growthRate', label: '배당성장률 (%)', type: 'percent', default: 5 }, { id: 'years', label: '투자 기간 (년)', type: 'range', default: 20, min: 1, max: 40 }], faqs: [
      { q: 'DRIP 시뮬레이터에서 세금은 반영되나요?', a: '아니요. 배당을 세전 금액 그대로 재투자한다고 가정하며 배당소득세·수수료는 들어 있지 않습니다.' },
      { q: 'DRIP 시뮬레이터는 무료인가요?', a: '네, 카더라 DRIP 시뮬레이터는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: 'DRIP 시뮬레이터는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>배당 재투자(DRIP) 시뮬레이터 완벽 가이드</h2><p>배당금을 재투자할 때 장기 복리 효과를 시뮬레이션.</p><h2>DRIP 시뮬레이터 계산 방식</h2><p>매년 «자산 × 배당수익률» 만큼 배당을 받아 전액 재투자하고, 배당수익률은 매년 배당성장률만큼 오른다고 가정합니다. 주가 변동·배당소득세·매매 수수료는 이 계산에 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>배당주·배당 ETF의 배당을 재투자할 때 장기 자산 규모를 가늠하려는 분에게 유용합니다. 투자에는 원금 손실 위험이 있으며, 본 계산기는 참고용입니다.</p>', relatedCalcs: ['dividend-calc', 'compound-interest'] },

  { slug: 'short-selling', emoji: '📉', category: 'investment', categoryLabel: '주식/투자', title: '공매도 수익 계산기', titleShort: '공매도 계산기', description: '공매도 시 대차료·수수료 포함 순수익을 계산.', keywords: ['공매도 수익','공매도 계산','대차료','숏셀링'], legalBasis: '증권거래세법 · 농어촌특별세법', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'shortSelling', resultLabel: '공매도 순수익', resultUnit: '원', inputs: [{ id: 'market', label: '시장', type: 'radio', default: 'kospi', options: [{ value: 'kospi', label: '코스피' }, { value: 'kosdaq', label: '코스닥' }] }, { id: 'sellPrice', label: '매도가', type: 'currency', default: 100000 }, { id: 'buyPrice', label: '환매가', type: 'currency', default: 80000 }, { id: 'quantity', label: '수량', type: 'number', default: 100 }, { id: 'borrowFee', label: '대차료율 (%/년)', type: 'percent', default: 3, hint: '종목·수급에 따라 달라진다 — 대여 약정 요율을 넣는다' }, { id: 'days', label: '보유일수', type: 'number', default: 30 }, { id: 'fee', label: '위탁수수료율 (%)', type: 'percent', default: 0.015, step: 0.001, hint: '증권사·매체별로 다르다. 기본값은 예시값' }], faqs: [
      { q: '공매도 계산기에서 세금은 반영되나요?', a: '매도금액에 증권거래세(코스피는 농어촌특별세 포함)를 붙이고 환매 매수에는 붙이지 않습니다. 세율은 정책 표에서 받아 결과 화면에 표시합니다. 양도소득세는 이 계산에 들어 있지 않습니다.' },
      { q: '공매도 계산기는 무료인가요?', a: '네, 카더라 공매도 계산기는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '공매도 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>공매도 수익 계산기 완벽 가이드</h2><p>공매도 시 대차료·수수료 포함 순수익을 계산.</p><h2>공매도 계산기 계산 방식</h2><p>매도차익 = (매도가 − 환매가) × 수량. 여기서 대차료(매도금액 × 연 대차료율 × 보유일수 ÷ 365), 매도·환매 양쪽 위탁수수료, 매도금액에 붙는 증권거래세(코스피는 농어촌특별세 포함)를 빼서 순수익을 구합니다. 환매 매수에는 증권거래세를 붙이지 않습니다. 세율은 정책 표에서 받아 성분별로 표시하고, 수수료율 기본값은 예시값이라 본인 약정 요율을 넣어야 합니다.</p><h2>이런 분들에게 추천</h2><p>대주·공매도 거래의 비용을 뺀 순수익을 미리 확인하려는 분에게 유용합니다. 투자에는 원금 손실 위험이 있으며, 본 계산기는 참고용입니다.</p>', relatedCalcs: ['stock-roi'] },
  { slug: 'rebalance-calc', emoji: '⚖️', category: 'investment', categoryLabel: '주식/투자', title: '포트폴리오 리밸런싱 계산기', titleShort: '리밸런싱 계산기', description: '목표 비중으로 포트폴리오를 리밸런싱할 때 매수/매도 금액을 계산.', keywords: ['리밸런싱','포트폴리오','자산배분','목표비중'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'rebalanceCalc', resultLabel: '조정 결과', resultUnit: '', inputs: [{ id: 'totalAsset', label: '총 자산', type: 'currency', default: 100000000 }, { id: 'stock', label: '주식 현재 비중 (%)', type: 'percent', default: 70 }, { id: 'stockTarget', label: '주식 목표 비중 (%)', type: 'percent', default: 60 }, { id: 'bond', label: '채권 현재 비중 (%)', type: 'percent', default: 20 }, { id: 'bondTarget', label: '채권 목표 비중 (%)', type: 'percent', default: 30 }], faqs: [
      { q: '리밸런싱 계산기에서 세금은 반영되나요?', a: '아니요. 목표 비중까지의 매수·매도 금액만 계산하며 수수료·세금은 들어 있지 않습니다.' },
      { q: '리밸런싱 계산기는 무료인가요?', a: '네, 카더라 리밸런싱 계산기는 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '리밸런싱 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 주식/투자 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>포트폴리오 리밸런싱 계산기 완벽 가이드</h2><p>목표 비중으로 포트폴리오를 리밸런싱할 때 매수/매도 금액을 계산.</p><h2>리밸런싱 계산기 계산 방식</h2><p>주식·채권 각각 «(목표 비중 − 현재 비중) × 총 자산» 으로 조정 금액을 구해, 양수면 매수·음수면 매도로 보여줍니다. 매매 수수료와 세금은 이 계산에 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>주식·채권 비중이 목표에서 벗어났을 때 얼마를 사고팔아야 하는지 확인하려는 분에게 유용합니다. 투자에는 원금 손실 위험이 있으며, 본 계산기는 참고용입니다.</p>', relatedCalcs: ['compound-interest', 'investment-type-test'] },

  // 급여 +2
  { slug: 'severance-calc', emoji: '📑', category: 'salary', categoryLabel: '급여/노동', title: '해고예고수당 계산기', titleShort: '해고예고수당', description: '해고 시 지급해야 하는 해고예고수당(30일분)을 계산.', keywords: ['해고예고수당','해고 수당','30일분','통상임금'], legalBasis: '근로기준법 제26조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'severanceCalc', resultLabel: '해고예고수당', resultUnit: '원', inputs: [{ id: 'monthlySalary', label: '월 통상임금', type: 'currency', default: 3500000 }], faqs: [
      { q: '해고예고수당에서 4대보험은 어떻게 적용되나요?', a: '적용하지 않습니다. 입력한 월 통상임금을 30일분 수당으로 보여주는 세전 금액입니다.' },
      { q: '해고예고수당 결과가 실제와 다를 수 있나요?', a: '네. 1일 통상임금 × 30일로 계산하면 월급과 차이가 날 수 있고, 해고예고 적용 제외 사유에 해당하면 수당이 발생하지 않습니다.' },
      { q: '해고예고수당는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>해고예고수당 계산기 완벽 가이드</h2><p>해고 시 지급해야 하는 해고예고수당(30일분)을 계산.</p><p>본 계산기는 <strong>근로기준법 제26조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>해고예고수당 계산 방식</h2><p>입력한 월 통상임금을 30일분 해고예고수당으로 그대로 보여줍니다. 법정 해고예고수당은 30일분 이상의 통상임금이므로, 일급 기준으로 계산하면 월급 금액과 조금 다를 수 있습니다. 세금·4대보험은 빼지 않습니다.</p><h2>이런 분들에게 추천</h2><p>연봉 협상 중인 직장인, 첫 취업을 앞둔 구직자, 급여 명세서를 이해하고 싶은 분에게 유용합니다.</p>', relatedCalcs: ['retirement-pay', 'net-salary'] },
  { slug: 'minimum-wage', emoji: '💰', category: 'salary', categoryLabel: '급여/노동', title: '최저임금 계산기', titleShort: '최저임금 계산기', description: '2026년 최저임금 기준 월급·연봉을 계산.', keywords: ['최저임금','2026 최저임금','최저시급','최저월급'], legalBasis: '최저임금법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'minimumWage', resultLabel: '최저월급 (209시간)', resultUnit: '원', inputs: [{ id: 'weeklyHours', label: '주당 근로시간', type: 'number', default: 40 }, { id: 'includeHoliday', label: '주휴수당 포함', type: 'radio', default: 'yes', options: [{ value: 'yes', label: '포함' }, { value: 'no', label: '미포함' }] }], faqs: [
      { q: '최저임금 계산기에서 4대보험은 어떻게 적용되나요?', a: '적용하지 않습니다. 최저시급 × 월 유급시간으로 세전 최저월급·연봉만 보여줍니다.' },
      { q: '최저임금 계산기 결과가 실제와 다를 수 있나요?', a: '네. 수습기간 감액, 소정근로시간, 최저임금 산입 범위에 따라 달라집니다. 적용 시급은 결과 화면의 값을 고용노동부 고시와 대조하세요.' },
      { q: '최저임금 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 급여/노동 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>최저임금 계산기 완벽 가이드</h2><p>2026년 최저임금 기준 월급·연봉을 계산.</p><p>본 계산기는 <strong>최저임금법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>최저임금 계산기 계산 방식</h2><p>계산기에 설정된 최저시급(결과 화면에 표시)에 월 유급시간을 곱해 최저월급을 구합니다. 주휴수당을 포함하면 주당 유급시간 = 근로시간 + 근로시간 ÷ 5, 월 유급시간 = 주당 유급시간 × 52 ÷ 12 입니다. 세금·4대보험을 빼지 않은 세전 금액이며, 해당 연도 최저임금 고시액은 고용노동부 고시로 확인하세요.</p><h2>이런 분들에게 추천</h2><p>연봉 협상 중인 직장인, 첫 취업을 앞둔 구직자, 급여 명세서를 이해하고 싶은 분에게 유용합니다.</p>', relatedCalcs: ['hourly-annual', 'net-salary'] },

  // 대출 +3
  { slug: 'jeonse-loan', emoji: '🏠', category: 'loan', categoryLabel: '대출/예적금', title: '전세대출 이자 계산기', titleShort: '전세대출 이자', description: '전세자금대출의 월 이자를 계산.', keywords: ['전세대출','전세자금대출','전세대출 이자'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'jeonseLoan', resultLabel: '월 이자', resultUnit: '원', inputs: [{ id: 'loanAmount', label: '대출 금액', type: 'currency', default: 200000000 }, { id: 'rate', label: '금리 (%)', type: 'percent', default: 3.5, step: 0.1 }], faqs: [
      { q: '전세대출 이자는 실제 대출과 차이가 있나요?', a: '참고용이며, 실제 이자는 은행의 일할 계산·우대금리·금리 변동에 따라 차이가 있습니다.' },
      { q: '전세대출 이자는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>전세대출 이자 계산기 완벽 가이드</h2><p>전세자금대출의 월 이자를 계산.</p><h2>전세대출 이자 계산 방식</h2><p>월 이자 = 대출 금액 × 금리 ÷ 12, 연 이자 = 대출 금액 × 금리 입니다. 원금 상환분·보증료·인지세는 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>전세자금대출을 받을 때 금리별 월 이자 부담을 확인하려는 분에게 유용합니다.</p>', relatedCalcs: ['loan-repayment', 'jeonse-vs-wolse'] },
  { slug: 'refinance-compare', emoji: '🔄', category: 'loan', categoryLabel: '대출/예적금', title: '대출 대환 비교기', titleShort: '대환 비교기', description: '기존 대출을 새 대출로 갈아탈 때 이자 절감액을 비교.', keywords: ['대환','대출 갈아타기','금리 비교','이자 절감'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'refinanceCompare', resultLabel: '연간 이자 절감', resultUnit: '원', inputs: [{ id: 'balance', label: '잔여 원금', type: 'currency', default: 200000000 }, { id: 'currentRate', label: '현재 금리 (%)', type: 'percent', default: 5.5, step: 0.1 }, { id: 'newRate', label: '새 금리 (%)', type: 'percent', default: 4.0, step: 0.1 }, { id: 'refinanceFee', label: '대환 수수료', type: 'currency', default: 500000 }], faqs: [
      { q: '대환 비교기는 실제 대출과 차이가 있나요?', a: '참고용이며, 은행별 우대금리·수수료 등에 따라 차이가 있습니다.' },
      { q: '대환 비교기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>대출 대환 비교기 완벽 가이드</h2><p>기존 대출을 새 대출로 갈아탈 때 이자 절감액을 비교.</p><h2>대환 비교기 계산 방식</h2><p>연간 이자 절감 = 잔여 원금 × (현재 금리 − 새 금리), 손익분기 = 대환 수수료 ÷ (연간 절감액 ÷ 12) 개월(올림) 입니다. 잔여 원금이 상환으로 줄어드는 효과는 반영하지 않으며, 기존 대출 중도상환수수료는 «대환 수수료» 칸에 합산해 넣어야 계산에 들어갑니다.</p><h2>이런 분들에게 추천</h2><p>더 낮은 금리로 대출을 갈아탈지, 수수료를 내고도 이득인지 판단하려는 분에게 유용합니다.</p>', relatedCalcs: ['loan-repayment', 'prepayment-fee'] },

  { slug: 'credit-loan-est', emoji: '💳', category: 'loan', categoryLabel: '대출/예적금', title: '신용대출 한도 추정기', titleShort: '신용대출 한도', description: '연소득·신용등급으로 신용대출 가능 한도를 추정.', keywords: ['신용대출 한도','대출 가능 금액','신용등급'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'creditLoanEst', resultLabel: '추정 한도', resultUnit: '원', inputs: [{ id: 'annualIncome', label: '연소득', type: 'currency', default: 50000000 }, { id: 'creditGrade', label: '신용등급', type: 'select', default: '3', options: [{ value: '1', label: '1등급 (최우량)' }, { value: '3', label: '3등급 (우량)' }, { value: '5', label: '5등급 (보통)' }, { value: '7', label: '7등급 (주의)' }] }], faqs: [
      { q: '신용대출 한도는 실제 대출과 차이가 있나요?', a: '큰 차이가 날 수 있습니다. 실제 한도는 은행 심사, DSR 규제, 기존 대출, 재직·소득 증빙에 따라 정해지며 이 추정은 연소득에 가정 배수만 곱합니다.' },
      { q: '신용대출 한도는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있습니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 대출/예적금 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>신용대출 한도 추정기 완벽 가이드</h2><p>연소득·신용등급으로 신용대출 가능 한도를 추정.</p><h2>신용대출 한도 계산 방식</h2><p>추정 한도 = 연소득 × 신용등급별 배수 입니다. 배수는 카더라가 정한 가정값이며 결과 화면에 «연소득 대비 N배» 로 표시됩니다. DSR 규제·기존 대출·재직 기간 등 실제 심사 요소는 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>신용대출을 알아보기 전에 소득 대비 한도 규모를 대략 가늠하려는 분에게 유용합니다.</p>', relatedCalcs: ['loan-repayment', 'dsr-calc'] },
  // 연금 +3
  { slug: 'retirement-expense', emoji: '🧓', category: 'pension', categoryLabel: '연금/은퇴', title: '노후 생활비 추정기', titleShort: '노후 생활비 계산기', description: '은퇴 후 필요한 월 생활비와 총 필요자금을 추정.', keywords: ['노후 생활비','은퇴 자금','노후 준비','생활비 계산'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'retirementExpense', resultLabel: '총 필요자금', resultUnit: '원', inputs: [{ id: 'monthlyExpense', label: '은퇴 후 월 생활비', type: 'currency', default: 3000000 }, { id: 'retireAge', label: '은퇴 나이', type: 'number', default: 60 }, { id: 'lifeExpectancy', label: '기대 수명', type: 'number', default: 85 }, { id: 'inflation', label: '물가상승률 (%)', type: 'percent', default: 3 }], faqs: [
      { q: '노후 생활비 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '노후 생활비 계산기에서 가장 중요한 입력값은?', a: '은퇴 후 필요한 월 생활비와 총 필요자금을 추정. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '노후 생활비 계산기는 무료인가요?', a: '네, 카더라 노후 생활비 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '노후 생활비 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>노후 생활비 추정기 완벽 가이드</h2><p>은퇴 후 필요한 월 생활비와 총 필요자금을 추정.</p><h2>노후 생활비 계산기 계산 방식</h2><p>은퇴 후 기간 = 기대 수명 − 은퇴 나이. 이 기간 동안 매년 «월 생활비 × 12» 가 물가상승률만큼 늘어난다고 보고 모두 더해 총 필요자금을 구합니다. 연금 수령액·투자수익은 빼지 않은 금액입니다.</p><h2>이런 분들에게 추천</h2><p>정확한 연금/은퇴 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['fire-calc', 'national-pension'] },

  { slug: 'pension-vs-lump', emoji: '🔀', category: 'pension', categoryLabel: '연금/은퇴', title: '연금 vs 일시금 비교기', titleShort: '연금vs일시금', description: '퇴직금을 연금으로 받을 때 vs 일시금으로 받을 때 총 수령액 비교.', keywords: ['연금 일시금 비교','퇴직금 수령','연금 수령','일시금'], legalBasis: '소득세법 제22조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'pensionVsLump', resultLabel: '비교 결과', resultUnit: '', inputs: [{ id: 'totalAmount', label: '퇴직금', type: 'currency', default: 200000000 }, { id: 'pensionYears', label: '연금 수령 기간 (년)', type: 'range', default: 15, min: 5, max: 30 }, { id: 'investReturn', label: '일시금 운용 수익률 (%)', type: 'percent', default: 4 }], faqs: [
      { q: '연금vs일시금 결과는 정확한가요?', a: '세금을 넣지 않은 단순 비교입니다. 연금은 원금만 나눠 받는다고 보고, 일시금은 입력 수익률로 불린다고 가정합니다. 수령 방식에 따른 세금 차이는 계산에 들어 있지 않습니다.' },
      { q: '연금vs일시금에서 가장 중요한 입력값은?', a: '퇴직금을 연금으로 받을 때 vs 일시금으로 받을 때 총 수령액 비교. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '연금vs일시금는 무료인가요?', a: '네, 카더라 연금vs일시금는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '연금vs일시금는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>연금 vs 일시금 비교기 완벽 가이드</h2><p>퇴직금을 연금으로 받을 때 vs 일시금으로 받을 때 총 수령액 비교.</p><p>본 계산기는 <strong>소득세법 제22조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>연금vs일시금 계산 방식</h2><p>연금 총 수령액은 퇴직금을 수령 기간으로 나눠 받는 원금 합계로 보고(연금 운용수익 미반영), 일시금은 퇴직금이 입력한 수익률로 복리 증식한다고 가정해 «퇴직금 × (1 + 수익률)^기간» 으로 비교합니다. 퇴직소득세·연금소득세 등 수령 방식별 세금 차이는 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 연금/은퇴 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['retirement-pension-sim', 'irp-deduction'] },
  { slug: 'isa-conversion', emoji: '🔄', category: 'pension', categoryLabel: '연금/은퇴', title: 'ISA 만기 전환 시뮬레이터', titleShort: 'ISA 전환 시뮬', description: 'ISA 만기 후 IRP 전환 시 추가 세액공제 효과를 시뮬레이션.', keywords: ['ISA 전환','ISA IRP','ISA 만기','추가 세액공제'], legalBasis: '조세특례제한법 제91조의18', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'isaConversion', resultLabel: '추가 세액공제', resultUnit: '원', inputs: [{ id: 'isaBalance', label: 'ISA 만기 잔액', type: 'currency', default: 20000000 }, { id: 'transferAmount', label: 'IRP 전환 금액', type: 'currency', default: 20000000 }], faqs: [
      { q: 'ISA 전환 시뮬 결과는 정확한가요?', a: '전환액의 10%(최대 300만원)만 계산합니다. 실제 환급 세액은 세액공제율과 연금계좌 납입 한도 사용 여부에 따라 달라지며, 이 계산에는 들어 있지 않습니다.' },
      { q: 'ISA 전환 시뮬에서 가장 중요한 입력값은?', a: 'ISA 만기 후 IRP 전환 시 추가 세액공제 효과를 시뮬레이션. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: 'ISA 전환 시뮬는 무료인가요?', a: '네, 카더라 ISA 전환 시뮬는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: 'ISA 전환 시뮬는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 연금/은퇴 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>ISA 만기 전환 시뮬레이터 완벽 가이드</h2><p>ISA 만기 후 IRP 전환 시 추가 세액공제 효과를 시뮬레이션.</p><p>본 계산기는 <strong>조세특례제한법 제91조의18</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>ISA 전환 시뮬 계산 방식</h2><p>전환 금액(ISA 잔액 이내)의 10%를 최대 300만원까지 결과로 보여줍니다. 이 값은 연금계좌 세액공제 «대상 금액» 에 더해지는 한도 성격이며, 실제 돌려받는 세액은 여기에 세액공제율을 곱해야 합니다 — 세액공제율은 이 계산에 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 연금/은퇴 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['irp-deduction', 'isa-tax-free'] },

  // 자동차 +2
  { slug: 'car-insurance-est', emoji: '🛡️', category: 'auto', categoryLabel: '자동차', title: '자동차 보험료 추정기', titleShort: '자동차 보험료', description: '차량·운전자 정보로 자동차 보험료를 «예시로» 추정. 실제 보험료는 보험사 견적이 정본.', keywords: ['자동차 보험료','차량 보험','보험료 추정','자동차보험'], legalBasis: '', version: '2026.09', lastUpdated: '2026-09-17', pattern: 'simple', formula: 'carInsuranceEst', resultLabel: '추정 보험료 (예시)', resultUnit: '원', inputs: [{ id: 'carAge', label: '차량 연식 (년)', type: 'number', default: 3 }, { id: 'driverAge', label: '운전자 나이', type: 'number', default: 35 }, { id: 'carPrice', label: '차량 가격', type: 'currency', default: 30000000 }, { id: 'accidentFree', label: '무사고 기간 (년)', type: 'number', default: 3 }], faqs: [
      { q: '자동차 보험료 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '자동차 보험료에서 가장 중요한 입력값은?', a: '차량·운전자 정보로 자동차 보험료를 추정. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '자동차 보험료는 무료인가요?', a: '네, 카더라 자동차 보험료는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '자동차 보험료는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>자동차 보험료 추정기 완벽 가이드</h2><p>차량·운전자 정보로 자동차 보험료를 추정.</p><h2>자동차 보험료 계산 방식</h2><p>추정 보험료 = 차량 가격 × 3.5% × 연령 계수 × 연식 계수 × 무사고 계수 입니다. 계수는 카더라 가정값이며 보험사 요율이 아닙니다. 결과 화면에 가정 계수와 참고용 전국 평균, 실제 견적 경로를 함께 표시합니다.</p><h2>이런 분들에게 추천</h2><p>정확한 자동차 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['vehicle-tax', 'fuel-cost'] },
  { slug: 'fuel-saving', emoji: '⛽', category: 'auto', categoryLabel: '자동차', title: '유류비 절감 비교기', titleShort: '유류비 절감 비교', description: '두 차량의 연비를 비교하여 연간 유류비 절감액을 계산.', keywords: ['유류비 절감','연비 비교','하이브리드 절감','경유 휘발유'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'compare', formula: 'fuelSaving', resultLabel: '연간 절감액', resultUnit: '원', inputs: [{ id: 'distance', label: '연간 주행거리 (km)', type: 'number', default: 15000 }, { id: 'eff1', label: '차량A 연비 (km/L)', type: 'number', default: 10, step: 0.1 }, { id: 'eff2', label: '차량B 연비 (km/L)', type: 'number', default: 18, step: 0.1 }, { id: 'fuelPrice', label: '유가 (원/L)', type: 'currency', default: 1700 }], faqs: [
      { q: '유류비 절감 비교 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '유류비 절감 비교에서 가장 중요한 입력값은?', a: '두 차량의 연비를 비교하여 연간 유류비 절감액을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '유류비 절감 비교는 무료인가요?', a: '네, 카더라 유류비 절감 비교는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '유류비 절감 비교는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 자동차 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>유류비 절감 비교기 완벽 가이드</h2><p>두 차량의 연비를 비교하여 연간 유류비 절감액을 계산.</p><h2>유류비 절감 비교 계산 방식</h2><p>차량별 연간 유류비 = 연간 주행거리 ÷ 연비 × 유가 로 구하고, 두 값의 차이를 연간 절감액으로 보여줍니다. 차량 가격·보험료·정비비 차이는 들어 있지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 자동차 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['fuel-cost', 'ev-charge-cost'] },

  // 생활 +1
  { slug: 'inflation-calc', emoji: '📈', category: 'life', categoryLabel: '생활/건강', title: '인플레이션 구매력 계산기', titleShort: '구매력 계산기', description: '현재 금액이 N년 뒤 갖는 실질 구매력을 연 물가상승률로 환산.', keywords: ['인플레이션 계산기','구매력','물가상승률','실질가치'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'inflationCalc', resultLabel: '실질 가치', resultUnit: '원', inputs: [{ id: 'amount', label: '금액', type: 'currency', default: 10000000 }, { id: 'years', label: '기간 (년)', type: 'range', default: 10, min: 1, max: 50 }, { id: 'inflationRate', label: '연 물가상승률 (%)', type: 'percent', default: 3 }], faqs: [
      { q: '구매력 계산기 결과는 정확한가요?', a: '입력한 연 물가상승률이 기간 내내 일정하다고 가정한 추정치입니다. 실제 물가 경로와는 차이가 납니다.' },
      { q: '구매력 계산기는 무료인가요?', a: '네, 카더라 구매력 계산기는 완전 무료이며 회원가입 없이 이용 가능합니다.' },
      { q: '구매력 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 생활/건강 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>인플레이션 구매력 계산기 완벽 가이드</h2><p>현재 금액이 N년 뒤 갖는 실질 구매력을 연 물가상승률로 환산.</p><h2>구매력 계산기 계산 방식</h2><p>실질 가치 = 금액 ÷ (1 + 연 물가상승률)^기간 입니다. 물가상승률이 기간 내내 일정하다고 가정하며, 구매력 감소분 = 명목 금액 − 실질 가치 로 보여줍니다.</p><h2>이런 분들에게 추천</h2><p>예금·연금·노후자금이 물가 상승으로 얼마나 가치가 줄어드는지 가늠하려는 분에게 유용합니다.</p>', relatedCalcs: ['compound-interest', 'fire-calc'] },
  // 법률 +4
  { slug: 'consolation-money', emoji: '💔', category: 'law', categoryLabel: '법률/가정', title: '위자료 계산기', titleShort: '위자료 계산기', description: '이혼 시 위자료 예상 금액을 추정.', keywords: ['위자료 계산기','이혼 위자료','위자료 금액'], legalBasis: '민법 제843조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'consolationMoney', resultLabel: '예상 위자료', resultUnit: '원', inputs: [{ id: 'marriageYears', label: '혼인 기간 (년)', type: 'number', default: 10 }, { id: 'faultDegree', label: '유책 정도', type: 'select', default: 'medium', options: [{ value: 'low', label: '경미' }, { value: 'medium', label: '보통' }, { value: 'high', label: '중대 (외도 등)' }] }, { id: 'income', label: '유책 배우자 연소득', type: 'currency', default: 60000000 }], faqs: [
      { q: '위자료 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 민법 제843조를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '위자료 계산기에서 가장 중요한 입력값은?', a: '이혼 시 위자료 예상 금액을 추정. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '위자료 계산기는 무료인가요?', a: '네, 카더라 위자료 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '위자료 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 법률/가정 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>위자료 계산기 완벽 가이드</h2><p>이혼 시 위자료 예상 금액을 추정. 카더라 위자료 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>민법 제843조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>법률/가정 핵심 정보</h2><p>양육비는 산정기준표에 따라 양육자 소득·자녀 나이를 기준으로 결정됩니다. 위자료, 재산분할 비율은 혼인 기간, 유책 사유에 따라 달라집니다. 정확한 금액은 변호사 상담을 권장합니다.</p><h2>이런 분들에게 추천</h2><p>정확한 법률/가정 계산이 필요한 분에게 유용합니다. 카더라는 법률/가정 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['child-support'] },

  { slug: 'property-division', emoji: '⚖️', category: 'law', categoryLabel: '법률/가정', title: '이혼 재산분할 계산기', titleShort: '재산분할 계산기', description: '이혼 시 재산분할 비율과 금액을 추정.', keywords: ['재산분할','이혼 재산','분할 비율'], legalBasis: '민법 제839조의2', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'propertyDivision', resultLabel: '분할 금액', resultUnit: '원', inputs: [{ id: 'totalAssets', label: '부부 공동재산', type: 'currency', default: 500000000 }, { id: 'ratio', label: '분할 비율 (%)', type: 'percent', default: 50 }], faqs: [
      { q: '재산분할 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '재산분할 계산기에서 가장 중요한 입력값은?', a: '이혼 시 재산분할 비율과 금액을 추정. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '재산분할 계산기는 무료인가요?', a: '네, 카더라 재산분할 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '재산분할 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 법률/가정 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>이혼 재산분할 계산기 완벽 가이드</h2><p>이혼 시 재산분할 비율과 금액을 추정.</p><p>본 계산기는 <strong>민법 제839조의2</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>재산분할 계산기 계산 방식</h2><p>분할 금액 = 부부 공동재산 × 입력한 분할 비율 입니다. 혼인 기간·기여도로 분할 비율을 추정하지는 않으므로 비율은 직접 넣어야 합니다.</p><h2>이런 분들에게 추천</h2><p>정확한 법률/가정 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['consolation-money', 'child-support'] },
  { slug: 'statute-of-limitations', emoji: '⏳', category: 'law', categoryLabel: '법률/가정', title: '소멸시효 계산기', titleShort: '소멸시효 계산기', description: '채권·채무의 소멸시효 만료일을 계산.', keywords: ['소멸시효','채권 시효','시효 만료','소멸시효 기간'], legalBasis: '민법 제162조', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'statuteOfLimitations', resultLabel: '소멸시효 만료일', resultUnit: '', inputs: [{ id: 'startDate', label: '채권 발생일', type: 'date', default: '2020-01-01' }, { id: 'type', label: '채권 유형', type: 'select', default: '10', options: [{ value: '10', label: '일반채권 (10년)' }, { value: '5', label: '상사채권 (5년)' }, { value: '3', label: '임금/퇴직금 (3년)' }, { value: '1', label: '일용직 임금 (1년)' }] }], faqs: [
      { q: '소멸시효 계산기 결과는 정확한가요?', a: '2026년 최신 기준 반영이지만, 개인 상황에 따라 차이가 있습니다. 민법 제162조를 기준으로 계산합니다. 전문가 상담을 권장합니다.' },
      { q: '소멸시효 계산기에서 가장 중요한 입력값은?', a: '채권·채무의 소멸시효 만료일을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '소멸시효 계산기는 무료인가요?', a: '네, 카더라 소멸시효 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '소멸시효 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 법률/가정 포함 142종의 무료 계산기를 제공합니다.' },
    ], seoContent: '<h2>소멸시효 계산기 완벽 가이드</h2><p>채권·채무의 소멸시효 만료일을 계산. 카더라 소멸시효 계산기는 2026년 최신 기준을 반영하여 정확한 결과를 제공합니다.</p><p>본 계산기는 <strong>민법 제162조</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>법률/가정 핵심 정보</h2><p>양육비는 산정기준표에 따라 양육자 소득·자녀 나이를 기준으로 결정됩니다. 위자료, 재산분할 비율은 혼인 기간, 유책 사유에 따라 달라집니다. 정확한 금액은 변호사 상담을 권장합니다.</p><h2>이런 분들에게 추천</h2><p>정확한 법률/가정 계산이 필요한 분에게 유용합니다. 카더라는 법률/가정 포함 142종의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: [] },

  { slug: 'industrial-accident', emoji: '🏗️', category: 'law', categoryLabel: '법률/가정', title: '산재 보상금 계산기', titleShort: '산재 보상금', description: '산업재해 시 휴업급여·장해급여를 추정.', keywords: ['산재 보상','산업재해','휴업급여','장해급여'], legalBasis: '산업재해보상보험법', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'industrialAccident', resultLabel: '보상금 추정', resultUnit: '원', inputs: [{ id: 'dailyWage', label: '평균임금 (일당)', type: 'currency', default: 150000 }, { id: 'restDays', label: '휴업일수', type: 'number', default: 60 }, { id: 'disabilityGrade', label: '장해 등급', type: 'select', default: '0', options: [{ value: '0', label: '장해 없음' }, { value: '14', label: '14급' }, { value: '12', label: '12급' }, { value: '10', label: '10급' }, { value: '7', label: '7급' }, { value: '4', label: '4급' }, { value: '1', label: '1급' }] }], faqs: [
      { q: '산재 보상금 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '산재 보상금에서 가장 중요한 입력값은?', a: '산업재해 시 휴업급여·장해급여를 추정. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '산재 보상금는 무료인가요?', a: '네, 카더라 산재 보상금는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '산재 보상금는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 법률/가정 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>산재 보상금 계산기 완벽 가이드</h2><p>산업재해 시 휴업급여·장해급여를 추정.</p><p>본 계산기는 <strong>산업재해보상보험법</strong>를 기준으로 계산합니다. 규정은 매년 개정될 수 있으므로 전문가 확인을 권장합니다.</p><h2>산재 보상금 계산 방식</h2><p>휴업급여 = 평균임금(일당) × 70% × 휴업일수, 장해급여 = 평균임금 × 장해 등급별 지급일수(일시금 가정) 로 계산해 더합니다. 등급별 일수는 계산기에 설정된 표를 쓰며 법정 일수표와의 대조는 결과를 확정하기 전에 근로복지공단에서 확인하세요. 최저보상기준·연금 선택은 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>정확한 법률/가정 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['accident-compensation'] },
  // 군대/교육 +2
  { slug: 'tuition-loan', emoji: '🎓', category: 'military', categoryLabel: '군대/교육', title: '대학 등록금 대출 계산기', titleShort: '등록금 대출', description: '학기별 등록금 대출 시 총 상환액을 계산.', keywords: ['등록금 대출','학자금','대학 등록금','학비 대출'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'amortize', formula: 'loanRepayment', resultLabel: '월 상환액', resultUnit: '원', inputs: [{ id: 'principal', label: '총 대출금', type: 'currency', default: 16000000 }, { id: 'rate', label: '이자율 (%)', type: 'percent', default: 1.7 }, { id: 'years', label: '상환 기간 (년)', type: 'range', default: 10, min: 1, max: 20 }, { id: 'method', label: '상환 방식', type: 'radio', default: 'equal', options: [{ value: 'equal', label: '원리금균등' }, { value: 'principal', label: '원금균등' }] }, { id: 'grace', label: '거치기간 (개월)', type: 'number', default: 0, hint: '현재 계산에는 반영하지 않는다' }], faqs: [
      { q: '등록금 대출 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '등록금 대출에서 가장 중요한 입력값은?', a: '학기별 등록금 대출 시 총 상환액을 계산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '등록금 대출는 무료인가요?', a: '네, 카더라 등록금 대출는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '등록금 대출는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>대학 등록금 대출 계산기 완벽 가이드</h2><p>학기별 등록금 대출 시 총 상환액을 계산.</p><h2>등록금 대출 계산 방식</h2><p>원리금균등은 매달 같은 상환액을, 원금균등은 첫 달 상환액(원금 ÷ 개월 + 원금 × 월이율)과 총 이자를 계산합니다. 월이율은 이자율 ÷ 12 입니다. 거치기간 입력은 현재 계산에 반영하지 않습니다.</p><h2>이런 분들에게 추천</h2><p>등록금 대출 상환 계획을 세우려는 대학생·학부모에게 유용합니다. 본 계산기는 참고용입니다.</p>', relatedCalcs: ['student-loan'] },

  { slug: 'csat-grade', emoji: '📝', category: 'military', categoryLabel: '군대/교육', title: '수능 등급컷 계산기', titleShort: '수능 등급 계산기', description: '원점수로 수능 예상 등급을 확인.', keywords: ['수능 등급컷','수능 등급','원점수','등급 환산'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'csatGrade', resultLabel: '예상 등급', resultUnit: '등급', inputs: [{ id: 'score', label: '원점수', type: 'number', default: 85, min: 0, max: 100 }, { id: 'subject', label: '과목', type: 'select', default: 'korean', options: [{ value: 'korean', label: '국어' }, { value: 'math', label: '수학' }, { value: 'english', label: '영어' }] }], faqs: [
      { q: '수능 등급 계산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '수능 등급 계산기에서 가장 중요한 입력값은?', a: '원점수로 수능 예상 등급을 확인. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '수능 등급 계산기는 무료인가요?', a: '네, 카더라 수능 등급 계산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '수능 등급 계산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 군대/교육 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>수능 등급컷 계산기 완벽 가이드</h2><p>원점수로 수능 예상 등급을 확인.</p><h2>수능 등급 계산기 계산 방식</h2><p>영어는 90점 이상 1등급부터 10점 간격 절대평가 구간을 적용합니다. 국어·수학은 고정된 원점수 구간으로 등급을 근사합니다. 실제 국어·수학 등급은 매 시험의 표준점수 분포로 정해지므로 크게 다를 수 있습니다.</p><h2>이런 분들에게 추천</h2><p>가채점 원점수로 대략적인 등급을 가늠하려는 수험생에게 유용합니다. 본 계산기는 참고용입니다.</p>', relatedCalcs: ['gpa-convert'] },
  // 쇼핑 +1
  { slug: 'point-convert', emoji: '🎯', category: 'shopping', categoryLabel: '쇼핑/소비', title: '카드 포인트 환산기', titleShort: '포인트 환산기', description: '카드 포인트의 현금 가치를 환산.', keywords: ['카드 포인트','포인트 환산','적립 포인트','마일리지'], legalBasis: '', version: '2026.04', lastUpdated: '2026-04-05', pattern: 'simple', formula: 'pointConvert', resultLabel: '현금 가치', resultUnit: '원', inputs: [{ id: 'points', label: '포인트', type: 'number', default: 50000 }, { id: 'ratio', label: '1포인트 가치 (원)', type: 'number', default: 1, step: 0.1, min: 0.1, max: 100 }], faqs: [
      { q: '포인트 환산기 결과는 정확한가요?', a: '참고용 계산이며, 개인 상황에 따라 실제와 차이가 있을 수 있습니다. 전문가 상담을 권장합니다.' },
      { q: '포인트 환산기에서 가장 중요한 입력값은?', a: '카드 포인트의 현금 가치를 환산. 정확한 수치를 입력할수록 결과 신뢰도가 높아집니다.' },
      { q: '포인트 환산기는 무료인가요?', a: '네, 카더라 포인트 환산기는 완전 무료이며 회원가입 없이 무제한 이용 가능합니다.' },
      { q: '포인트 환산기는 모바일에서도 되나요?', a: '네, 모든 기기에서 최적화되어 있으며 앱 설치 없이 사용 가능합니다.' },
      { q: '관련 계산기가 더 있나요?', a: '카더라는 쇼핑/소비 외에도 여러 분야의 무료 계산기를 제공합니다. 페이지 아래 관련 계산기를 함께 확인하세요.' },
    ], seoContent: '<h2>카드 포인트 환산기 완벽 가이드</h2><p>카드 포인트의 현금 가치를 환산.</p><h2>포인트 환산기 계산 방식</h2><p>현금 가치 = 포인트 × 1포인트 가치(원) 입니다. 카드사·사용처별 전환 비율은 직접 입력해야 합니다.</p><h2>이런 분들에게 추천</h2><p>정확한 쇼핑/소비 계산이 필요한 분에게 유용합니다. 카더라는 여러 분야의 무료 계산기를 제공하며, 계산 결과를 카카오톡으로 공유할 수 있습니다. 본 계산기는 참고용이며 전문가 상담을 권장합니다.</p>', relatedCalcs: ['discount-calc'] },

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

/**
 * 이슈 점수 산정 엔진 — 부동산 + 주식 통합
 *
 * 최종점수 = 기본점수 × 증폭계수 × (1 - 감점률)
 * 60+ → 자동 발행 | 40~59 → 초안 저장 | 25~39 → 로그만 | ~24 → 무시
 */

/* ═══════════ 타입 ═══════════ */

export interface IssueCandidate {
  title: string;
  summary: string;
  category: 'apt' | 'stock' | 'policy' | 'market' | 'finance' | 'tax' | 'economy' | 'life';
  sub_category?: string;
  issue_type: string;
  source_type: string;
  source_urls: string[];
  detected_keywords: string[];
  related_entities: string[];
  raw_data: Record<string, any>;
}

export interface ScoreResult {
  base_score: number;
  multiplier: number;
  penalty_rate: number;
  final_score: number;
  is_auto_publish: boolean;
  breakdown: Record<string, number>;
  block_reason?: string;
}

/* ═══════════ 키워드 사전 ═══════════ */

export const APT_HOT_KEYWORDS = [
  // 로또급 (weight 3)
  '무순위', '줍줍', '로또청약', '시세차익', '재분양', '불법행위재공급', '계약취소', '분양가상한제', '로또분양',
  // 시장 충격 (weight 2)
  '신고가', '역대', '사상최고', '사상최저', '급등', '급락', '폭등', '폭락', '패닉',
  // 정책 (weight 2)
  '규제', '대출규제', '양도세', '종부세', '취득세', 'DSR', 'LTV', '전매제한', '거주의무',
  // 이슈 (weight 2)
  '전세사기', '깡통전세', '역전세', '건설사부도', '워크아웃', '재건축', '재개발', '관리처분',
  // 공급 (weight 1)
  '청약', '분양', '미분양', '입주', '당첨', '경쟁률',
] as const;

export const STOCK_HOT_KEYWORDS = [
  // 실적 (weight 3)
  '실적', '영업이익', '매출', '서프라이즈', '어닝쇼크', '컨센서스', '흑자전환', '적자전환',
  // 이벤트 (weight 3)
  'M&A', '합병', '인수', '유상증자', '무상증자', '액면분할', '자사주', '소각', '배당', '상장폐지', '관리종목', 'IPO',
  // 시장 (weight 2)
  '상한가', '하한가', '급등', '급락', '폭등', '폭락', '서킷브레이커', '사이드카', '공매도',
  // 테마 (weight 1)
  'AI', '반도체', '2차전지', '로봇', '바이오', '방산', '원전', '수소', '자율주행',
  // 매크로 (weight 2)
  '금리', '기준금리', '인하', '인상', '환율', '금융위', 'FOMC',
] as const;

export const FINANCE_HOT_KEYWORDS = [
  '예금 금리', '적금 금리', '정기예금', '특판', '금리 인상', '금리 인하',
  '전세대출', '주담대', '신용대출', '학자금대출', '디딤돌', '보금자리론',
  'ISA', 'ETF', '배당주', '고배당', 'S&P500', 'SCHD', 'VOO',
  '적립식 투자', '분할매수', '리밸런싱',
  '국민연금', '퇴직연금', 'IRP', '연금저축', '개인연금',
  '실손보험', '보험료 인상', '자동차보험',
] as const;

export const TAX_HOT_KEYWORDS = [
  '양도소득세', '종합부동산세', '취득세', '재산세', '임대소득세',
  '종합소득세', '근로소득세', '사업소득세', '프리랜서 세금',
  '연말정산', '소득공제', '세액공제', '의료비 공제', '교육비 공제',
  '월세 공제', '기부금 공제', '연금저축 공제',
  '증여세', '상속세', '증여 공제', '10년 합산',
  '세제 개편', '세법 개정', '국세청', '세무조사',
] as const;

export const ECONOMY_HOT_KEYWORDS = [
  '기준금리', 'FOMC', '연준', '금통위', 'CPI', 'GDP', '고용률',
  '원달러', '환율', '달러 강세', '엔화', '위안화',
  '금값', '유가', '국제유가', 'WTI', '원유',
  '경기침체', '스태그플레이션', '인플레이션', '디플레이션',
  '무역수지', '경상수지',
] as const;

export const LIFE_HOT_KEYWORDS = [
  '최저시급', '최저임금', '주 52시간', '육아휴직', '실업급여',
  '퇴직금', '연차 수당', '야근 수당',
  '자동차세', '전기차 보조금', '하이브리드',
  '건강보험료', '국민연금 인상', '4대보험',
  '전기요금', '가스요금', '수도요금',
  '수능', '대입', '학자금', '장학금',
  '군 복무 기간', '병사 월급',
] as const;

const KEYWORD_WEIGHT: Record<string, number> = {
  '무순위': 3, '줍줍': 3, '로또청약': 3, '시세차익': 3, '불법행위재공급': 3,
  '전세사기': 3, '건설사부도': 3, '상장폐지': 3, '서킷브레이커': 3,
  '신고가': 2, '급등': 2, '급락': 2, '양도세': 2, '종부세': 2, 'M&A': 3,
  '상한가': 2, '하한가': 2, '기준금리': 2, 'FOMC': 2, '유상증자': 2,
};

/* ═══════════ 부동산 기본점수 ═══════════ */

function scoreAptCheongak(data: Record<string, any>): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;

  // 시세차익 (최대 40)
  const gap = data.price_gap_억 || 0;
  if (gap >= 10) { b['시세차익10억+'] = 40; score += 40; }
  else if (gap >= 5) { b['시세차익5~10억'] = 35; score += 35; }
  else if (gap >= 3) { b['시세차익3~5억'] = 30; score += 30; }
  else if (gap >= 2) { b['시세차익2~3억'] = 22; score += 22; }
  else if (gap >= 1) { b['시세차익1~2억'] = 15; score += 15; }
  else if (gap >= 0.5) { b['시세차익5천~1억'] = 8; score += 8; }
  else { b['시세차익5천미만'] = 3; score += 3; }

  // 공급유형 (최대 10)
  const type = data.supply_type || '';
  if (type.includes('불법') || type.includes('재공급')) { b['불법행위재공급'] = 10; score += 10; }
  else if (type.includes('무순위')) { b['무순위'] = 8; score += 8; }
  else if (type.includes('특별')) { b['특별공급'] = 5; score += 5; }
  else { b['일반공급'] = 3; score += 3; }

  // 단지규모 (최대 6)
  const units = data.total_units || 0;
  if (units >= 5000) { b['5000세대+'] = 6; score += 6; }
  else if (units >= 3000) { b['3000세대+'] = 5; score += 5; }
  else if (units >= 1000) { b['1000세대+'] = 3; score += 3; }
  else { b['소규모'] = 1; score += 1; }

  // 브랜드 (최대 4)
  const brand1 = ['삼성물산', '현대건설', 'DL이앤씨', 'GS건설', '대우건설', 'HDC', '래미안', '자이', '푸르지오', '아이파크', '이편한세상', '힐스테이트'];
  if (brand1.some(b1 => (data.builder || '').includes(b1))) { b['1군시공'] = 4; score += 4; }

  return { score: Math.min(score, 60), breakdown: b };
}

function scoreAptPrice(data: Record<string, any>): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;

  const changeRate = data.change_rate || 0; // %
  if (Math.abs(changeRate) >= 20) { b['급변동20%+'] = 30; score += 30; }
  else if (Math.abs(changeRate) >= 10) { b['급변동10~20%'] = 20; score += 20; }
  else if (Math.abs(changeRate) >= 5) { b['급변동5~10%'] = 12; score += 12; }

  if (data.is_region_leader) { b['지역대장주'] = 15; score += 15; }
  if (data.volume_spike) { b['거래량급증'] = 10; score += 10; }

  // 지역 가중치
  const region = data.region || '';
  if (region.includes('강남') || region.includes('서초') || region.includes('송파')) { b['강남3구'] = 10; score += 10; }
  else if (region.includes('서울')) { b['서울'] = 8; score += 8; }
  else if (['세종', '과천', '성남'].some(r => region.includes(r))) { b['주요지역'] = 7; score += 7; }
  else if (['부산', '대구', '인천'].some(r => region.includes(r))) { b['광역시'] = 5; score += 5; }
  else { b['기타지역'] = 2; score += 2; }

  return { score: Math.min(score, 60), breakdown: b };
}

function scoreAptPolicy(data: Record<string, any>): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;

  if (data.scope === 'national') { b['전국적용'] = 25; score += 25; }
  else if (data.scope === 'capital') { b['수도권'] = 18; score += 18; }
  else { b['지역한정'] = 8; score += 8; }

  const type = data.policy_type || '';
  if (['양도세', '종부세', '취득세'].some(t => type.includes(t))) { b['세금변경'] = 25; score += 25; }
  else if (['대출', 'LTV', 'DSR'].some(t => type.includes(t))) { b['대출규제'] = 22; score += 22; }
  else if (['청약', '가점', '특공'].some(t => type.includes(t))) { b['청약제도'] = 20; score += 20; }
  else if (['전매', '거주의무'].some(t => type.includes(t))) { b['전매거주'] = 18; score += 18; }
  else { b['기타정책'] = 10; score += 10; }

  return { score: Math.min(score, 60), breakdown: b };
}

/* ═══════════ 주식 기본점수 ═══════════ */

function scoreStockPrice(data: Record<string, any>): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;

  // 등락폭
  const change = Math.abs(data.change_pct || 0);
  if (change >= 20 || data.is_limit) { b['상하한가급'] = 35; score += 35; }
  else if (change >= 15) { b['15%+'] = 28; score += 28; }
  else if (change >= 10) { b['10~15%'] = 20; score += 20; }
  else if (change >= 5) { b['5~10%'] = 12; score += 12; }
  else if (change >= 3) { b['3~5%'] = 5; score += 5; }

  // 거래량
  const volRatio = data.volume_ratio || 1; // vs 20일 평균
  if (volRatio >= 10) { b['거래량1000%'] = 15; score += 15; }
  else if (volRatio >= 5) { b['거래량500%'] = 12; score += 12; }
  else if (volRatio >= 3) { b['거래량300%'] = 8; score += 8; }

  // 연속성
  if (data.consecutive_days >= 5) { b['5일연속'] = 10; score += 10; }
  else if (data.consecutive_days >= 3) { b['3일연속'] = 8; score += 8; }
  else if (data.consecutive_days >= 2) { b['2일연속'] = 5; score += 5; }

  // 종목 등급
  const grade = data.stock_grade || 'F';
  const gradeScore: Record<string, number> = { S: 15, A: 12, B: 8, C: 6, D: 4, E: 2, F: 0, 'US-S': 12, 'US-A': 8 };
  const gs = gradeScore[grade] || 0;
  if (gs) { b[`등급${grade}`] = gs; score += gs; }

  return { score: Math.min(score, 60), breakdown: b };
}

function scoreStockEvent(data: Record<string, any>): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;

  const eventType = data.event_type || '';
  const eventScores: Record<string, number> = {
    'earnings_beat_30': 30, 'earnings_beat_20': 22, 'earnings_beat_10': 15,
    'earnings_miss_30': 30, 'earnings_miss_20': 22, 'earnings_miss_10': 15,
    'ma': 30, 'rights_issue_large': 25, 'bonus_issue': 18, 'stock_split': 18,
    'buyback': 15, 'major_shareholder': 22, 'delisting_review': 28,
    'dividend_surprise': 15, 'new_business': 12, 'cbw': 10,
  };
  const es = eventScores[eventType] || 0;
  if (es) { b[eventType] = es; score += es; }

  // 종목 등급 가산
  const grade = data.stock_grade || 'F';
  const gradeScore: Record<string, number> = { S: 15, A: 12, B: 8, C: 6, D: 4, E: 2, F: 0 };
  const gs = gradeScore[grade] || 0;
  if (gs) { b[`등급${grade}`] = gs; score += gs; }

  return { score: Math.min(score, 60), breakdown: b };
}

function scoreStockSector(data: Record<string, any>): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;

  const count = data.sector_move_count || 0; // 동시 움직인 종목 수
  if (count >= 5) { b['섹터5개+동시'] = 22; score += 22; }
  else if (count >= 3) { b['섹터3~4개'] = 15; score += 15; }

  if (data.is_policy_theme) { b['정책테마'] = 25; score += 25; }
  if (data.is_overseas_linked) { b['해외연동'] = 18; score += 18; }
  if (data.is_new_theme) { b['신규테마'] = 20; score += 20; }

  return { score: Math.min(score, 60), breakdown: b };
}

function scoreMarketWide(data: Record<string, any>): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;

  const kospiChange = Math.abs(data.kospi_change || 0);
  if (data.circuit_breaker) { b['서킷브레이커'] = 35; score += 35; }
  else if (kospiChange >= 3) { b['코스피3%+'] = 30; score += 30; }
  else if (kospiChange >= 2) { b['코스피2~3%'] = 20; score += 20; }

  if (Math.abs(data.fx_change || 0) >= 2) { b['환율급변'] = 22; score += 22; }
  if (data.rate_decision_change) { b['기준금리변경'] = 30; score += 30; }

  return { score: Math.min(score, 60), breakdown: b };
}



/* ═══════════ 재테크 기본점수 ═══════════ */

function scoreFinanceEvent(data: Record<string, any>): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;
  const changeRate = Math.abs(data.rate_change_bp || 0); // 금리 변동 bp
  if (changeRate >= 50) { b['금리50bp+'] = 35; score += 35; }
  else if (changeRate >= 25) { b['금리25bp'] = 25; score += 25; }
  else if (changeRate >= 10) { b['금리10bp'] = 15; score += 15; }
  if (data.affects_all_banks) { b['전은행적용'] = 15; score += 15; }
  if (data.is_new_product) { b['신상품'] = 10; score += 10; }
  if (data.has_calculator) { b['계산기연동'] = 5; score += 5; }
  return { score: Math.min(score, 60), breakdown: b };
}

/* ═══════════ 세금 기본점수 ═══════════ */

function scoreTaxPolicy(data: Record<string, any>): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;
  if (data.scope === 'national') { b['전국적용'] = 25; score += 25; }
  else if (data.scope === 'capital') { b['수도권'] = 18; score += 18; }
  else { b['지역한정'] = 8; score += 8; }
  const taxType = data.tax_type || '';
  if (['양도세', '종부세', '취득세'].some(t => taxType.includes(t))) { b['부동산세'] = 25; score += 25; }
  else if (['소득세', '종합소득세', '연말정산'].some(t => taxType.includes(t))) { b['소득세'] = 20; score += 20; }
  else if (['증여세', '상속세'].some(t => taxType.includes(t))) { b['상증세'] = 18; score += 18; }
  else { b['기타세금'] = 10; score += 10; }
  if (data.is_seasonal) { b['시즌'] = 8; score += 8; }
  return { score: Math.min(score, 60), breakdown: b };
}

/* ═══════════ 생활 기본점수 ═══════════ */

function scoreLifeEvent(data: Record<string, any>): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let score = 0;
  if (data.affected_population >= 10000000) { b['1천만+영향'] = 30; score += 30; }
  else if (data.affected_population >= 1000000) { b['백만+영향'] = 22; score += 22; }
  else { b['일반'] = 10; score += 10; }
  if (data.effective_soon) { b['즉시시행'] = 15; score += 15; }
  if (data.has_calculator) { b['계산기연동'] = 8; score += 8; }
  if (data.is_annual_event) { b['연례행사'] = 10; score += 10; }
  return { score: Math.min(score, 60), breakdown: b };
}

/* ═══════════ 증폭계수 ═══════════ */

function calcMultiplier(data: Record<string, any>, category: string): { multiplier: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};
  let m = 1.0;

  // 매체 동시 보도
  const mediaCount = data.media_count || 1;
  if (mediaCount >= 7) { b['매체7+'] = 1.5; m *= 1.5; }
  else if (mediaCount >= 4) { b['매체4~6'] = 1.3; m *= 1.3; }
  else if (mediaCount >= 2) { b['매체2~3'] = 1.15; m *= 1.15; }

  // 카더라 선점 기회
  if (data.existing_posts === 0) { b['선점기회'] = 1.25; m *= 1.25; }
  else if (data.existing_posts_age_days > 30) { b['오래된기사'] = 1.1; m *= 1.1; }

  // 시의성
  if (data.is_breaking) { b['속보'] = 1.3; m *= 1.3; }
  else if (data.is_this_week) { b['이번주'] = 1.1; m *= 1.1; }

  // 검색 트렌드 (있으면)
  if (data.search_spike >= 500) { b['검색500%+'] = 1.4; m *= 1.4; }
  else if (data.search_spike >= 200) { b['검색200%+'] = 1.2; m *= 1.2; }

  // 주식 전용: 장중 감지
  if (category === 'stock' && data.is_market_hours) { b['장중감지'] = 1.3; m *= 1.3; }

  // 주식 전용: DART 공시 동반
  if (category === 'stock' && data.has_dart) { b['공시동반'] = 1.4; m *= 1.4; }

  // 커뮤니티 버즈
  if (data.community_buzz >= 2) { b['커뮤니티버즈'] = 1.15; m *= 1.15; }

  // v2: 교차 포털 검증
  if (data.portal_cross_count >= 3) { b['3포털동시'] = 1.8; m *= 1.8; }
  else if (data.portal_cross_count >= 2) { b['2포털동시'] = 1.5; m *= 1.5; }

  // v2: 계산기 존재
  if (data.has_calculator) { b['계산기연동'] = 1.15; m *= 1.15; }

  // v2: 시즌 피크
  if (data.is_seasonal_peak) { b['시즌피크'] = 1.3; m *= 1.3; }

  // 캡: 최대 ×2.0
  m = Math.min(m, 2.0);

  return { multiplier: Math.round(m * 100) / 100, breakdown: b };
}

/* ═══════════ 감점 ═══════════ */

function calcPenalty(data: Record<string, any>, category: string): { rate: number; block_reason?: string } {
  // 강제 차단 (draft 강등)
  if (data.source_type === 'community' && !data.has_news) {
    return { rate: 0, block_reason: '출처불명_커뮤니티만' };
  }
  if (data.is_sensitive_lawsuit) {
    return { rate: 0, block_reason: '민감_소송건' };
  }

  // 주식: 작전주 의심
  if (category === 'stock' && data.market_cap_억 < 3000 && !data.has_news && data.volume_ratio > 5) {
    return { rate: 0, block_reason: '작전주_의심' };
  }
  // 주식: 스팸성 테마주
  if (category === 'stock' && data.is_spam_theme) {
    return { rate: 0.4, block_reason: undefined }; // 40% 감점
  }
  // 주식: 바이오 임상 루머
  if (category === 'stock' && data.is_bio_rumor) {
    return { rate: 0.5, block_reason: undefined };
  }
  // 주식: 정치 테마주
  if (category === 'stock' && data.is_political_theme) {
    return { rate: 0.5, block_reason: undefined };
  }

  // 부동산: 홍보성 기사
  if (category === 'apt' && data.is_promotional) {
    return { rate: 0.5, block_reason: undefined };
  }

  // 단일 소스 + 트렌드 변화 없음
  if ((data.media_count || 1) <= 1 && !data.search_spike) {
    return { rate: 0.3, block_reason: undefined };
  }

  return { rate: 0 };
}

/* ═══════════ 메인 스코어링 함수 ═══════════ */

export function scoreIssue(candidate: IssueCandidate): ScoreResult {
  const { category, issue_type, raw_data } = candidate;

  // 1. 기본점수
  let baseResult: { score: number; breakdown: Record<string, number> };

  if (category === 'apt') {
    if (['lotto_cheongak', 'cheongak', 'resupply'].includes(issue_type)) {
      baseResult = scoreAptCheongak(raw_data);
    } else if (['new_high', 'price_change', 'volume_spike'].includes(issue_type)) {
      baseResult = scoreAptPrice(raw_data);
    } else if (['policy_change', 'regulation'].includes(issue_type)) {
      baseResult = scoreAptPolicy(raw_data);
    } else {
      baseResult = { score: 15, breakdown: { 기타: 15 } };
    }
  } else if (category === 'stock') {
    if (['price_surge', 'price_drop', 'limit_hit'].includes(issue_type)) {
      baseResult = scoreStockPrice(raw_data);
    } else if (['earnings', 'dart_disclosure', 'ma', 'rights_issue'].includes(issue_type)) {
      baseResult = scoreStockEvent(raw_data);
    } else if (['sector_move', 'theme', 'policy_beneficiary'].includes(issue_type)) {
      baseResult = scoreStockSector(raw_data);
    } else {
      baseResult = { score: 15, breakdown: { 기타: 15 } };
    }
  } else if (category === 'market' || category === 'economy') {
    baseResult = scoreMarketWide(raw_data);
  } else if (category === 'finance') {
    baseResult = scoreFinanceEvent(raw_data);
  } else if (category === 'tax') {
    baseResult = scoreTaxPolicy(raw_data);
  } else if (category === 'life') {
    baseResult = scoreLifeEvent(raw_data);
  } else {
    baseResult = scoreAptPolicy(raw_data); // policy fallback
  }

  // 2. 증폭계수
  const multResult = calcMultiplier(raw_data, category);

  // 3. 감점
  const penalty = calcPenalty(raw_data, category);

  // 강제 차단인 경우
  if (penalty.block_reason && penalty.rate === 0 && penalty.block_reason !== undefined) {
    // block_reason이 있고 rate가 0이면 = 강제 draft 강등
    const rawScore = Math.round(baseResult.score * multResult.multiplier);
    return {
      base_score: baseResult.score,
      multiplier: multResult.multiplier,
      penalty_rate: 0,
      final_score: rawScore,
      is_auto_publish: false, // 강제 draft
      breakdown: { ...baseResult.breakdown, ...multResult.breakdown },
      block_reason: penalty.block_reason,
    };
  }

  // 4. 최종 계산
  const rawScore = baseResult.score * multResult.multiplier * (1 - penalty.rate);
  const finalScore = Math.min(Math.round(rawScore), 100);

  return {
    base_score: baseResult.score,
    multiplier: multResult.multiplier,
    penalty_rate: penalty.rate,
    final_score: finalScore,
    is_auto_publish: finalScore >= 60 && !penalty.block_reason,
    breakdown: { ...baseResult.breakdown, ...multResult.breakdown, ...(penalty.rate > 0 ? { [`감점${penalty.rate * 100}%`]: -penalty.rate } : {}) },
    block_reason: penalty.block_reason,
  };
}

/* ═══════════ 키워드 매칭 유틸 ═══════════ */

export function extractKeywords(text: string): { apt: string[]; stock: string[]; finance: string[]; tax: string[]; economy: string[]; life: string[] } {
  const apt = APT_HOT_KEYWORDS.filter(k => text.includes(k));
  const stock = STOCK_HOT_KEYWORDS.filter(k => text.includes(k));
  const finance = FINANCE_HOT_KEYWORDS.filter(k => text.includes(k));
  const tax = TAX_HOT_KEYWORDS.filter(k => text.includes(k));
  const economy = ECONOMY_HOT_KEYWORDS.filter(k => text.includes(k));
  const life = LIFE_HOT_KEYWORDS.filter(k => text.includes(k));
  return { apt: [...apt], stock: [...stock], finance: [...finance], tax: [...tax], economy: [...economy], life: [...life] };
}

export function keywordWeight(keywords: string[]): number {
  return keywords.reduce((sum, k) => sum + (KEYWORD_WEIGHT[k] || 1), 0);
}

/* ═══════════ 이슈 유형 자동 판별 ═══════════ */

export function detectIssueType(keywords: string[], category: string): string {
  if (category === 'apt') {
    if (keywords.some(k => ['무순위', '줍줍', '로또청약', '불법행위재공급', '재분양'].includes(k))) return 'lotto_cheongak';
    if (keywords.some(k => ['신고가', '급등', '급락', '폭등', '폭락'].includes(k))) return 'price_change';
    if (keywords.some(k => ['양도세', '종부세', '취득세', 'DSR', 'LTV', '규제', '대출규제'].includes(k))) return 'policy_change';
    if (keywords.some(k => ['전세사기', '깡통전세', '역전세'].includes(k))) return 'jeonse_crisis';
    if (keywords.some(k => ['재건축', '재개발', '관리처분'].includes(k))) return 'redevelopment';
    if (keywords.some(k => ['미분양'].includes(k))) return 'unsold';
    if (keywords.some(k => ['청약', '분양', '경쟁률'].includes(k))) return 'cheongak';
    return 'apt_general';
  } else if (category === 'stock') {
    if (keywords.some(k => ['실적', '영업이익', '매출', '서프라이즈', '어닝쇼크'].includes(k))) return 'earnings';
    if (keywords.some(k => ['M&A', '합병', '인수'].includes(k))) return 'ma';
    if (keywords.some(k => ['유상증자'].includes(k))) return 'rights_issue';
    if (keywords.some(k => ['상한가', '하한가', '급등', '급락'].includes(k))) return 'price_surge';
    if (keywords.some(k => ['서킷브레이커', '사이드카'].includes(k))) return 'circuit_breaker';
    if (keywords.some(k => ['금리', '기준금리', 'FOMC'].includes(k))) return 'rate_decision';
    if (keywords.some(k => ['상장폐지', '관리종목'].includes(k))) return 'delisting_review';
    if (keywords.some(k => ['공매도'].includes(k))) return 'short_selling';
    if (keywords.some(k => ['IPO'].includes(k))) return 'ipo';
    return 'stock_general';
  } else if (category === 'finance') {
    if (keywords.some(k => ['예금 금리', '적금 금리', '특판', '정기예금'].includes(k))) return 'deposit_rate';
    if (keywords.some(k => ['전세대출', '주담대', '신용대출', '디딤돌', '보금자리론'].includes(k))) return 'loan_product';
    if (keywords.some(k => ['ISA', 'ETF', '배당주', '적립식 투자'].includes(k))) return 'investment_product';
    if (keywords.some(k => ['국민연금', '퇴직연금', 'IRP'].includes(k))) return 'pension';
    return 'finance_general';
  } else if (category === 'tax') {
    if (keywords.some(k => ['양도소득세', '종합부동산세', '취득세', '재산세'].includes(k))) return 'property_tax';
    if (keywords.some(k => ['종합소득세', '근로소득세', '연말정산'].includes(k))) return 'income_tax';
    if (keywords.some(k => ['증여세', '상속세'].includes(k))) return 'inheritance_tax';
    return 'tax_general';
  } else if (category === 'economy') {
    if (keywords.some(k => ['기준금리', 'FOMC', '금통위'].includes(k))) return 'rate_decision';
    if (keywords.some(k => ['환율', '원달러', '달러 강세'].includes(k))) return 'fx_change';
    if (keywords.some(k => ['금값', '유가', 'WTI'].includes(k))) return 'commodity';
    if (keywords.some(k => ['CPI', 'GDP', '고용률'].includes(k))) return 'macro_indicator';
    return 'economy_general';
  } else if (category === 'life') {
    if (keywords.some(k => ['최저시급', '최저임금'].includes(k))) return 'minimum_wage';
    if (keywords.some(k => ['육아휴직', '실업급여', '퇴직금'].includes(k))) return 'labor_benefit';
    if (keywords.some(k => ['자동차세', '전기차 보조금'].includes(k))) return 'auto_policy';
    if (keywords.some(k => ['건강보험료', '4대보험'].includes(k))) return 'insurance';
    return 'life_general';
  }
}

/* ═══════════ AI 기사 템플릿 판별 ═══════════ */

export function selectDraftTemplate(category: string, issueType: string): string {
  const templates: Record<string, Record<string, string>> = {
    apt: {
      lotto_cheongak: 'apt_lotto', cheongak: 'apt_cheongak', resupply: 'apt_lotto',
      price_change: 'apt_price', new_high: 'apt_price',
      policy_change: 'apt_policy', regulation: 'apt_policy',
      jeonse_crisis: 'apt_jeonse', unsold: 'apt_unsold',
      redevelopment: 'apt_redev', apt_general: 'apt_general',
    },
    stock: {
      earnings: 'stock_earnings', price_surge: 'stock_price', price_drop: 'stock_price',
      limit_hit: 'stock_price', ma: 'stock_event', rights_issue: 'stock_event',
      delisting_review: 'stock_event', sector_move: 'stock_sector', theme: 'stock_sector',
      policy_beneficiary: 'stock_policy', rate_decision: 'stock_macro',
      circuit_breaker: 'stock_market', ipo: 'stock_ipo', stock_general: 'stock_general',
    },
    market: { '*': 'stock_market' },
    policy: { '*': 'apt_policy' },
    finance: {
      deposit_rate: 'finance_rate', loan_product: 'finance_loan',
      investment_product: 'finance_invest', pension: 'finance_pension',
      finance_general: 'finance_general', '*': 'finance_general',
    },
    tax: {
      property_tax: 'tax_property', income_tax: 'tax_income',
      inheritance_tax: 'tax_inheritance', tax_general: 'tax_general', '*': 'tax_general',
    },
    economy: {
      rate_decision: 'economy_rate', fx_change: 'economy_fx',
      commodity: 'economy_commodity', macro_indicator: 'economy_macro',
      economy_general: 'economy_general', '*': 'economy_general',
    },
    life: {
      minimum_wage: 'life_wage', labor_benefit: 'life_labor',
      auto_policy: 'life_auto', insurance: 'life_insurance',
      life_general: 'life_general', '*': 'life_general',
    },
  };
  return templates[category]?.[issueType] || templates[category]?.['*'] || 'general';
}

/**
 * 블로그 프롬프트 다양화 시스템 v2
 * 8 스타일 × 4 구조 = 32가지 조합
 * AI 생성 패턴 감지 방지를 위한 핵심 모듈
 */

// ── 8 스타일 ──
const STYLES = [
  '전문가 칼럼. 증권사 애널리스트처럼 분석적이고 객관적인 톤.',
  '친근한 해설자. 어려운 용어를 쉽게 풀어 독자에게 말 거는 톤.',
  '데이터 저널리스트. 숫자 중심 팩트 위주, 건조하지만 신뢰감 있는 톤.',
  '경험 많은 투자자가 후배에게 조언하는 스타일. 실전 팁 중심.',
  '경제 유튜버 대본 스타일. 핵심을 간결하게, 비유와 예시로 쉽게.',
  '비교 분석가 스타일. 장단점을 균형있게, 표와 수치 적극 활용.',
  '현장 리포트 스타일. 실제 조사한 것처럼 생생하고 구체적인 묘사.',
  '인사이트 중심. "왜 이 데이터가 중요한지" 맥락 중심 해설.',
];

// ── 4 구조 ──
const STRUCTURES = [
  '서사형: 도입(왜 이 주제가 중요한지)→문제 제기→데이터 분석→결론. 소제목 4~6개. FAQ 없음.',
  '비교형: 핵심 수치 먼저→장점 vs 단점 표→유사 대상 비교→종합 판단. 소제목 5~7개. FAQ 하단 3개.',
  'Q&A형: 독자가 궁금해할 질문 5~7개를 던지고 각각 답하는 형식. 소제목 = 질문. 별도 FAQ 없음.',
  '데이터형: 3줄 핵심 요약→데이터 테이블→해석→맥락 설명→전망. 소제목 3~5개. FAQ 중간 2개.',
];

// ── 면책 문구 변형 ──
const DISCLAIMERS = [
  '> 이 글은 정보 제공 목적이며 투자 조언이 아닙니다. 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.',
  '> 본 콘텐츠는 참고 자료이며, 특정 자산의 매수·매도를 권유하지 않습니다.',
  '> 작성 시점의 데이터 기준이며, 실제와 차이가 있을 수 있습니다. 최신 정보는 공식 기관에서 확인하세요.',
  '> 투자에는 원금 손실 위험이 있습니다. 충분한 검토 후 신중하게 결정하시기 바랍니다.',
  '> 이 분석은 공개된 데이터에 기반하며, 미래 성과를 보장하지 않습니다.',
];

// ── 내부 링크 세트 (카테고리별) ──
const LINK_SETS: Record<string, string[][]> = {
  stock: [
    ['[실시간 시세 →](/stock)', '[종목 비교 →](/stock/compare)', '[커뮤니티 토론 →](/feed)', '[블로그 →](/blog)', '[관심종목 등록 →](/stock)'],
    ['[코스피 시세 →](/stock?market=KOSPI)', '[나스닥 종목 →](/stock?market=NASDAQ)', '[주식 블로그 →](/blog?category=stock)', '[토론방 →](/feed)', '[포트폴리오 →](/stock)'],
    ['[오늘의 시세 →](/stock)', '[ETF 비교 →](/stock/compare)', '[투자 커뮤니티 →](/feed)', '[분석 글 더 보기 →](/blog)', '[종합 시세 →](/stock)'],
  ],
  apt: [
    ['[청약 일정 →](/apt)', '[가점 계산 →](/apt/diagnose)', '[미분양 현황 →](/apt?tab=unsold)', '[블로그 →](/blog)', '[커뮤니티 →](/feed)'],
    ['[분양 정보 →](/apt)', '[실거래가 조회 →](/apt?tab=transaction)', '[재개발 현황 →](/apt?tab=redev)', '[부동산 블로그 →](/blog?category=apt)', '[토론 →](/feed)'],
    ['[청약 가이드 →](/apt)', '[단지 정보 →](/apt/sites)', '[미분양 아파트 →](/apt?tab=unsold)', '[관련 분석 →](/blog)', '[질문하기 →](/feed)'],
  ],
  unsold: [
    ['[미분양 현황 →](/apt?tab=unsold)', '[청약 정보 →](/apt)', '[블로그 →](/blog)', '[커뮤니티 →](/feed)', '[가점 계산 →](/apt/diagnose)'],
  ],
  finance: [
    ['[주식 시세 →](/stock)', '[부동산 정보 →](/apt)', '[블로그 →](/blog)', '[커뮤니티 →](/feed)', '[종합 비교 →](/stock/compare)'],
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getRandomStyle(): string {
  return pick(STYLES);
}

export function getRandomStructure(): string {
  return pick(STRUCTURES);
}

/**
 * AI 프롬프트에 스타일 다양화 지시를 추가 (v2: 32가지 조합)
 */
export function diversifyPrompt(basePrompt: string): string {
  const disclaimer = pick(DISCLAIMERS);
  const category = basePrompt.includes('카테고리: stock') ? 'stock'
    : basePrompt.includes('카테고리: apt') ? 'apt'
    : basePrompt.includes('카테고리: unsold') ? 'unsold' : 'finance';
  const links = pick(LINK_SETS[category] || LINK_SETS.finance);
  const includeFaq = Math.random() < 0.4; // 40% 확률로만 FAQ 포함

  return `${basePrompt}

[다양화 지시]
- 도입부는 매번 다른 방식으로 시작하세요. "~를 분석했습니다" 같은 정형화된 문장 금지.
- 소제목(##)의 순서와 표현을 매번 다르게 하세요.
- 면책 문구: ${disclaimer}
- 내부 링크 (반드시 5개 모두 본문에 자연스럽게 삽입): ${links.join(', ')}
${includeFaq ? '- FAQ 섹션을 포함하세요 (### ❓ 형식, 3~5개)' : '- FAQ 섹션은 이번 글에서는 생략하세요.'}`;
}

/**
 * blog-daily 하드코딩 템플릿용 도입부 변형
 * 매번 다른 도입 문장을 반환
 */
export function getRandomOpening(category: string): string {
  const stockOpenings = [
    '오늘 시장은 어땠을까요? 주요 종목들의 움직임을 데이터로 살펴봅니다.',
    '장이 마감됐습니다. 오늘 하루 어떤 종목이 움직였는지 정리합니다.',
    '투자자라면 매일 체크해야 할 시세 동향, 오늘의 핵심만 모았습니다.',
    '데이터가 말하는 오늘의 시장. 숫자로 확인하세요.',
    '오늘 장을 한 눈에. 주요 지표와 종목 변동을 정리했습니다.',
    '시장의 온도를 재봅니다. 상승과 하락, 그 사이의 기회.',
    '변동성 속에서 방향을 찾으려면 데이터를 봐야 합니다.',
    '매일 쌓이는 시세 데이터, 오늘의 의미를 짚어봅니다.',
  ];
  
  const aptOpenings = [
    '부동산 시장은 숫자가 답합니다. 실거래 데이터를 분석합니다.',
    '이 단지, 지금 사도 될까? 실거래가로 객관적으로 판단해봅니다.',
    '실거래가는 시장의 진짜 목소리입니다. 데이터를 들여다봅니다.',
    '아파트 투자의 첫 걸음은 데이터 분석입니다. 핵심을 정리합니다.',
    '숫자를 알면 흐름이 보입니다. 최신 실거래 데이터를 분석합니다.',
    '가격은 결국 거래에서 결정됩니다. 실제 체결 데이터를 봅니다.',
    '이 지역 시세가 궁금하셨나요? 실거래 기반으로 답합니다.',
    '투자에 정답은 없지만, 데이터는 방향을 알려줍니다.',
  ];

  const financeOpenings = [
    '현명한 자산관리를 위한 핵심 정보를 정리했습니다.',
    '돈에 대해 알수록 돈이 모입니다. 실용적 팁을 공유합니다.',
    '재테크 기본기를 다져야 큰 그림이 보입니다.',
    '투자 초보도 바로 실행할 수 있는 가이드입니다.',
  ];

  const map: Record<string, string[]> = { stock: stockOpenings, apt: aptOpenings, finance: financeOpenings, unsold: aptOpenings };
  return pick(map[category] || financeOpenings);
}

/**
 * AI 생성 투자 콘텐츠 사전 필터
 * 
 * 자본시장법상 "유사투자자문업" 경계 표현을 자동 감지·제거·치환.
 * 모든 AI 크론(stock-daily-briefing, blog-stock-v2, earnings 등)의
 * 출력을 이 필터를 통과시킨 후 DB에 저장한다.
 *
 * 원칙:
 * - "정보 제공"은 허용, "매매 권유"는 금지
 * - 숫자·팩트 기반 서술은 허용, 방향성 확정 표현은 금지
 * - 불확실성 표현("~할 수 있다", "~가능성") 권장
 */

// ─── 금지 패턴 (매매 권유·확신 표현) ───

const FORBIDDEN_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // 직접 매수/매도 권유
  { pattern: /매수\s*추천/g, replacement: '매수 관심 종목' },
  { pattern: /매도\s*추천/g, replacement: '매도 관심 종목' },
  { pattern: /강력\s*매수/g, replacement: '관심 매수' },
  { pattern: /강력\s*매도/g, replacement: '관심 매도' },
  { pattern: /지금\s*(당장\s*)?(사|매수|매입)/g, replacement: '현재 주목할 만한' },
  { pattern: /지금\s*(당장\s*)?(팔|매도)/g, replacement: '현재 주의가 필요한' },
  { pattern: /(반드시|꼭|무조건)\s*(사|매수|매입)/g, replacement: '주목할 필요가 있는' },
  { pattern: /(반드시|꼭|무조건)\s*(팔|매도)/g, replacement: '주의 깊게 살펴볼' },
  { pattern: /사세요/g, replacement: '관심을 가져볼 만합니다' },
  { pattern: /파세요/g, replacement: '주의가 필요합니다' },
  { pattern: /담으세요/g, replacement: '주목해 보세요' },
  { pattern: /물타세요/g, replacement: '추가 매수 여부를 검토해 보세요' },
  { pattern: /손절하세요/g, replacement: '손실 관리를 검토해 보세요' },

  // 수익 확정 표현
  { pattern: /확실(한|히)\s*(수익|이익|상승|급등)/g, replacement: '가능성 있는 $2' },
  { pattern: /반드시\s*(상승|하락|급등|급락)/g, replacement: '$1 가능성' },
  { pattern: /100%\s*(상승|수익|성공)/g, replacement: '$1 가능성' },
  { pattern: /원금\s*보장/g, replacement: '원금 변동 가능' },
  { pattern: /수익\s*보장/g, replacement: '수익 가능성' },
  { pattern: /무위험/g, replacement: '상대적 저위험' },
  { pattern: /리스크\s*(없|zero|제로)/g, replacement: '리스크 제한적' },

  // 타이밍 확정
  { pattern: /지금이\s*기회/g, replacement: '현재 주목할 시점' },
  { pattern: /지금\s*아니면\s*늦/g, replacement: '현재 관심을 가져볼' },
  { pattern: /마지막\s*기회/g, replacement: '주목할 시점' },
  { pattern: /놓치면\s*후회/g, replacement: '관심을 가져볼 만한' },
  { pattern: /바닥\s*(확인|찍|완료)/g, replacement: '바닥 가능성 논의' },
  { pattern: /천장\s*(확인|찍|돌파\s*확정)/g, replacement: '고점 논의' },

  // 목표가 확정
  { pattern: /목표(주가|가)\s*(\d[\d,.]*)\s*(원|달러|불)\s*(확실|확정|달성)/g, replacement: '목표가 $2$3 전망' },
  { pattern: /(\d[\d,.]*)\s*(원|달러|불)\s*간다/g, replacement: '$1$2 가능성' },

  // N배 확정
  { pattern: /(\d+)\s*배\s*(확정|확실|보장)/g, replacement: '$1배 가능성' },
  { pattern: /텐배거\s*(확정|확실)/g, replacement: '텐배거 가능성' },

  // 전문가 사칭
  { pattern: /전문가\s*(추천|선정|엄선)/g, replacement: '주목 종목' },
  { pattern: /VIP\s*(추천|종목)/g, replacement: '주목 종목' },
  { pattern: /비밀\s*(종목|정보|리포트)/g, replacement: '분석 종목' },
  { pattern: /내부\s*정보/g, replacement: '시장 분석' },
];

// ─── 경고 패턴 (완전 금지는 아니지만 문맥 주의) ───

const WARNING_PATTERNS = [
  /매수\s*타이밍/,
  /매도\s*타이밍/,
  /진입\s*(시점|타이밍)/,
  /청산\s*(시점|타이밍)/,
  /저점\s*매수/,
  /고점\s*매도/,
  /분할\s*매수\s*(추천|권유)/,
];

// ─── 메인 필터 함수 ───

export interface SanitizeResult {
  /** 정화된 텍스트 */
  text: string;
  /** 치환된 패턴 수 */
  replacementCount: number;
  /** 치환 상세 로그 */
  replacements: { original: string; replaced: string }[];
  /** 경고 패턴 감지 여부 */
  warnings: string[];
}

export function sanitizeAiContent(rawText: string): SanitizeResult {
  let text = rawText;
  const replacements: { original: string; replaced: string }[] = [];
  let replacementCount = 0;

  for (const { pattern, replacement } of FORBIDDEN_PATTERNS) {
    // 패턴을 새로 만들어서 global flag 유지
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        const replaced = match.replace(new RegExp(pattern.source, ''), replacement);
        replacements.push({ original: match, replaced });
        replacementCount++;
      }
      text = text.replace(regex, replacement);
    }
  }

  // 경고 패턴 감지
  const warnings: string[] = [];
  for (const wp of WARNING_PATTERNS) {
    const match = text.match(wp);
    if (match) {
      warnings.push(`경고 표현 감지: "${match[0]}"`);
    }
  }

  return { text, replacementCount, replacements, warnings };
}

/**
 * AI 콘텐츠에 표준 면책 문구를 강제 삽입
 * 블로그 포스트 본문 하단에 자동으로 추가
 */
export const INVESTMENT_DISCLAIMER_KO = `
> **투자 유의사항** | 본 콘텐츠는 정보 제공 목적으로 작성되었으며, 특정 금융상품의 매매를 권유하지 않습니다. 투자 판단의 최종 책임은 투자자 본인에게 있으며, 카더라는 투자 결과에 대해 어떠한 책임도 지지 않습니다. 과거 수익률이 미래 수익률을 보장하지 않습니다.
`.trim();

/**
 * 블로그 콘텐츠에 면책 문구가 없으면 자동 추가
 */
export function ensureDisclaimer(content: string): string {
  if (content.includes('투자 유의사항') || content.includes('투자 권유가 아닙니다')) {
    return content;
  }
  return `${content}\n\n${INVESTMENT_DISCLAIMER_KO}`;
}

/**
 * AI 생성 콘텐츠 전체 파이프라인
 * sanitize → disclaimer 삽입 → 반환
 */
export function processAiInvestmentContent(rawText: string): {
  content: string;
  sanitizeResult: SanitizeResult;
} {
  const sanitizeResult = sanitizeAiContent(rawText);
  const content = ensureDisclaimer(sanitizeResult.text);
  return { content, sanitizeResult };
}

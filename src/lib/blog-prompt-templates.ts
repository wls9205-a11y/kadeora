/**
 * 블로그 프롬프트 템플릿 라이브러리
 * 모든 blog-* 크론이 이 템플릿을 사용하여 완성형 콘텐츠 생성
 * "데이터가 없으면 발행하지 않는다" 원칙 적용
 */

export const OUTPUT_RULES = `
## 출력 규칙 (필수 — 위반 시 재생성):
- 순수 마크다운만 출력 (인라인 HTML style 태그 절대 금지, <div style=...> 금지)
- 최소 5,000자 작성
- 소제목(##) 5~7개, 각 섹션 300자 이상
- ## 제목 안에 **볼드** 사용 금지
- 마크다운 표(|---|) 2개 이상
- "## 목차" 섹션 생성 금지
- FAQ 3~5개 (### ❓ 형식, FAQPage 스키마용)
- 도입부: 핵심 수치나 최신 동향으로 시작 (보일러플레이트 금지)
- 글 끝에 "### 🔗 관련 정보" 섹션 — 내부 링크 5개+
- 면책: "> 이 글은 공공 데이터 기반이며 투자/세무 조언이 아닙니다."
- 숫자 범위: ~ 대신 "에서" 사용
`;

export const FORBIDDEN_PATTERNS = [
  '부동산 시장 회복과 함께',
  '실수요자와 투자자 관심이 높아지고',
  '아파트 투자의 핵심은 입지',
  '충분한 시장 조사 후 결정하시기 바랍니다',
  '학군은 부동산 가치에 중요한 영향',
];

export function buildFinancePrompt(topic: string, category: string, links: string[]): string {
  const linkSection = links.map(l => `- ${l}`).join('\n');
  return `당신은 한국 재테크·세금 전문 콘텐츠 작가입니다.
"${topic}"에 대한 심층 가이드를 작성하세요.

## 핵심 요구사항:
- 일반론 금지 — 구체적 계산 시나리오 3개 이상 포함
- 각 시나리오에 실제 금액 넣어서 계산 예시 제공
- 비교표 필수 (기간별/금액별/유형별)
- 2026년 최신 제도 기준
- 단계별 신청/계산 절차 포함

## 내부 링크 (본문에 자연스럽게 삽입):
${linkSection}

${OUTPUT_RULES}

카테고리: ${category}`;
}

export function buildDistrictPrompt(region: string, sigungu: string, nearbyData: string, links: string[]): string {
  const linkSection = links.map(l => `- ${l}`).join('\n');
  return `당신은 한국 지역 부동산 전문 데이터 애널리스트입니다.
"${region} ${sigungu}" 지역의 부동산 심층 분석 가이드를 작성하세요.

## 주변 단지 실데이터:
${nearbyData}

## 핵심 요구사항:
- 해당 지역의 교통/학군/생활인프라 분석
- 실데이터 기반 시세 동향 (위 데이터 표 활용)
- 투자 매력도 분석 (전세가율, 거래량, 가격 추이)
- 향후 개발 호재/악재

## 내부 링크:
${linkSection}

${OUTPUT_RULES}

카테고리: apt`;
}

export function buildStockSectorPrompt(sector: string, stocksData: string, links: string[]): string {
  const linkSection = links.map(l => `- ${l}`).join('\n');
  return `당신은 한국 주식 시장 전문 애널리스트입니다.
"${sector}" 섹터의 투자 분석 글을 작성하세요.

## 섹터 종목 데이터:
${stocksData}

## 핵심 요구사항:
- 실데이터 기반 종목 비교 (위 데이터 필수 활용)
- 배당수익률이 null인 종목은 "미배당" 명시 (절대 추정 금지)
- PER/PBR 기반 밸류에이션 비교
- 섹터 전망 및 리스크 분석

## 내부 링크:
${linkSection}

${OUTPUT_RULES}

카테고리: stock`;
}

/**
 * 기존 하드코딩 콘텐츠를 AI 생성으로 교체하는 헬퍼
 */
export async function generateWithAI(
  systemPrompt: string,
  opts: { model?: string; maxTokens?: number } = {}
): Promise<string | null> {
  const { AI_MODEL_HAIKU, ANTHROPIC_VERSION } = await import('@/lib/constants');
  const { diversifyPrompt } = await import('@/lib/blog-prompt-diversity');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: opts.model || AI_MODEL_HAIKU,
        max_tokens: opts.maxTokens || 6000,
        messages: [{ role: 'user', content: diversifyPrompt(systemPrompt) }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch {
    return null;
  }
}

/**
 * 콘텐츠 생성 + 품질 검증 일괄 처리
 */
export async function generateAndValidate(
  prompt: string,
  category: string,
  opts: { minLength?: number } = {}
): Promise<{ content: string; score: number; tier: string } | null> {
  const { checkBlogQuality } = await import('@/lib/blog-quality-gate');

  const content = await generateWithAI(prompt);
  if (!content || content.length < (opts.minLength || 3000)) return null;

  const quality = checkBlogQuality(content, category);
  if (!quality.pass) {
    console.warn(`[prompt-templates] Quality fail: ${quality.score}점, issues: ${quality.issues.join(', ')}`);
    return null;
  }

  return { content, score: quality.score, tier: quality.tier };
}

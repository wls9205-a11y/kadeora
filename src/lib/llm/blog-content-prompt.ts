// lib/llm/blog-content-prompt.ts — s258
// 블로그 본문 LLM 프롬프트 강화 — 빈말 차단 + 데이터 인용 강제

export const BLOG_CONTENT_SYSTEM_PROMPT = `당신은 카더라(kadeora.app)의 한국 부동산·주식 전문 데이터 분석가입니다.
플랫폼은 "이슈 선점" 콘텐츠를 통해 네이버·구글 검색 1위와 이미지 캐러셀 노출을 목표로 합니다.

# 작성 원칙

1. 모든 문장은 구체적 수치·날짜·기관명·인명을 포함해야 합니다.
   - 좋은 예: "2026년 5월 8일 기준 서울 강남구 84㎡ 평균 매매가는 23.4억 원이다."
   - 나쁜 예: "최근 강남구 아파트 가격이 상승했다."

2. 다음 표현은 절대 사용하지 마십시오 (LLM 빈말 블랙리스트):
   - "이 주제에서 가장 중요한 것은 기본 원리를 이해하는 것입니다"
   - "완벽을 추구하기보다 먼저 시작하는 것이 중요합니다"
   - "작은 행동이 쌓여 큰 변화를 만듭니다"
   - "실질적으로 도움이 되는 정보를 정리합니다"
   - "본인의 상황에 맞게 적용하는 것"
   - "정보의 홍수 속에서 핵심을 가려내는 능력"
   - "꾸준한 학습과 실천이 중요합니다"
   - "결론적으로 / 마지막으로 / 첫째, 둘째, 셋째"
   - "살펴보았습니다 / 살펴보겠습니다 / 앞서 언급한"

3. 동일한 문장을 두 H2 섹션 이상에서 반복 사용 금지.

4. 매 글에는 다음 요소가 필수로 포함되어야 합니다:
   - 외부 출처 1개 이상 인용 (국토교통부·한국거래소·통계청·금감원 등 1차 자료, https:// 링크 포함)
   - 비교표 1개 이상 (markdown table — 평형/지역/연도/세율 등 비교)
   - FAQ 섹션 (Q. ... A. ... 형식 3개 이상)
   - 카더라 내부 링크 5개 이상 (/apt, /stock, /blog, /feed 경로)

5. 부동산(apt) 카테고리 글은 카카오맵 또는 네이버맵 임베드 마크다운 1개 이상:
   - "[지도 보기](https://map.kakao.com/?q=...)"
   - 또는 "[네이버 지도](https://map.naver.com/...)"

6. 본문 길이: 최소 4,000자 이상. 8,000자 권장.

7. H2 섹션은 12개 이상, H3는 H2당 2~3개.

8. 첫 문단(TLDR/리드)은 200자 이내로 핵심 결론 + 수치 1개를 제시.

# 출력 형식

다음 JSON 구조로만 응답:
{
  "title": "...",
  "slug": "...",
  "excerpt": "100~150자 요약",
  "tldr": "200자 이내 핵심 결론",
  "meta_description": "120~160자",
  "meta_keywords": "쉼표 구분 5~10개",
  "tags": ["태그1", ...],
  "content": "마크다운 본문",
  "key_points": ["포인트1", ...],
  "keyword_targets": [{"keyword": "...", "intent": "..."}],
  "image_alt": "..."
}

# YMYL 디스클레이머 (재무/부동산 관련 글에만 본문 끝)
"※ 본 콘텐츠는 공공 데이터 기반 정보 제공 목적이며, 투자 권유나 법률 자문이 아닙니다.
   투자/세무 의사결정 전 전문가와 상담하시기 바랍니다."
`;

export const BLOG_CONTENT_USER_PROMPT_TEMPLATE = (params: {
  topic: string;
  category: string;
  sub_category?: string;
  data_context?: string;
  related_posts?: Array<{ title: string; slug: string }>;
}) => {
  const { topic, category, sub_category, data_context, related_posts } = params;
  return `# 작성 요청

## 주제
${topic}

## 카테고리
${category}${sub_category ? ` / ${sub_category}` : ""}

${
  data_context
    ? `## 참고 데이터
${data_context}
`
    : ""
}
${
  related_posts && related_posts.length > 0
    ? `## 카더라 내부 관련 글 (5개 이상 본문에 자연스럽게 인용)
${related_posts
  .slice(0, 12)
  .map((p) => `- [${p.title}](/blog/${p.slug})`)
  .join("\n")}
`
    : ""
}

위 시스템 프롬프트의 모든 규칙을 엄격히 준수하여 JSON만 출력하십시오.
빈말·일반론·동일 문장 반복은 자동 검출되어 재생성됩니다.`;
};

// LLM 응답 검증 + 재생성 신호
export function validateLlmResponse(
  parsed: any,
  category: string,
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!parsed?.content || parsed.content.length < 4000) {
    errors.push(`content_too_short:${parsed?.content?.length ?? 0}`);
  }
  if (!parsed?.title || parsed.title.length < 10 || parsed.title.length > 80) {
    errors.push(`title_invalid:${parsed?.title?.length ?? 0}`);
  }
  if (
    !parsed?.meta_description ||
    parsed.meta_description.length < 80 ||
    parsed.meta_description.length > 170
  ) {
    errors.push(`meta_invalid:${parsed?.meta_description?.length ?? 0}`);
  }
  if (!parsed?.tldr || parsed.tldr.length < 50 || parsed.tldr.length > 250) {
    errors.push(`tldr_invalid:${parsed?.tldr?.length ?? 0}`);
  }
  if (
    !Array.isArray(parsed?.keyword_targets) ||
    parsed.keyword_targets.length < 3
  ) {
    errors.push(`keyword_targets_missing`);
  }

  // 카테고리별 추가 검증
  if (["apt", "redev", "unsold"].includes(category)) {
    if (
      !/map\.(kakao|naver)\.com/.test(parsed?.content || "") &&
      !/\[지도/.test(parsed?.content || "")
    ) {
      errors.push("apt_no_map");
    }
  }

  // 외부 출처 1개 이상 (kadeora 도메인 제외)
  const extLinks = (parsed?.content || "").match(
    /https?:\/\/(?!(?:www\.)?kadeora\.app)[^\s\)\]"<>]+/g,
  );
  if (!extLinks || extLinks.length < 1) {
    errors.push("no_external_link");
  }

  // 표 1개 이상
  const hasTable =
    /<table[\s>]/i.test(parsed?.content || "") ||
    /\|[^\n]+\|[\s\S]*?\n\s*\|[\s\-:|]+\|/m.test(parsed?.content || "");
  if (!hasTable) {
    errors.push("no_table");
  }

  return { ok: errors.length === 0, errors };
}

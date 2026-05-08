// lib/llm/post-process.ts — s258
// LLM 빈말/일반론/반복 검출 → 재생성 신호 + quality_score 차감용 카운트 반환

const LLM_FILLER_PATTERNS: { re: RegExp; weight: number; tag: string }[] = [
  // 일반론 빈말
  { re: /이 주제에서 가장 중요한 것은\s*기본 원리/g, weight: 10, tag: "filler:basic_principle" },
  { re: /완벽을 추구하기보다 먼저 시작하는 것이 중요합니다/g, weight: 10, tag: "filler:start_first" },
  { re: /작은 행동이 쌓여 큰 변화를 만듭니다/g, weight: 10, tag: "filler:small_action" },
  { re: /정보의 홍수 속에서 핵심을 가려내는 능력이 필요합니다/g, weight: 10, tag: "filler:info_flood" },
  { re: /실질적으로 도움이 되는 정보를 정리합니다/g, weight: 8,  tag: "filler:practical_info" },
  { re: /본인의 상황에 맞게 적용하는 것/g, weight: 8,  tag: "filler:apply_to_yourself" },
  { re: /꾸준한 학습과 실천이 중요합니다/g, weight: 8,  tag: "filler:steady_practice" },
  { re: /전문가와 상담하시기 바랍니다/g, weight: 5,  tag: "filler:consult_expert" }, // 합법 디스클레이머지만 과다 사용 시 감점
  // LLM 흔적 어구
  { re: /살펴보았습니다\.|살펴보겠습니다\./g, weight: 4, tag: "llm:exam" },
  { re: /결론적으로,?\s/g, weight: 3, tag: "llm:in_conclusion" },
  { re: /마지막으로,?\s/g, weight: 3, tag: "llm:finally" },
  { re: /첫째,\s[\s\S]+?둘째,\s[\s\S]+?셋째,/g, weight: 5, tag: "llm:first_second_third" },
  { re: /앞서\s*언급(?:한|했|드린)/g, weight: 4, tag: "llm:as_mentioned" },
  // 템플릿 누수
  { re: /\bTODO\b|\bTBD\b/g, weight: 20, tag: "leak:todo" },
  { re: /undefined|\bNaN\b|\bnull\b(?!ish)/g, weight: 20, tag: "leak:js_atom" },
  { re: /\{\{[^}]+\}\}|\[\[[^\]]+\]\]/g, weight: 20, tag: "leak:placeholder" },
  // 동일 문장 반복 ("X에 대해 실질적으로 도움이 되는 정보를 정리합니다" 같은 게 H2별 반복)
];

export type LlmQualityCheck = {
  hits: { tag: string; count: number; weight: number }[];
  total_penalty: number;          // quality_score 차감 권장치 (0~100)
  has_repeated_sentences: boolean; // 같은 문장이 2번 이상 등장하면 true
  needs_regeneration: boolean;    // total_penalty >= 30 면 재생성 권장
};

export function checkBlogContent(content: string): LlmQualityCheck {
  if (!content) {
    return {
      hits: [],
      total_penalty: 0,
      has_repeated_sentences: false,
      needs_regeneration: false,
    };
  }

  const hits: LlmQualityCheck["hits"] = [];
  let total = 0;
  for (const p of LLM_FILLER_PATTERNS) {
    const matches = content.match(p.re);
    if (matches && matches.length > 0) {
      hits.push({ tag: p.tag, count: matches.length, weight: p.weight });
      total += matches.length * p.weight;
    }
  }

  // 동일 문장 반복 검출 — 한국어 마침표 기준 분리, 30자 이상 문장만
  const sentences = content
    .split(/(?<=[\.\?\!])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 200);
  const seen = new Map<string, number>();
  let repeatedCount = 0;
  for (const s of sentences) {
    const key = s.replace(/\s+/g, " ");
    const c = (seen.get(key) || 0) + 1;
    seen.set(key, c);
    if (c >= 2) repeatedCount++;
  }
  if (repeatedCount > 0) {
    hits.push({
      tag: "repeat:duplicate_sentence",
      count: repeatedCount,
      weight: 15,
    });
    total += repeatedCount * 15;
  }

  return {
    hits,
    total_penalty: Math.min(total, 100),
    has_repeated_sentences: repeatedCount > 0,
    needs_regeneration: total >= 30,
  };
}

// 외부링크 유무 (E-A-T 가중) — 카더라 자체 도메인 제외
export function countExternalLinks(content: string): number {
  if (!content) return 0;
  const matches = content.match(/https?:\/\/(?!(?:www\.)?kadeora\.app)[^\s\)\]"<>]+/g);
  return matches ? matches.length : 0;
}

// 본문 표(table) 유무 — markdown table 또는 <table>
export function hasTable(content: string): boolean {
  if (!content) return false;
  if (/<table[\s>]/i.test(content)) return true;
  // markdown table: 헤더 행 + 구분선 (---|---) 패턴
  if (/\|[^\n]+\|[\s\S]*?\n\s*\|[\s\-:|]+\|/m.test(content)) return true;
  return false;
}

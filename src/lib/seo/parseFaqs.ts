/**
 * 세션 147 A — FAQ 파서 v2. 블록 식별 + 3패턴 병렬 매칭.
 *
 * 블록 식별:
 *   "## FAQ" 또는 "## 자주 묻는 질문" (❓ 이모지 접두사 허용)
 *   다음 H2("## ") 또는 "---" 구분자 전까지.
 *
 * 패턴 A — H3 Q + A (답변 다음 줄):
 *   ### Q. 질문
 *   A. 답변텍스트 (다음 ### 또는 --- 전까지)
 *
 * 패턴 B — H3 + ❓:
 *   ### ❓ 질문
 *   답변텍스트
 *
 * 패턴 C — Bold Q + A:
 *   **Q. 질문**
 *   A. 답변텍스트
 */

export interface FaqItem { q: string; a: string; idx?: number; }

const FAQ_SECTION_START = /^##\s*(?:❓\s*)?(?:자주\s*묻는\s*질문|FAQ|Q\s*&\s*A)/im;
const SECTION_TERMINATOR = /\n(?:##\s|---\s*$|\n##\s)/;

function findFaqBlock(md: string): string | null {
  if (!md) return null;
  // 블록 시작 탐색 — H2 우선
  const h2Match = md.match(FAQ_SECTION_START);
  let startIdx = -1;
  if (h2Match && h2Match.index != null) {
    startIdx = h2Match.index;
  } else {
    // ❓ 이모지 단독 마커
    const emojiIdx = md.search(/^\s*❓\s*자주\s*묻는\s*질문/im);
    if (emojiIdx >= 0) startIdx = emojiIdx;
  }
  if (startIdx < 0) return null;

  // 블록 끝 — 다음 H2 또는 --- 세퍼레이터
  const tail = md.slice(startIdx + 20);
  const endRel = tail.search(/\n##\s|\n---\s*\n/);
  const endIdx = endRel >= 0 ? startIdx + 20 + endRel : md.length;
  return md.slice(startIdx, endIdx);
}

/** 패턴 A: H3 Q 헤더 + 다음 줄 A. 답변 */
function extractPatternA(block: string): FaqItem[] {
  const out: FaqItem[] = [];
  const re = /^###\s*(?!❓)(?:Q\.?\s*)?([^\n]+)\n+(?:A\.?\s*)?([^\n][\s\S]*?)(?=\n###\s|\n##\s|\n---|\n$|$)/gm;
  for (const m of block.matchAll(re)) {
    const q = m[1]?.trim() || '';
    const a = m[2]?.trim().replace(/\n+/g, ' ').slice(0, 1500) || '';
    if (q.length >= 4 && a.length >= 10) out.push({ q, a });
    if (out.length >= 12) break;
  }
  return out;
}

/** 패턴 B: H3 ❓ + 답변 */
function extractPatternB(block: string): FaqItem[] {
  const out: FaqItem[] = [];
  const re = /^###\s*❓\s*([^\n]+)\n+([^\n][\s\S]*?)(?=\n###\s|\n##\s|\n---|\n$|$)/gm;
  for (const m of block.matchAll(re)) {
    const q = m[1]?.trim() || '';
    const a = m[2]?.trim().replace(/\n+/g, ' ').slice(0, 1500) || '';
    if (q.length >= 4 && a.length >= 10) out.push({ q, a });
    if (out.length >= 12) break;
  }
  return out;
}

/** 패턴 C: Bold **Q.** + A. */
function extractPatternC(block: string): FaqItem[] {
  const out: FaqItem[] = [];
  const re = /\*\*Q[.:]?\s*([^*]+?)\*\*\s*\n+(?:A[.:]?\s*)?([^\n][\s\S]*?)(?=\n\s*\*\*Q[.:]?|\n###\s|\n##\s|\n---|\n$|$)/g;
  for (const m of block.matchAll(re)) {
    const q = m[1]?.trim() || '';
    const a = m[2]?.trim().replace(/\n+/g, ' ').slice(0, 1500) || '';
    if (q.length >= 4 && a.length >= 10) out.push({ q, a });
    if (out.length >= 12) break;
  }
  return out;
}

export function parseFaqs(markdown: string): FaqItem[] {
  if (!markdown || markdown.length < 80) return [];

  const block = findFaqBlock(markdown);
  // 블록 없어도 Bold 패턴은 본문 어디에나 있을 수 있으므로 시도
  const source = block || markdown;

  // 3 패턴 병렬 시도, 가장 많이 잡힌 쪽 선택
  const a = extractPatternA(source);
  const b = extractPatternB(source);
  const c = extractPatternC(source);

  // 우선순위 선택 (패턴 A가 가장 엄격 → 먼저 성공하면 선호)
  const candidates = [a, b, c].filter((arr) => arr.length > 0).sort((x, y) => y.length - x.length);
  if (candidates.length === 0) return [];

  const best = candidates[0].slice(0, 10).map((f, i) => ({ ...f, idx: i }));
  return best;
}

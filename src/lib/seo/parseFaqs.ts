/**
 * 세션 146 B3 — 블로그 본문 markdown 에서 FAQ 추출.
 *
 * 매칭 패턴:
 *   ## Q. ... / ### Q. ...        — 접두 Q 기반
 *   ## 자주 묻는 질문              — 섹션 헤더, 이후 Q&A 쌍 수집
 *   ## FAQ                        — 영문 섹션 헤더 동일
 *
 * 각 Q 아래 첫 번째 `A.` 또는 일반 본문 문단을 answer 로 수집.
 */

export interface FaqItem {
  q: string;
  a: string;
}

const Q_HEADER_RE = /^#{2,3}\s*(?:Q\.?\s*|질문\s*[:：]?\s*)(.+?)$/gm;
const FAQ_SECTION_RE = /^#{2,3}\s*(?:자주\s*묻는\s*질문|FAQ|Q\s*&\s*A)\s*$/im;

/** markdown 에서 FAQ 추출. 최대 8개 반환 (JSON-LD 한도 대비). */
export function parseFaqs(markdown: string): FaqItem[] {
  if (!markdown || markdown.length < 50) return [];

  const faqs: FaqItem[] = [];

  // 패턴 1: ## Q. ... 직접 헤더
  const qMatches = Array.from(markdown.matchAll(Q_HEADER_RE));
  for (const m of qMatches) {
    const q = (m[1] || '').trim().replace(/^[\s"'"]+|[\s"'"]+$/g, '');
    if (!q || q.length < 4) continue;
    const idx = m.index! + m[0].length;
    const rest = markdown.slice(idx);
    const aMatch = rest.match(/^\s*\n+(?:A\.?\s*|답\s*[:：]?\s*)?([\s\S]*?)(?=\n#{2,3}\s|\n---|\n$|$)/);
    const a = aMatch ? aMatch[1].trim().replace(/\n+/g, ' ').slice(0, 800) : '';
    if (a.length >= 10) faqs.push({ q, a });
    if (faqs.length >= 8) break;
  }

  if (faqs.length > 0) return faqs;

  // 패턴 2: FAQ 섹션 하위 Q: / A: 쌍
  const sectionIdx = markdown.search(FAQ_SECTION_RE);
  if (sectionIdx < 0) return [];

  const section = markdown.slice(sectionIdx);
  const pairRe = /(?:Q\s*[:：.]?\s*|질문\s*[:：]?\s*)(.+?)\n+(?:A\s*[:：.]?\s*|답\s*[:：]?\s*)([\s\S]+?)(?=\n\s*(?:Q\s*[:：.]?|질문\s*[:：]|#{2,3}\s)|\n$|$)/g;
  const pairMatches = Array.from(section.matchAll(pairRe));
  for (const m of pairMatches) {
    const q = (m[1] || '').trim();
    const a = (m[2] || '').trim().replace(/\n+/g, ' ').slice(0, 800);
    if (q.length >= 4 && a.length >= 10) faqs.push({ q, a });
    if (faqs.length >= 8) break;
  }

  return faqs;
}

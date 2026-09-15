/**
 * EX-A2 ③ — 이슈 원문(기사 본문) 텍스트 추출. 판정만(RULES#143): HTML 문자열을 받아 본문 텍스트를 돌려준다. fetch 는 호출부.
 *
 * 왜: 이슈 글감에는 요약 36자 남짓과 URL 만 있고 원문이 «어디에도 저장되지 않았다»(2026-09-15 실측).
 *     LLM 에게 원문을 주지 않으니 주식·경제 글의 숫자는 모델 기억에서 나왔고, 수치 게이트는 허용할 근거가 없었다.
 * ⚠️ 원문 문장을 그대로 싣지 않는 규칙(「팩트만 추출하여 새 문장」)은 프롬프트가 지킨다 — 여기는 «입력» 만 만든다.
 */

const STRIP_BLOCKS = /<(script|style|noscript|iframe|svg|header|footer|nav|aside|form)[\s\S]*?<\/\1>/gi;

export function extractArticleText(html: string, max = 6000): string {
  const src = String(html ?? '');
  // <article> 가 있으면 그 안만 — 없으면 본문 전체
  const art = /<article[\s\S]*?<\/article>/i.exec(src)?.[0] ?? src;
  const text = art
    .replace(STRIP_BLOCKS, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  // 한 줄에 한글이 거의 없는 줄(메뉴·스크립트 잔재)은 버린다
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length >= 20 && /[가-힣]/.test(l));
  return lines.join('\n').slice(0, max);
}

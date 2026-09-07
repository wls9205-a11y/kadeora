/**
 * JSON-LD 안전 직렬화
 *
 * ⛔ AD-3(2026-09-07) — 정본은 components/seo/JsonLd 다. 이 파일은 그 컴포넌트가
 *    쓰는 «이스케이프 원시함수» 로만 남는다. 페이지에서 직접 부르지 말 것.
 *
 * 문제: <script type="application/ld+json"> 안에 JSON.stringify() 결과를 그대로 넣으면
 *      만약 어떤 값이 "</script>" 문자열 포함하면 script 태그가 닫히고 XSS 가능
 *
 * 해결: '<' 를 '\u003c' 로 escape (JSON 파서는 그대로 인식, HTML 파서는 무시)
 */

export function jsonLdSafe(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
    .replace(/\u2028/g, '\\u2028')  // line separator
    .replace(/\u2029/g, '\\u2029'); // paragraph separator
}

/**
 * JSON-LD 컴포넌트 — 한 줄로 안전하게 사용
 * 
 * 사용 예:
 * <JsonLd data={{ '@context': 'https://schema.org', ... }} />
 */
export function jsonLdScriptProps(obj: unknown): {
  type: 'application/ld+json';
  dangerouslySetInnerHTML: { __html: string };
} {
  return {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: jsonLdSafe(obj) },
  };
}

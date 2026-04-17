/**
 * JSON-LD 안전 직렬화
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

/**
 * sanitize-html — XSS 안전 HTML 정화
 *
 * 이전 버전(regex 블록리스트)은 4가지 페이로드 우회 가능했음:
 *  - <scr<script>ipt>... (nested)
 *  - onerror=alert(1) (unquoted)
 *  - onerror=`alert(1)` (backtick)
 *  - <svg onload=alert(1)> (svg 누락)
 * DOMPurify 로 교체. 미설치 시 강화 regex 폴백.
 *
 * 설치: npm i isomorphic-dompurify  (배포 전 필수)
 */

let DOMPurify: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DOMPurify = require('isomorphic-dompurify');
  if (DOMPurify?.default) DOMPurify = DOMPurify.default;
} catch {
  DOMPurify = null;
}

const ALLOWED_TAGS = [
  'p', 'br', 'span', 'div', 'hr',
  'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'figure', 'figcaption',
  'details', 'summary',
];
const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'rel', 'target',
  'width', 'height', 'style',
  'loading', 'decoding', 'fetchpriority',
  'colspan', 'rowspan', 'datetime',
];

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  if (DOMPurify) {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'meta', 'link', 'base', 'svg'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur', 'oninput', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress'],
    });
  }

  // 폴백 (강화된 regex)
  return fallbackSanitize(html);
}

function fallbackSanitize(html: string): string {
  let s = html;

  // 1) 위험 태그 통째 제거 (svg 포함)
  const dangerousBlocks = [
    /<script\b[^>]*>[\s\S]*?<\/script>/gi,
    /<style\b[^>]*>[\s\S]*?<\/style>/gi,
    /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
    /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
    /<object\b[^>]*>[\s\S]*?<\/object>/gi,
    /<svg\b[\s\S]*?<\/svg>/gi,
    /<form\b[^>]*>[\s\S]*?<\/form>/gi,
    /<button\b[^>]*>[\s\S]*?<\/button>/gi,
    /<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi,
    /<select\b[^>]*>[\s\S]*?<\/select>/gi,
    /<!--[\s\S]*?-->/g,
  ];
  for (const re of dangerousBlocks) s = s.replace(re, '');

  const selfClosing = /<(embed|input|svg|meta|link|base|applet|xml)\b[^>]*\/?>/gi;
  s = s.replace(selfClosing, '');

  // 2) Nested 우회 방지 — 반복 제거
  for (let i = 0; i < 4; i++) {
    const before = s.length;
    s = s.replace(/<\/?script\b[^>]*>/gi, '');
    s = s.replace(/<\/?iframe\b[^>]*>/gi, '');
    s = s.replace(/<\/?svg\b[^>]*>/gi, '');
    if (s.length === before) break;
  }

  // 3) 이벤트 핸들러 (quoted/unquoted/backtick)
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|`[^`]*`|[^\s>]+)/gi, '');

  // 4) javascript:/vbscript:/data: URL
  s = s.replace(/\b(href|src|action|formaction|background)\s*=\s*("|')?\s*(javascript|vbscript|data|file)\s*:[^"'\s>]*("|')?/gi, '$1=""');

  // 5) style 내 expression() / url(javascript:)
  s = s.replace(/expression\s*\([^)]*\)/gi, '');
  s = s.replace(/style\s*=\s*("|')[^"']*url\s*\(\s*(javascript|data|file):/gi, 'style=$1');

  // 6) 외부 링크 nofollow noopener
  s = s.replace(/<a\s+([^>]*?)href\s*=\s*["'](https?:\/\/(?!kadeora\.app)[^"']+)["']([^>]*?)>/gi, (match, pre, url, post) => {
    if (/rel\s*=/i.test(pre + post)) return match;
    return `<a ${pre}href="${url}"${post} rel="nofollow noopener" target="_blank">`;
  });

  return s;
}

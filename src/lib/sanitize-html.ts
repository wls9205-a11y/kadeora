/**
 * 간단한 HTML sanitizer — dangerouslySetInnerHTML에 사용되는 콘텐츠 정화
 * AI 생성 콘텐츠 (analysis_text, blog content)에서 위험한 태그/속성 제거
 */
const DANGEROUS_TAGS = /(<\s*\/?\s*(script|iframe|object|embed|form|input|textarea|button|select|meta|link|base|applet|xml)\b[^>]*>)/gi;
const EVENT_ATTRS = /\s+on\w+\s*=\s*["'][^"']*["']/gi;
const JAVASCRIPT_URLS = /\b(href|src|action)\s*=\s*["']\s*javascript\s*:/gi;
const DATA_URLS = /\b(href|src)\s*=\s*["']\s*data\s*:/gi;

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(DANGEROUS_TAGS, '')
    .replace(EVENT_ATTRS, '')
    .replace(JAVASCRIPT_URLS, '$1="')
    .replace(DATA_URLS, '$1="');
}

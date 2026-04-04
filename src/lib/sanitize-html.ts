/**
 * 경량 서버사이드 HTML 산니타이저
 * isomorphic-dompurify는 jsdom 의존성으로 Vercel에서 500 에러 발생
 * 블로그 콘텐츠는 AI 크론으로 생성되므로 기본 보호만 필요
 */

const _ALLOWED_TAGS = new Set([
  'h1','h2','h3','h4','h5','h6','p','br','strong','em','b','i','u','s','del',
  'a','ul','ol','li','blockquote','pre','code','img','table','thead','tbody',
  'tr','th','td','hr','div','span','sup','sub','figure','figcaption',
]);

const _ALLOWED_ATTRS = new Set([
  'href','src','alt','title','id','class','style','loading','decoding',
  'target','rel','width','height','colspan','rowspan',
]);

// script, iframe, object, embed, form, input 등 위험 태그 제거
const DANGEROUS_TAGS = /(<\s*\/?\s*)(script|iframe|object|embed|form|input|textarea|button|applet|link|meta|base|svg|math|template)(\s[^>]*)?>/gi;

// on* 이벤트 핸들러 속성 제거
const EVENT_HANDLERS = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// javascript: 프로토콜 제거
const JS_PROTOCOL = /(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

// data: URI 제거 (이미지 제외)
const DATA_URI = /(href|action)\s*=\s*(?:"data:[^"]*"|'data:[^']*')/gi;

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  let clean = html;
  
  // 1. 위험 태그 완전 제거
  clean = clean.replace(DANGEROUS_TAGS, '');
  
  // 2. on* 이벤트 핸들러 제거
  clean = clean.replace(EVENT_HANDLERS, '');
  
  // 3. javascript: 프로토콜 제거
  clean = clean.replace(JS_PROTOCOL, '$1=""');
  
  // 4. data: URI 제거 (href, action에서만)
  clean = clean.replace(DATA_URI, '$1=""');
  
  // 5. 외부 링크에 nofollow 추가 (kadeora.app 제외)
  clean = clean.replace(/<a\s([^>]*href\s*=\s*"https?:\/\/(?!kadeora\.app)[^"]*"[^>]*)>/gi, (match, attrs) => {
    if (/rel\s*=/.test(attrs)) return match; // 이미 rel 있으면 스킵
    return `<a ${attrs} rel="nofollow noopener noreferrer" target="_blank">`;
  });
  
  return clean;
}

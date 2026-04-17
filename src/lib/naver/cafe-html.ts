/**
 * 카더라 블로그 HTML → 네이버 카페 안전 HTML 변환
 *
 * 네이버 카페 SmartEditor 호환:
 * - 안전한 태그만 통과 (allowlist)
 * - 위험 속성 제거 (on*, javascript:, data:)
 * - 외부 링크는 nofollow + new window
 * - 카더라 도메인 외 이미지 차단 (hotlink 방지)
 * - UTF-8 안전 (HTML entity 변환 X)
 */

const NAVER_SAFE_TAGS = new Set([
  'p', 'br', 'span', 'strong', 'em', 'b', 'i', 'u',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'hr', 'pre', 'code',
]);

export interface CafeHtmlOpts {
  siteUrl: string;
  allowExternalImages?: boolean;
}

/**
 * 카더라 블로그 HTML을 네이버 카페에 안전한 HTML로 변환
 */
export function toNaverCafeHtml(html: string, opts: CafeHtmlOpts): string {
  if (!html) return '';
  const siteUrl = opts.siteUrl.replace(/\/+$/, '');

  let s = html;

  // 1. 위험 블록 통째 제거
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
  s = s.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
  s = s.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');
  s = s.replace(/<embed\b[^>]*\/?>/gi, '');
  s = s.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '');
  s = s.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '');
  s = s.replace(/<input\b[^>]*\/?>/gi, '');
  s = s.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  // 2. 위험 속성 제거 (이벤트 핸들러)
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 3. 위험 URL 스킴 (javascript:, vbscript:, data:)
  s = s.replace(/\b(href|src|action|formaction)\s*=\s*(['"])\s*(javascript|vbscript|data)\s*:[^'"]*\2/gi, '');

  // 4. style 속성 — 위험 표현 제거 (expression, url(javascript:))
  s = s.replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, (match) => {
    if (/expression\s*\(|javascript\s*:|vbscript\s*:|@import|behavior\s*:/i.test(match)) return '';
    return match;
  });

  // 5. allowlist 외 태그 통째 제거 (속성/내용은 보존)
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    return NAVER_SAFE_TAGS.has(tag.toLowerCase()) ? match : '';
  });

  // 6. 링크 처리: 절대 URL 변환 + 외부 nofollow
  s = s.replace(/<a\s+([^>]*?)href\s*=\s*(["'])([^"']+)\2([^>]*?)>/gi,
    (_, pre, _q, url, post) => {
      let absoluteUrl = url;
      if (url.startsWith('/')) {
        absoluteUrl = siteUrl + url;
      } else if (!/^https?:\/\//i.test(url) && !url.startsWith('mailto:')) {
        return ''; // 의심 URL 제거
      }

      const isInternal = absoluteUrl.startsWith(siteUrl);
      const hasRel = /\srel\s*=/i.test(pre + post);
      const hasTarget = /\starget\s*=/i.test(pre + post);

      let extras = '';
      if (!isInternal) {
        if (!hasRel) extras += ' rel="nofollow noopener"';
        if (!hasTarget) extras += ' target="_blank"';
      } else {
        if (!hasTarget) extras += ' target="_blank"';
      }

      return `<a ${pre}href="${absoluteUrl}"${post}${extras}>`;
    });

  // 7. 이미지: 카더라 절대 URL만 허용
  s = s.replace(/<img\s+([^>]*?)src\s*=\s*(["'])([^"']+)\2([^>]*?)\/?>/gi,
    (_, pre, _q, url, post) => {
      let imgUrl = url;
      if (url.startsWith('/')) imgUrl = siteUrl + url;
      
      const isOurDomain = imgUrl.startsWith(siteUrl);
      const isHttps = imgUrl.startsWith('https://');
      
      if (!isOurDomain && !opts.allowExternalImages) return '';
      if (!isHttps && !isOurDomain) return ''; // http 외부 이미지 차단

      const hasAlt = /\salt\s*=/i.test(pre + post);
      const altAttr = hasAlt ? '' : ' alt="카더라 콘텐츠 이미지"';
      return `<img ${pre}src="${imgUrl}"${post}${altAttr}>`;
    });

  // 8. 캐리지 리턴 정규화
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 9. 빈 태그 정리
  s = s.replace(/<(p|div|span)\b[^>]*>\s*<\/\1>/g, '');

  // 10. 연속 공백/개행 정리
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.trim();

  return s;
}

/**
 * 카페 발행 본문 끝에 출처 박스 자동 추가 (네이버 카페 정책 준수 + 백링크)
 */
export function appendSourceBox(html: string, opts: {
  canonicalUrl: string;
  title: string;
  siteUrl?: string;
}): string {
  const siteUrl = (opts.siteUrl || 'https://kadeora.app').replace(/\/+$/, '');
  const safeTitle = (opts.title || '원문 보기')
    .replace(/[<>"']/g, '')
    .slice(0, 100);

  const sourceBox = `
<div>
  <hr>
  <p><strong>📌 원문 출처</strong></p>
  <p>이 글은 카더라(<a href="${siteUrl}" target="_blank">kadeora.app</a>)의 데이터·분석 콘텐츠를 기반으로 작성되었습니다.</p>
  <p>👉 원문 전체 보기: <a href="${opts.canonicalUrl}" target="_blank">${safeTitle}</a></p>
  <p>📊 더 많은 부동산·주식·블로그·계산기: <a href="${siteUrl}" target="_blank">카더라 (kadeora.app)</a></p>
</div>`.trim();

  return html + '\n\n' + sourceBox;
}

/**
 * 카페 제목 정화 — 네이버 카페 제목 제한 안전화
 */
export function sanitizeCafeSubject(raw: string, maxLength: number = 60): string {
  if (!raw) return '';
  return raw
    .replace(/[<>"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

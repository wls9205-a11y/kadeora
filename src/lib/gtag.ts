/**
 * GA4 이벤트 유틸 — gtag wrapper
 *
 * 사용법:
 * import { gtagEvent } from '@/lib/gtag';
 * gtagEvent('sign_up', { method: 'kakao' });
 * gtagEvent('select_content', { content_type: 'cta', item_id: 'hero_signup' });
 */

// 세션 141: 호스팅어 네트워크 분리 — G-VP4F6TH2GD는 호스팅어 사이트들과 공유
// 되었던 속성이라 평판 오염 리스크. env의 새 속성 ID 사용. 미설정 시 빈 문자열
// → gtag.js 스크립트가 id 없이 로드되지 않음 (tracking pause).
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';
export const ADS_ID = process.env.NEXT_PUBLIC_ADS_ID || '';

export function gtagEvent(
  action: string,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (typeof w.gtag !== 'function') return;
  w.gtag('event', action, params);
}

/** GA4 페이지뷰 (SPA 내비게이션용) */
export function gtagPageView(url: string) {
  gtagEvent('page_view', { page_path: url, page_location: `https://kadeora.app${url}` });
}

/** Google Ads 전환 이벤트 */
export function gtagConversion(label: string, value?: number) {
  gtagEvent('conversion', {
    send_to: `${ADS_ID}/${label}`,
    ...(value !== undefined ? { value, currency: 'KRW' } : {}),
  });
}

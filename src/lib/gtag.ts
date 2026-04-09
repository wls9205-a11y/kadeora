/**
 * GA4 이벤트 유틸 — gtag wrapper
 *
 * 사용법:
 * import { gtagEvent } from '@/lib/gtag';
 * gtagEvent('sign_up', { method: 'kakao' });
 * gtagEvent('select_content', { content_type: 'cta', item_id: 'hero_signup' });
 */

export const GA_ID = 'G-VP4F6TH2GD';
export const ADS_ID = 'AW-17792745509';

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

/**
 * Client-side CTA 이벤트 전송 유틸.
 *
 * 사용:
 *   import { trackCtaClick, trackCtaView } from '@/lib/cta-track';
 *   trackCtaClick({ cta_name: 'kakao_hero', page_path: location.pathname });
 *
 * sendBeacon 지원 시 beacon, 아니면 keepalive fetch. 실패는 silent.
 */

export interface CtaPayload {
  cta_name: string;
  category?: string;
  page_path?: string;
  gate_position?: number;
}

function visitorId(): string {
  if (typeof document === 'undefined') return '';
  const KEY = 'kd_vid';
  try {
    const match = document.cookie.split('; ').find((c) => c.startsWith(KEY + '='));
    if (match) return decodeURIComponent(match.split('=')[1] || '');
    const v = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    document.cookie = `${KEY}=${encodeURIComponent(v)}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
    return v;
  } catch { return ''; }
}

function deviceType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}

function referrerSource(): string {
  if (typeof document === 'undefined') return 'direct';
  try {
    const ref = document.referrer;
    if (!ref) return 'direct';
    const host = new URL(ref).hostname;
    if (!host) return 'direct';
    if (host.includes('google')) return 'google';
    if (host.includes('naver')) return 'naver';
    if (host.includes('daum')) return 'daum';
    if (host.includes('bing')) return 'bing';
    if (host.includes('kakao')) return 'kakao';
    if (host.endsWith('kadeora.app')) return 'internal';
    return host;
  } catch { return 'direct'; }
}

function send(event_type: 'cta_view' | 'cta_click' | 'cta_complete', p: CtaPayload) {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    event_type,
    cta_name: p.cta_name,
    category: p.category,
    page_path: p.page_path ?? window.location.pathname,
    gate_position: p.gate_position,
    visitor_id: visitorId(),
    device_type: deviceType(),
    referrer_source: referrerSource(),
  });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/events/cta', blob);
      return;
    }
  } catch { /* fall through */ }
  try {
    fetch('/api/events/cta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch { /* silent */ }
}

export const trackCtaClick = (p: CtaPayload) => send('cta_click', p);
export const trackCtaView = (p: CtaPayload) => send('cta_view', p);
export const trackCtaComplete = (p: CtaPayload) => send('cta_complete', p);

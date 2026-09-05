/**
 * Client-side CTA 이벤트 전송 유틸.
 *
 * 사용:
 *   import { trackCtaClick, trackCtaView } from '@/lib/cta-track';
 *   trackCtaClick({ cta_name: 'kakao_hero', page_path: location.pathname });
 *
 * sendBeacon 지원 시 beacon, 아니면 keepalive fetch. 실패는 silent.
 */

// SU B-1: 쿠키 읽기/발급 로직을 여기서 걷고 정본 헬퍼로 넘겼다.
// 이 파일이 쿠키를, analytics.ts 가 localStorage 를 따로 발급하던 것이 이원화의 실체다.
import { getVisitorId } from './visitor-id';

export interface CtaPayload {
  cta_name: string;
  category?: string;
  page_path?: string;
  gate_position?: number;
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
    visitor_id: getVisitorId(),
    device_type: deviceType(),
    referrer_source: referrerSource(),
  });
  let sent = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      sent = navigator.sendBeacon('/api/events/cta', new Blob([body], { type: 'application/json' }));
    }
  } catch { /* fall through */ }
  if (!sent) {
    try {
      fetch('/api/events/cta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }
}

export const trackCtaClick = (p: CtaPayload) => send('cta_click', p);
export const trackCtaView = (p: CtaPayload) => send('cta_view', p);
export const trackCtaComplete = (p: CtaPayload) => send('cta_complete', p);

// s262 Phase E — carousel swipe 측정.
// from_tab/to_tab 은 page_path 에 슬래시로 인코딩 (cta_events 컬럼 무관, 단일 endpoint 재활용).
// cta_name='carousel_swipe', category=source (e.g. 'stock_carousel').
export function trackSwipe(args: { source: string; from_tab: string; to_tab: string; page_path?: string }) {
  if (typeof window === 'undefined') return;
  const path = args.page_path ?? window.location.pathname;
  send('cta_click', {
    cta_name: 'carousel_swipe',
    category: args.source,
    page_path: `${path}#${args.from_tab}->${args.to_tab}`,
  });
}

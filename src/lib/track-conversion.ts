/**
 * 전환 이벤트 추적 유틸 — fire-and-forget
 */
export function trackConversion(
  eventType: 'cta_view' | 'cta_click' | 'cta_step2' | 'cta_complete',
  ctaName: string,
  extra?: { category?: string; pagePath?: string }
) {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    event_type: eventType,
    cta_name: ctaName,
    category: extra?.category,
    page_path: extra?.pagePath || window.location.pathname,
    visitor_id: localStorage.getItem('kd_visitor_id'),
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon('/api/track', blob);
  } else {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

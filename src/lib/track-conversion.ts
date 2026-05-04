/**
 * 전환 이벤트 추적 유틸 — fire-and-forget
 * Supabase(conversion_events) + GA4(gtag) 동시 발송
 */
export function trackConversion(
  eventType: 'cta_view' | 'cta_click' | 'cta_step2' | 'cta_complete',
  ctaName: string,
  extra?: { category?: string; pagePath?: string }
) {
  if (typeof window === 'undefined') return;

  // GA4 이벤트 동시 발송
  try {
    const w = window as any;
    if (typeof w.gtag === 'function') {
      const gaAction = eventType === 'cta_complete' ? 'conversion_complete'
        : eventType === 'cta_click' ? 'select_content' : eventType;
      w.gtag('event', gaAction, {
        content_type: 'cta',
        item_id: ctaName,
        event_category: extra?.category || 'conversion',
        page_path: extra?.pagePath || window.location.pathname,
      });
    }
  } catch {}

  // CTA 클릭 시 마지막 클릭 CTA 저장 (가입 귀속용)
  if (eventType === 'cta_click') {
    try { localStorage.setItem('kd_last_cta', ctaName); } catch {}
  }

  const body = JSON.stringify({
    event_type: eventType,
    cta_name: ctaName,
    category: extra?.category,
    page_path: extra?.pagePath || window.location.pathname,
    visitor_id: localStorage.getItem('kd_visitor_id'),
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon('/api/events/cta', blob);
  } else {
    fetch('/api/events/cta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

/**
 * 가입 귀속: 마지막 CTA 클릭 정보를 가져와 프로필에 저장
 */
export function getSignupSource(): string {
  if (typeof window === 'undefined') return 'direct';
  try {
    return localStorage.getItem('kd_last_cta') || 'direct';
  } catch { return 'direct'; }
}

// s264-b (P0-1): setTimeout 패턴 완전 제거. sendBeacon 우선 + fetch keepalive
// fallback 즉시 fire 후 navigate. unload 시 callback drop 회피 (Architecture Rule #96).
//
// 회귀 이력:
//   s230 P1 (086e438f): 80 → 50ms (모바일 sendBeacon drop 야기)
//   s263 Phase 2.2: 50 → 200ms (사용자 인지 가능 지연 + 여전히 setTimeout 의존)
//   s264-b: setTimeout 제거 — sendBeacon 은 sync queue 라 즉시 fire 후 navigate
//           해도 큐가 unload 시 자동 flush (브라우저 표준 보장).
// 영향: 6 silent CTA (sticky_signup_bar / blog_early_teaser /
//       login_gate_apt_analysis / login_gate_apt_trade_alert /
//       blog_gated_login / related_blog_section) 회복 예상.
//
// 호출자 8개 호환 위해 기존 object signature (CtaNavigateProps) 보존.

export interface CtaNavigateProps {
  href: string;
  ctaName: string;
  pagePath?: string;
  category?: string;
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

function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}

export function trackCtaAndNavigate(p: CtaNavigateProps) {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({
    event_type: 'cta_click',
    cta_name: p.ctaName,
    page_path: p.pagePath ?? window.location.pathname,
    category: p.category,
    visitor_id: visitorId(),
    device_type: detectDevice(),
  });

  // Primary: sendBeacon — sync queue, navigate 영향 0 (Architecture Rule #96).
  let sent = false;
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      sent = navigator.sendBeacon('/api/events/cta', blob);
    }
  } catch { /* fall through */ }

  // Fallback: fetch keepalive — unload 도 보장.
  if (!sent) {
    try {
      fetch('/api/events/cta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch { /* swallow */ }
  }

  // 즉시 navigate — setTimeout 제거 (s264-b).
  window.location.href = p.href;
}

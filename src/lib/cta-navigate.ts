// s266_b: sendBeacon abort by page unload 회귀 fix.
//
// Root cause: window.location.href 즉시 unload → 모바일 (iOS Safari) sendBeacon flush abort.
// 영향: 8 silent CTA (sticky_signup_bar, login_gate_*, blog_early_teaser, blog_gated_login,
//      related_blog_section, apt_alert_cta, kakao_hero, kakao_sheet_*) 모두 trackCtaAndNavigate 경유.
// popup_signup_modal / nav_login_button (Next Link 직접 사용) 는 정상 동작.
//
// Fix:
//   1. router 옵셔널 받아 router.push (client-side, no unload) 우선 → sendBeacon 안전 flush.
//   2. 없으면 setTimeout 50ms wait + window.location (d9821169 working state).
//   3. trackCTA() 위임 복원 (user_events queue 누락 해소).
//
// 회귀 이력 (Architecture Rule #96 갱신):
//   s230 P1 (086e438f): 80 → 50ms
//   s263 Phase 2.2 (8c336cc1): 50 → 200ms (모바일 sendBeacon abort 미해결)
//   s264-b (69843fbc): setTimeout 제거 (sendBeacon 단독 — abort 잔존)
//   s266_b: router.push 우선 + setTimeout 50ms fallback + trackCTA 위임
//   s267: sendBeacon → fetch keepalive (s266_c router refactor 후 5/8~5/11 click 0건 → s218 trackCTA keepalive 패턴 통일)

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { trackCTA } from '@/lib/analytics';

export interface CtaNavigateProps {
  href: string;
  ctaName: string;
  category?: string;
  gatePosition?: string;
  /** legacy: caller-side pagePath. 미명시 시 window.location.pathname 으로 fallback. */
  pagePath?: string;
  /** s266_b: client-side navigation 우선 — sendBeacon flush abort 방지. */
  router?: AppRouterInstance;
}

export function trackCtaAndNavigate(p: CtaNavigateProps) {
  if (typeof window === 'undefined') return;

  // 1. sendBeacon — sync queue (client-side nav 이면 즉시 flush, full nav 이면 setTimeout wait).
  try {
    const payload = JSON.stringify({
      event_type: 'cta_click',
      cta_name: p.ctaName,
      category: p.category ?? null,
      gate_position: p.gatePosition ?? null,
      page_path: p.pagePath ?? window.location.pathname,
    });
    // s267: sendBeacon → fetch keepalive (모바일 Safari page transition abort 회피)
    // /api/events/cta route.ts L23 req.text() 호환 → Content-Type: text/plain
    fetch('/api/events/cta', {
      method: 'POST',
      body: payload,
      keepalive: true,
      headers: { 'Content-Type': 'text/plain' },
    }).catch(() => {});
  } catch { /* swallow */ }

  // 2. trackCTA — user_events queue + 보조 conversion_events (d9821169 패턴 복원).
  try { trackCTA('click', p.ctaName, { page_path: p.pagePath, category: p.category }); } catch { /* swallow */ }

  // 3. navigate — router.push (client-side, no unload) 우선.
  if (p.router) {
    p.router.push(p.href);
    return;
  }

  // Fallback: setTimeout 50ms 로 sendBeacon flush 시간 확보 후 full nav.
  setTimeout(() => {
    window.location.href = p.href;
  }, 50);
}

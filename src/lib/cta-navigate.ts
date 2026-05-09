import { trackCTA } from '@/lib/analytics';

export interface CtaNavigateProps {
  href: string;
  ctaName: string;
  pagePath?: string;
  category?: string;
}

// s263 Phase 2.2: setTimeout 50→200ms 복귀.
//   회귀 증거: 24h sticky_signup_bar view 65 / click 0 (sendBeacon flush 시간 부족).
//   popup_signup_modal 만 click 5 정상 — popup 은 OAuth await 흐름이라 navigation
//   타이밍 충분. trackCtaAndNavigate 호출하는 8개 컴포넌트 모두 동일 회귀 (login_gate_apt_analysis, blog_gated_login, blog_early_teaser, sticky_signup_bar 등).
//   200ms 는 사용자 인지 못 하는 수준 + sendBeacon 큐 안전 fire 보장.
//   s230 P1 의 80→50ms 단축이 모바일 환경에서 sendBeacon drop 유발한 회귀.
export function trackCtaAndNavigate(p: CtaNavigateProps) {
  try { trackCTA('click', p.ctaName, { page_path: p.pagePath, category: p.category }); } catch {}
  setTimeout(() => {
    if (typeof window !== 'undefined') window.location.href = p.href;
  }, 200);
}

import { trackCTA } from '@/lib/analytics';

export interface CtaNavigateProps {
  href: string;
  ctaName: string;
  pagePath?: string;
  category?: string;
}

// s260 P1: trackCTA 단일 호출 (analytics.ts 내부에서 cta_click 을 sendBeacon 으로 발사).
// 기존엔 trackCtaClick 을 추가로 호출 → /api/track + /api/events/cta 양쪽 sendBeacon
// 이중 발사 + race. setTimeout 80→50ms 로 navigation 발사 지연 단축.
export function trackCtaAndNavigate(p: CtaNavigateProps) {
  try { trackCTA('click', p.ctaName, { page_path: p.pagePath, category: p.category }); } catch {}
  setTimeout(() => {
    if (typeof window !== 'undefined') window.location.href = p.href;
  }, 50);
}

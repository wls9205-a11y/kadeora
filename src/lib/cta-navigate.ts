import { trackCTA } from '@/lib/analytics';
import { trackCtaClick } from '@/lib/cta-track';

export interface CtaNavigateProps {
  href: string;
  ctaName: string;
  pagePath?: string;
  category?: string;
}

export function trackCtaAndNavigate(p: CtaNavigateProps) {
  try { trackCTA('click', p.ctaName, { page_path: p.pagePath, category: p.category }); } catch {}
  try { trackCtaClick({ cta_name: p.ctaName, category: p.category, page_path: p.pagePath }); } catch {}
  setTimeout(() => {
    if (typeof window !== 'undefined') window.location.href = p.href;
  }, 80);
}

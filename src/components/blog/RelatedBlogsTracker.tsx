'use client';

/**
 * RelatedBlogsTracker — RelatedBlogsSection 의 view/click 이벤트 발송 (클라이언트 전용).
 *
 * - mount 시 cta_view('related_blog_section')
 * - data-related-card 클릭 감지 → cta_click('related_blog_strategy' or '_normal')
 */

import { useEffect, useRef } from 'react';
import { trackCtaClick, trackCtaView } from '@/lib/cta-track';

interface Props {
  blogId: number;
}

export default function RelatedBlogsTracker({ blogId }: Props) {
  const viewFired = useRef(false);

  useEffect(() => {
    if (viewFired.current) return;
    viewFired.current = true;
    try {
      trackCtaView({
        cta_name: 'related_blog_section',
        category: 'engagement',
        page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const card = target.closest('a[data-related-card]') as HTMLAnchorElement | null;
      if (!card) return;
      const badge = card.getAttribute('data-related-badge') || 'related';
      const cta = badge === 'strategy' ? 'related_blog_strategy' : 'related_blog_normal';
      try {
        trackCtaClick({
          cta_name: cta,
          category: 'engagement',
          page_path: window.location.pathname,
        });
      } catch { /* silent */ }
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, [blogId]);

  return null;
}

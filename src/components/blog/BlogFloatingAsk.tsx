'use client';

import { useCallback, useEffect, useState } from 'react';
import { trackCtaClick } from '@/lib/cta-track';

interface Props {
  slug: string;
  isLoggedIn?: boolean;
}

export default function BlogFloatingAsk({ slug, isLoggedIn }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isLoggedIn) return;
    const onScroll = () => {
      const scrolled = window.scrollY;
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setShow(scrolled / total > 0.5);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [isLoggedIn]);

  const handle = useCallback(() => {
    trackCtaClick({ cta_name: 'blog_floating_ask', category: 'signup', page_path: typeof window !== 'undefined' ? window.location.pathname : undefined });
    window.location.href = `/login?redirect=${encodeURIComponent(`/blog/${slug}`)}&source=blog_floating_ask`;
  }, [slug]);

  if (isLoggedIn || !show) return null;

  return (
    <button
      onClick={handle}
      aria-label="로그인하고 질문하기"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 24,
        zIndex: 900,
        background: '#FEE500',
        color: '#000',
        fontWeight: 800,
        fontSize: 13,
        padding: '12px 18px',
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span aria-hidden>💬</span> 궁금한 거 물어보기
    </button>
  );
}

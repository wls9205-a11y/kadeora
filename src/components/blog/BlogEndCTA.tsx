'use client';

import { useCallback } from 'react';
import { trackCtaClick } from '@/lib/cta-track';

interface Props {
  slug: string;
  isLoggedIn?: boolean;
}

export default function BlogEndCTA({ slug, isLoggedIn }: Props) {
  const handle = useCallback(() => {
    trackCtaClick({ cta_name: 'blog_end_cta', category: 'signup', page_path: typeof window !== 'undefined' ? window.location.pathname : undefined });
    if (typeof window !== 'undefined') {
      window.location.href = `/login?redirect=${encodeURIComponent(`/blog/${slug}`)}&source=blog_end_cta`;
    }
  }, [slug]);

  if (isLoggedIn) return null;

  return (
    <div style={{
      margin: '28px 0',
      padding: '22px 20px',
      borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(254,229,0,0.15) 0%, rgba(139,92,246,0.12) 100%)',
      border: '1px solid rgba(254,229,0,0.3)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary, #94a3b8)', marginBottom: 6 }}>이 글이 도움 되셨나요?</div>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14, color: 'var(--text-primary, #e5e7eb)' }}>매주 실시간 분양·시세 알림 받기</div>
      <button onClick={handle} style={{
        background: '#FEE500', color: '#000', fontWeight: 800, fontSize: 15,
        padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
        minWidth: 220, boxShadow: '0 6px 14px rgba(0,0,0,0.2)',
      }}>카카오로 1초 가입 · 100P 지급</button>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #94a3b8)', marginTop: 10 }}>언제든 알림 해지 가능 · 무료</div>
    </div>
  );
}

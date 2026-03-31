'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Props {
  nextSlug: string;
  nextTitle: string;
  category?: string;
}

export default function NextArticleFloat({ nextSlug, nextTitle, category }: Props) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      setShow(pct > 0.55 && pct < 0.95);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show || dismissed) return null;

  const emoji: Record<string, string> = { stock: '📈', apt: '🏢', unsold: '🏚️', finance: '💰', general: '📝' };

  return (
    <div className="kd-next-article" style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      maxWidth: 400, width: 'calc(100% - 32px)', zIndex: 90,
      background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-lg)', padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 'var(--fs-xl)', flexShrink: 0 }}>{emoji[category || 'general'] || '📝'}</span>
      <Link href={`/blog/${nextSlug}`} style={{
        flex: 1, textDecoration: 'none', color: 'inherit', minWidth: 0,
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--brand)', marginBottom: 2 }}>다음 글</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nextTitle}
        </div>
      </Link>
      <button onClick={() => setDismissed(true)} style={{
        background: 'none', border: 'none', color: 'var(--text-tertiary)',
        cursor: 'pointer', fontSize: 16, padding: 4, flexShrink: 0,
      }} aria-label="닫기">✕</button>
    </div>
  );
}

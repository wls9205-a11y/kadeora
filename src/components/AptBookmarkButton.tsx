'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface Props {
  aptId: number;
  isLoggedIn: boolean;
}

export default function AptBookmarkButton({ aptId, isLoggedIn }: Props) {
  const pathname = usePathname();
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch(`/api/apt/bookmark?aptId=${aptId}`)
      .then(r => r.json())
      .then(d => setBookmarked(d.bookmarked))
      .catch(() => {});
  }, [aptId, isLoggedIn]);

  const toggle = async () => {
    if (!isLoggedIn) {
      window.location.href = `/login?redirect=${encodeURIComponent(pathname)}`;
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/apt/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aptId }),
      });
      const data = await res.json();
      setBookmarked(data.bookmarked);
      if (data.bookmarked && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch {}
    setLoading(false);
  };

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
      disabled={loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-xs)',
        padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-xs)', fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        border: bookmarked ? '1px solid rgba(251,146,60,0.3)' : '1px solid var(--border)',
        background: bookmarked ? 'rgba(251,146,60,0.12)' : 'var(--bg-hover)',
        color: bookmarked ? 'var(--accent-orange)' : 'var(--text-tertiary)',
        transition: 'all var(--transition-fast)',
        opacity: loading ? 0.6 : 1,
      }}
      aria-label={bookmarked ? '관심단지 해제' : '관심단지 등록'}
    >
      {bookmarked ? '🧡 관심단지' : '🤍 관심등록'}
    </button>
  );
}

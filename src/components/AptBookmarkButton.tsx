'use client';
import { useState, useEffect } from 'react';

interface Props {
  aptId: number;
  isLoggedIn: boolean;
}

export default function AptBookmarkButton({ aptId, isLoggedIn }: Props) {
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
      window.location.href = '/login';
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
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 8, fontSize: 'var(--fs-xs)', fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        border: bookmarked ? '1px solid rgba(251,146,60,0.3)' : '1px solid var(--border)',
        background: bookmarked ? 'rgba(251,146,60,0.12)' : 'var(--bg-hover)',
        color: bookmarked ? '#FB923C' : 'var(--text-tertiary)',
        transition: 'all 0.15s',
        opacity: loading ? 0.6 : 1,
      }}
      aria-label={bookmarked ? '관심단지 해제' : '관심단지 등록'}
    >
      {bookmarked ? '🧡 관심단지' : '🤍 관심등록'}
    </button>
  );
}

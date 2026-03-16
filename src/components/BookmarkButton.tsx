'use client';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

interface Props { postId: number; }

export function BookmarkButton({ postId }: Props) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    fetch(`/api/bookmarks?postId=${postId}`)
      .then(r => r.json())
      .then(d => setBookmarked(d.bookmarked))
      .catch(() => {});
  }, [postId]);

  const toggle = async () => {
    try { if ('vibrate' in navigator) navigator.vibrate(10); } catch {}
    setLoading(true);
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) { error('로그인이 필요합니다'); return; }
      const data = await res.json();
      setBookmarked(data.bookmarked);
      success(data.bookmarked ? '북마크에 저장했습니다' : '북마크를 해제했습니다');
    } catch { error('오류가 발생했습니다'); }
    finally { setLoading(false); }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? '북마크 해제' : '북마크 추가'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 20, fontSize: 14, cursor: 'pointer',
        background: bookmarked ? 'var(--warning-bg)' : 'var(--bg-hover)',
        border: `1px solid ${bookmarked ? 'var(--warning)' : 'var(--border)'}`,
        color: bookmarked ? 'var(--warning)' : 'var(--text-secondary)',
        transition: 'all 0.15s', fontWeight: bookmarked ? 700 : 400,
      }}
    >
      {bookmarked ? '🔖' : '📄'} <span>{bookmarked ? '저장됨' : '저장'}</span>
    </button>
  );
}
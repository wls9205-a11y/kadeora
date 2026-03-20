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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 6, background: 'none', border: 'none',
        color: bookmarked ? 'var(--brand)' : 'var(--text-tertiary)',
        cursor: 'pointer', transition: 'color 0.15s',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
    </button>
  );
}
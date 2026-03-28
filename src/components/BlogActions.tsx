'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface Props {
  blogPostId: number;
  initialHelpfulCount: number;
}

export default function BlogActions({ blogPostId, initialHelpfulCount }: Props) {
  const { userId, loading: authLoading } = useAuth();
  const [isHelpful, setIsHelpful] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(initialHelpfulCount);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading || !userId) return;
    Promise.all([
      fetch(`/api/blog/helpful?blogPostId=${blogPostId}`).then(r => r.json()),
      fetch(`/api/blog/bookmark?blogPostId=${blogPostId}`).then(r => r.json()),
    ]).then(([h, b]) => {
      setIsHelpful(h.isHelpful);
      setIsBookmarked(b.isBookmarked);
    }).catch(() => {});
  }, [blogPostId, userId, authLoading]);

  const toggleHelpful = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/blog/helpful', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogPostId }),
      });
      const data = await res.json();
      setIsHelpful(data.isHelpful);
      setHelpfulCount(data.helpfulCount);
    } catch {} finally { setBusy(false); }
  };

  const toggleBookmark = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/blog/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogPostId }),
      });
      const data = await res.json();
      setIsBookmarked(data.isBookmarked);
    } catch {} finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={toggleHelpful} disabled={!userId || busy} style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 10,
        border: '1px solid var(--border)',
        background: isHelpful ? 'var(--accent-blue-bg, rgba(59,130,246,0.1))' : 'var(--bg-hover)',
        color: isHelpful ? 'var(--accent-blue)' : 'var(--text-tertiary)',
        cursor: userId ? 'pointer' : 'default', fontSize: 13, fontWeight: 600,
        opacity: busy ? 0.6 : 1, transition: 'all 0.15s',
      }}>
        👍 도움이 됐어요{helpfulCount > 0 && ` ${helpfulCount}`}
      </button>
      <button onClick={toggleBookmark} disabled={!userId || busy} style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 10,
        border: '1px solid var(--border)',
        background: isBookmarked ? 'var(--accent-green-bg, rgba(52,211,153,0.1))' : 'var(--bg-hover)',
        color: isBookmarked ? 'var(--accent-green)' : 'var(--text-tertiary)',
        cursor: userId ? 'pointer' : 'default', fontSize: 13, fontWeight: 600,
        opacity: busy ? 0.6 : 1, transition: 'all 0.15s',
      }}>
        {isBookmarked ? '🔖 저장됨' : '📑 저장'}
      </button>
    </div>
  );
}

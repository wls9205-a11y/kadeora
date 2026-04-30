'use client';
/**
 * WatchlistAddButton — 추적 추가/삭제 버튼 (client).
 * 401 → /login redirect, 200 → router.refresh / onSuccess.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  mode: 'add' | 'remove';
  aptId: number;
  onSuccess?: () => void;
}

export default function WatchlistAddButton({ mode, aptId, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: mode === 'add' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apt_id: aptId }),
      });
      if (res.status === 401) {
        window.location.href = '/login?next=/watchlist&cta=watchlist_add_cta';
        return;
      }
      if (res.ok) {
        if (onSuccess) onSuccess();
        else startTransition(() => router.refresh());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const star = mode === 'add' ? '☆' : '★';
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label={mode === 'add' ? '추적 추가' : '추적 삭제'}
      style={{
        background: 'transparent',
        border: '0.5px solid var(--border)',
        borderRadius: 6,
        padding: '2px 6px',
        fontSize: 11,
        cursor: loading ? 'wait' : 'pointer',
        color: mode === 'add' ? 'var(--text-secondary)' : 'var(--accent-yellow, #fbbf24)',
        opacity: loading ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      {star}
    </button>
  );
}

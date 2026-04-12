'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BlogBookmarkButton({ blogPostId }: { blogPostId: number }) {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/blog/bookmark?blogPostId=${blogPostId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.isBookmarked) setSaved(true); })
      .catch(() => {});
  }, [userId, blogPostId]);

  if (loading) return null;

  if (!userId) {
    return (
      <Link href={`/login?redirect=${encodeURIComponent(pathname)}&source=blog_bookmark`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)', background: 'var(--bg-surface)',
        color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
        textDecoration: 'none',
      }}>
        📌 저장
      </Link>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/blog/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blogPostId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.isBookmarked ?? !saved);
      }
    } catch {}
    finally { setBusy(false); }
  };

  return (
    <button onClick={toggle} disabled={busy} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 'var(--radius-md)',
      border: saved ? '1px solid var(--brand)' : '1px solid var(--border)',
      background: saved ? 'rgba(59,123,246,0.08)' : 'var(--bg-surface)',
      color: saved ? 'var(--brand)' : 'var(--text-secondary)',
      fontSize: 12, fontWeight: 600,
      cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
    }}>
      {saved ? '📌 저장됨' : '📌 저장'}
    </button>
  );
}

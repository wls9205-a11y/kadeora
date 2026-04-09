'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AptBookmarkButton({ aptId, aptName }: { aptId: string; aptName: string }) {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/apt/bookmark?aptId=${aptId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.bookmarked) setSaved(true); })
      .catch(() => {});
  }, [userId, aptId]);

  if (loading) return null;

  if (!userId) {
    return (
      <Link href={`/login?redirect=${encodeURIComponent(pathname)}&source=apt_bookmark`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)', background: 'var(--bg-surface)',
        color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', fontWeight: 600,
        textDecoration: 'none', cursor: 'pointer',
      }}>
        ☆ 관심단지
      </Link>
    );
  }

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/apt/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aptId: aptId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaved(data.bookmarked ?? !saved);
      }
    } catch {}
    finally { setBusy(false); }
  };

  return (
    <button onClick={toggle} disabled={busy} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 14px', borderRadius: 'var(--radius-xl)',
      border: saved ? '1px solid var(--brand)' : '1px solid var(--border)',
      background: saved ? 'rgba(59,123,246,0.08)' : 'var(--bg-surface)',
      color: saved ? 'var(--brand)' : 'var(--text-secondary)',
      fontSize: 'var(--fs-sm)', fontWeight: 600,
      cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
    }}>
      {saved ? '⭐ 관심단지' : '☆ 관심단지 (+5P)'}
    </button>
  );
}

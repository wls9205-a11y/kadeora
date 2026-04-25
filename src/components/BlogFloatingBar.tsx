'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { usePathname } from 'next/navigation';
import { trackCTA } from '@/lib/analytics';

interface Props {
  slug: string;
  title: string;
  category: string;
}

export default function BlogFloatingBar({ slug, title, category }: Props) {
  const { userId } = useAuth();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      setVisible(pct > 0.3 && pct < 0.95);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (visible && !tracked.current) {
      tracked.current = true;
      trackCTA('view', 'blog_floating_bar', { page_path: pathname, category });
    }
  }, [visible, pathname, category]);

  if (!visible) return null;

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=floating_bar`;

  const handleSave = async () => {
    trackCTA('click', 'floating_save', { page_path: pathname });
    if (!userId) { window.location.href = loginUrl; return; }
    try {
      await fetch('/api/bookmark', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: 'blog', target_id: slug }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  const handleAlert = () => {
    trackCTA('click', 'floating_alert', { page_path: pathname, category });
    if (!userId) { window.location.href = loginUrl; return; }
    window.location.href = `/notifications/settings`;
  };

  const handleShare = async () => {
    trackCTA('click', 'floating_share', { page_path: pathname });
    if (navigator.share) {
      try { await navigator.share({ title, url: window.location.href }); setShared(true); } catch {}
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px',
    borderRadius: 'var(--radius-lg, 12px)', border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, transition: 'transform 0.1s',
  };

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, display: 'flex', gap: 6, padding: '6px 8px',
      borderRadius: 'var(--radius-xl, 16px)',
      background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s, transform 0.3s',
    }}>
      <button onClick={handleSave} style={{
        ...btnStyle,
        background: saved ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
        color: saved ? '#22c55e' : '#e2e8f0',
      }}>
        {saved ? '✓ 저장됨' : '☆ 저장'}
      </button>
      <button onClick={handleAlert} style={{
        ...btnStyle,
        background: userId ? 'rgba(59,123,246,0.15)' : 'rgba(254,229,0,0.12)',
        color: userId ? '#60a5fa' : '#FEE500',
      }}>
        {userId ? '🔔 알림' : '🔔 알림 받기'}
      </button>
      <button onClick={handleShare} style={{
        ...btnStyle,
        background: shared ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
        color: shared ? '#22c55e' : '#e2e8f0',
      }}>
        {shared ? '✓ 복사됨' : '↗ 공유'}
      </button>
    </div>
  );
}

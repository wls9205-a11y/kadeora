'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { usePathname } from 'next/navigation';
import { trackCTA } from '@/lib/analytics';
import { Star, Bell, Share2 } from 'lucide-react';

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
    // s221: cta_name 통일 — view 와 동일한 'blog_floating_bar' 사용. (이전: 'floating_save')
    // properties.action 으로 액션 종류 보존.
    trackCTA('click', 'blog_floating_bar', { page_path: pathname, action: 'save' });
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
    trackCTA('click', 'blog_floating_bar', { page_path: pathname, category, action: 'alert' });
    if (!userId) { window.location.href = loginUrl; return; }
    window.location.href = `/notifications/settings`;
  };

  const handleShare = async () => {
    trackCTA('click', 'blog_floating_bar', { page_path: pathname, action: 'share' });
    if (navigator.share) {
      try { await navigator.share({ title, url: window.location.href }); setShared(true); } catch {}
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
      zIndex: 50, display: 'flex', gap: 8, padding: '8px 12px',
      borderRadius: 20,
      background: 'rgba(15,20,35,0.95)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease, transform 0.3s ease',
    }}>
      <button onClick={handleSave} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        borderRadius: 14, border: 'none', cursor: 'pointer',
        background: saved ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)',
        color: saved ? '#fbbf24' : '#f59e0b',
        fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}>
        <Star size={16} fill={saved ? '#fbbf24' : 'none'} strokeWidth={2.2} />
        {saved ? '저장됨' : '저장'}
      </button>

      <button onClick={handleAlert} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        borderRadius: 14, border: 'none', cursor: 'pointer',
        background: 'rgba(59,130,246,0.08)',
        color: '#60a5fa',
        fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}>
        <Bell size={16} strokeWidth={2.2} />
        알림
      </button>

      <button onClick={handleShare} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
        borderRadius: 14, border: 'none', cursor: 'pointer',
        background: shared ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.08)',
        color: shared ? '#4ade80' : '#22c55e',
        fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}>
        <Share2 size={16} strokeWidth={2.2} />
        {shared ? '복사됨' : '공유'}
      </button>
    </div>
  );
}

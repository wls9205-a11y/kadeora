'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { trackCTA } from '@/lib/analytics';

const STORAGE_KEY = 'kd_residence_nudge_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export default function ResidenceNudgeModal() {
  const { userId, loading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !userId) return;
    try {
      const ts = localStorage.getItem(STORAGE_KEY);
      if (ts && Date.now() - Number(ts) < COOLDOWN_MS) return;
    } catch {}

    let cancelled = false;
    (async () => {
      try {
        const sb = createSupabaseBrowser();
        const { data } = await (sb as any).from('profiles')
          .select('residence_city, onboarded').eq('id', userId).maybeSingle();
        if (cancelled || !data) return;
        if (data.residence_city) return;
        if (!data.onboarded) return;

        setTimeout(() => {
          if (!cancelled) {
            setOpen(true);
            trackCTA('view', 'residence_nudge_modal', { page_path: window.location.pathname });
          }
        }, 5000);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [userId, loading]);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    try { trackCTA('dismiss', 'residence_nudge_modal'); } catch {}
    setOpen(false);
  };

  const goSettings = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    try { trackCTA('click', 'residence_nudge_modal'); } catch {}
    setOpen(false);
    router.push('/settings/region');
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={dismiss}
    >
      <div
        style={{
          background: 'var(--bg-surface)', borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: '24px 20px 32px', maxWidth: 480, width: '100%',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          거주지를 알려주세요
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          동네 청약 마감일·가격 변동·재개발 진행 알림을 보내드릴게요.<br />
          <strong style={{ color: 'var(--accent)' }}>30초면 끝나요.</strong>
        </p>
        <button
          onClick={goSettings}
          type="button"
          style={{
            width: '100%', padding: '14px', background: 'var(--accent)', color: 'white',
            border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer',
          }}
        >
          거주지 설정하기 →
        </button>
        <button
          onClick={dismiss}
          type="button"
          style={{
            width: '100%', padding: '12px', marginTop: 8, background: 'transparent',
            color: 'var(--text-tertiary)', border: 'none', fontSize: 13, cursor: 'pointer',
          }}
        >
          나중에
        </button>
      </div>
    </div>
  );
}

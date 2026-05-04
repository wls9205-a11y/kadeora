'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { trackCTA } from '@/lib/analytics';
import MarketingConsentModal from './MarketingConsentModal';

const STORAGE_KEY = 'kd_marketing_consent_dismissed';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export default function MarketingConsentModalMount() {
  const { userId, loading } = useAuth();
  const [eligible, setEligible] = useState(false);
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
        const { data } = await (sb as any)
          .from('profiles')
          .select('onboarded, provider')
          .eq('id', userId)
          .maybeSingle();

        if (cancelled || !data) return;
        if (data.onboarded) return;

        setEligible(true);
        setTimeout(() => {
          if (!cancelled) {
            setOpen(true);
            trackCTA('view', 'marketing_consent_modal', { page_path: window.location.pathname });
          }
        }, 1500);
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [userId, loading]);

  const handleClose = () => {
    trackCTA('dismiss', 'marketing_consent_modal', { page_path: typeof window !== 'undefined' ? window.location.pathname : undefined });
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setOpen(false);
    setEligible(false);
  };

  if (!eligible || !userId) return null;

  return (
    <MarketingConsentModal
      userId={userId}
      isOpen={open}
      onClose={handleClose}
    />
  );
}

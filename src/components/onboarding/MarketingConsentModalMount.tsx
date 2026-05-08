'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import MarketingConsentModal from './MarketingConsentModal';

const STORAGE_KEY = 'kd_marketing_consent_dismissed';

export default function MarketingConsentModalMount() {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !userId) return;
    // s258 P1: /onboarding 페이지에서는 모달 마운트 차단 — 다중 모달 충돌 방지.
    if (pathname?.startsWith('/onboarding')) return;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY)) return;
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
        if (data.provider !== 'kakao') return;

        setEligible(true);
        setTimeout(() => { if (!cancelled) setOpen(true); }, 1500);
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [userId, loading, pathname]);

  const handleClose = () => {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
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

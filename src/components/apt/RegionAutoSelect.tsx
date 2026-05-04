'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getStoredRegion } from '@/lib/region-storage';
import { isValidKrRegion } from '@/lib/region-detection';

export default function RegionAutoSelect() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    if (sp.get('region')) return;

    const stored = getStoredRegion();
    const region = stored?.region ?? null;
    if (!region || !isValidKrRegion(region) || region === '전국') return;

    router.replace(`/apt?region=${encodeURIComponent(region)}`, { scroll: false });
  }, [router, sp]);

  return null;
}

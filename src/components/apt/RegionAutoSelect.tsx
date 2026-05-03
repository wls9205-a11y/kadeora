'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const VALID_REGIONS = new Set([
  '서울','부산','대구','인천','광주','대전','울산','세종',
  '경기','강원','충북','충남','전북','전남','경북','경남','제주',
]);

const TZ_TO_REGION: Record<string, string> = {
  'Asia/Seoul': '서울',
};

export default function RegionAutoSelect() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    if (sp.get('region')) return;

    let region: string | null = null;
    try {
      const stored = window.localStorage.getItem('apt:lastRegion');
      if (stored && VALID_REGIONS.has(stored)) region = stored;
    } catch { /* ignore */ }

    if (!region) {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const guessed = tz ? TZ_TO_REGION[tz] : null;
        if (guessed) region = guessed;
      } catch { /* ignore */ }
    }

    if (region && region !== '전국') {
      const next = new URLSearchParams(sp.toString());
      next.set('region', region);
      router.replace(`/apt?${next.toString()}`, { scroll: false });
    }
  }, [router, sp]);

  return null;
}

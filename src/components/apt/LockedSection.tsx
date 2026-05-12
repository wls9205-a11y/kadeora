// components/apt/LockedSection.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface LockedSectionProps {
  children: React.ReactNode;
  label: string;
  ctaText?: string;
  source?: string;
  unlockKey?: string;
}

export function LockedSection({
  children,
  label,
  ctaText = '카카오 1탭 가입',
  source = 'apt_locked',
  unlockKey = 'unlock',
}: LockedSectionProps) {
  const [unlocked, setUnlocked] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get(unlockKey) === '1') {
      setUnlocked(true);
    }
  }, [searchParams, unlockKey]);

  const handleUnlock = () => {
    const redirectUrl = `${pathname}?${unlockKey}=1`;
    router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}&source=${source}`);
  };

  if (unlocked) {
    return <div className="transition-all duration-300">{children}</div>;
  }

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-xl">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm shadow-xl border border-slate-200 dark:border-slate-700 mx-4">
          <div className="text-2xl mb-2" aria-hidden="true">
            ⬢
          </div>
          <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-slate-100">{label}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            1탭 가입하면 즉시 확인 + D-day 알림 무료
          </p>
          <button
            onClick={handleUnlock}
            className="w-full bg-yellow-300 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
          >
            {ctaText}
          </button>
        </div>
      </div>
    </div>
  );
}

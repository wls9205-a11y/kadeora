// components/apt/StickyBottomBar.tsx
'use client';

import { useEffect, useState } from 'react';
import { calcDday, ddayBucket } from '@/lib/apt-format';
import { PrimaryCTABar } from './PrimaryCTABar';

export function StickyBottomBar({
  slug,
  siteName,
  isAuthed,
  rcept_bgnde,
}: {
  slug: string;
  siteName: string;
  isAuthed: boolean;
  rcept_bgnde?: string | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const threshold = window.innerHeight * 0.3;
      setVisible(window.scrollY > threshold);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const dday = calcDday(rcept_bgnde);
  const bucket = ddayBucket(dday);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 sm:hidden transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          {dday !== null && dday >= 0 && (
            <div
              className={`flex flex-col items-center justify-center px-2 py-1 rounded-lg flex-shrink-0 ${
                bucket === 'imminent'
                  ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : bucket === 'soon'
                  ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span className="text-[9px] leading-tight opacity-80">청약</span>
              <span className="text-base font-bold leading-tight">D-{dday}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <PrimaryCTABar slug={slug} siteName={siteName} isAuthed={isAuthed} />
          </div>
        </div>
      </div>
    </div>
  );
}

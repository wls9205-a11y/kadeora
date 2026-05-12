// components/apt/DDayCountdown.tsx
'use client';

import { useEffect, useState } from 'react';
import { calcDday, ddayBucket } from '@/lib/apt-format';

export function DDayCountdown({
  rcept_bgnde,
  rcept_endde,
  przwner_presnatn_de,
  className = '',
}: {
  rcept_bgnde?: string | null;
  rcept_endde?: string | null;
  przwner_presnatn_de?: string | null;
  className?: string;
}) {
  const [, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dday1 = calcDday(rcept_bgnde);
  const ddayEnd = calcDday(rcept_endde);
  const ddayWinner = calcDday(przwner_presnatn_de);

  let label = '';
  let dday: number | null = null;
  let target: string | null = null;

  if (dday1 !== null && dday1 >= 0) {
    label = '1순위 청약까지';
    dday = dday1;
    target = rcept_bgnde || null;
  } else if (ddayEnd !== null && ddayEnd >= 0) {
    label = '청약 마감까지';
    dday = ddayEnd;
    target = rcept_endde || null;
  } else if (ddayWinner !== null && ddayWinner >= 0) {
    label = '당첨자 발표까지';
    dday = ddayWinner;
    target = przwner_presnatn_de || null;
  } else {
    return null;
  }

  const bucket = ddayBucket(dday);
  const bgClass =
    bucket === 'imminent'
      ? 'bg-red-500 text-white'
      : bucket === 'soon'
      ? 'bg-orange-500 text-white'
      : 'bg-slate-700 text-white';

  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-3 ${bgClass} ${className}`}
      role="timer"
      aria-live="polite"
    >
      <div className="flex flex-col">
        <span className="text-xs opacity-90">{label}</span>
        <time dateTime={target ?? undefined} className="text-3xl font-bold leading-none mt-1">
          D-{dday}
        </time>
      </div>
      <div className="text-xs opacity-80 text-right">
        {target && new Date(target).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
      </div>
    </div>
  );
}

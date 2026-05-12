// app/apt/[slug]/error.tsx
'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[apt-site-page]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-xl font-bold mb-2">페이지를 불러올 수 없습니다</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        잠시 후 다시 시도해주세요. 문제가 계속되면 카더라 운영진에게 알려주세요.
      </p>
      <button onClick={() => reset()} className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-black rounded-lg">
        다시 시도
      </button>
    </div>
  );
}

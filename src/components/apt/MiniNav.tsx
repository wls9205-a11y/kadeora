// components/apt/MiniNav.tsx
'use client';

import { useEffect, useState } from 'react';

const SECTIONS = [
  { id: 'price', label: '분양가' },
  { id: 'floorplan', label: '평면도' },
  { id: 'schedule', label: '일정' },
  { id: 'modelhouse', label: '모델하우스' },
  { id: 'reviews', label: '후기' },
  { id: 'faq', label: 'FAQ' },
];

export function MiniNav() {
  const [active, setActive] = useState<string>('price');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );

    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const handleClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 -mx-4 px-4">
      <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => handleClick(s.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              active === s.id
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-black'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// components/apt/FAQAccordion.tsx
'use client';

import { useState } from 'react';

export function FAQAccordion({ faqs }: { faqs: Array<{ q: string; a: string }> }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (!faqs || faqs.length === 0) return null;

  return (
    <div className="space-y-2">
      {faqs.map((f, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={idx}
            className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900"
          >
            <button
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="w-full text-left flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              aria-expanded={isOpen}
            >
              <span className="font-medium text-sm sm:text-base">{f.q}</span>
              <span
                className={`flex-shrink-0 transition-transform text-slate-400 ${
                  isOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800">
                {f.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

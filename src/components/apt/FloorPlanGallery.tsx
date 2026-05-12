// components/apt/FloorPlanGallery.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';

interface FloorPlanType {
  type?: string;
  area?: string | number;
  supply?: number;
  price_max?: number;
  imageUrl?: string;
}

export function FloorPlanGallery({
  types,
  floorPlanImages,
}: {
  types: FloorPlanType[];
  floorPlanImages?: Record<string, string>;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (!types || types.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
        평면도 자료가 준비 중입니다
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {types.map((t, idx) => {
          const imageUrl = t.imageUrl || (t.type && floorPlanImages?.[t.type]) || null;
          return (
            <button
              key={`${t.type}-${idx}`}
              onClick={() => imageUrl && setActiveIdx(idx)}
              className="text-left bg-slate-50 dark:bg-slate-800 rounded-xl p-3 hover:shadow-md transition-shadow"
              disabled={!imageUrl}
            >
              {imageUrl ? (
                <div className="aspect-square relative rounded-lg overflow-hidden mb-2 bg-white dark:bg-slate-700">
                  <Image
                    src={imageUrl}
                    alt={`${t.type} 평면도`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                </div>
              ) : (
                <div className="aspect-square rounded-lg mb-2 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-500">
                  평면도 준비중
                </div>
              )}
              <div className="text-sm font-bold">{t.type || '—'}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                {t.area ? `${parseFloat(String(t.area)).toFixed(1)}㎡` : ''}
                {t.supply ? ` · ${t.supply}세대` : ''}
              </div>
              {t.price_max && (
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                  최고 {(t.price_max / 10000).toFixed(2)}억
                </div>
              )}
            </button>
          );
        })}
      </div>

      {activeIdx !== null && types[activeIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setActiveIdx(null)}
        >
          <button
            onClick={() => setActiveIdx(null)}
            className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="닫기"
          >
            ✕
          </button>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const t = types[activeIdx];
              const imageUrl =
                t.imageUrl || (t.type && floorPlanImages?.[t.type]);
              return (
                <>
                  {imageUrl && (
                    <div className="relative w-full aspect-square sm:aspect-[4/3] mb-4">
                      <Image
                        src={imageUrl}
                        alt={`${t.type} 평면도 확대`}
                        fill
                        className="object-contain"
                        sizes="100vw"
                      />
                    </div>
                  )}
                  <div className="text-white text-center">
                    <div className="font-bold text-lg">{t.type}</div>
                    <div className="text-sm opacity-80">
                      {t.area ? `${parseFloat(String(t.area)).toFixed(1)}㎡` : ''}
                      {t.supply ? ` · ${t.supply}세대` : ''}
                      {t.price_max ? ` · 최고 ${(t.price_max / 10000).toFixed(2)}억` : ''}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}

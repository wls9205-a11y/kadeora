'use client';
import Image from 'next/image';
import { useState, useRef, useCallback } from 'react';

interface BlogImage {
  url: string;
  alt: string;
  caption?: string;
}

interface Props {
  images: BlogImage[];
  title: string;
  priority?: boolean;
}

export default function BlogHeroImage({ images, title, priority = true }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [loadError, setLoadError] = useState<Set<number>>(new Set());
  const touchStart = useRef<number | null>(null);

  const visibleImages = images.filter((_, i) => !loadError.has(i));
  const total = visibleImages.length;

  const goTo = useCallback((idx: number) => {
    setActiveIdx(Math.max(0, Math.min(idx, total - 1)));
  }, [total]);

  if (!total) return null;

  const current = visibleImages[activeIdx] || visibleImages[0];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      goTo(diff > 0 ? activeIdx + 1 : activeIdx - 1);
    }
    touchStart.current = null;
  };

  return (
    <figure style={{ margin: '0 0 20px', padding: 0 }}>
      {/* 메인 이미지 */}
      <div
        style={{
          position: 'relative', width: '100%', aspectRatio: '1200/630',
          borderRadius: 'var(--radius-card)', overflow: 'hidden',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={current.url}
          alt={current.alt || title}
          fill
          sizes="(max-width: 780px) 100vw, 720px"
          style={{ objectFit: 'cover', transition: 'opacity 0.3s ease' }}
          priority={priority && activeIdx === 0}
          onError={() => setLoadError(prev => new Set(prev).add(activeIdx))}
          unoptimized
        />

        {/* 이미지 카운터 (우상단) */}
        {total > 1 && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,0.55)', color: '#fff',
            fontSize: 11, fontWeight: 600, padding: '3px 10px',
            borderRadius: 12, backdropFilter: 'blur(4px)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {activeIdx + 1} / {total}
          </div>
        )}

        {/* 좌우 네비 화살표 (2장 이상) */}
        {total > 1 && activeIdx > 0 && (
          <button onClick={() => goTo(activeIdx - 1)} aria-label="이전 이미지" style={{
            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)', border: 'none', color: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)', fontSize: 16,
          }}>‹</button>
        )}
        {total > 1 && activeIdx < total - 1 && (
          <button onClick={() => goTo(activeIdx + 1)} aria-label="다음 이미지" style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)', border: 'none', color: '#fff',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)', fontSize: 16,
          }}>›</button>
        )}
      </div>

      {/* 캐러셀 도트 */}
      {total > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8,
        }}>
          {visibleImages.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`이미지 ${i + 1}`}
              style={{
                width: activeIdx === i ? 20 : 8, height: 8,
                borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0,
                background: activeIdx === i ? 'var(--brand)' : 'var(--border)',
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>
      )}

      {/* 캡션 */}
      {current.caption && (
        <figcaption style={{
          fontSize: 11, color: 'var(--text-tertiary)',
          textAlign: 'center', marginTop: 4, lineHeight: 1.5,
        }}>
          {current.caption}
        </figcaption>
      )}
    </figure>
  );
}

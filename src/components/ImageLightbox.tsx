'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

interface LightboxImage {
  url: string;
  caption?: string;
}

interface Props {
  images: LightboxImage[];
  initialIndex: number;
  onClose: () => void;
}

export default function ImageLightbox({ images, initialIndex, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex);
  const [zoom, setZoom] = useState(false);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const img = images[idx];
  const total = images.length;

  const prev = useCallback(() => setIdx(i => (i > 0 ? i - 1 : total - 1)), [total]);
  const next = useCallback(() => setIdx(i => (i < total - 1 ? i + 1 : 0)), [total]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  // Body scroll lock
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;
    touchStart.current = null;

    // Horizontal swipe (> 50px, < 300ms, mostly horizontal)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 300) {
      if (dx > 0) prev();
      else next();
    }
    // Vertical swipe down = close
    if (dy > 100 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      onClose();
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={(e) => { if (e.target === containerRef.current) onClose(); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        touchAction: 'pan-y',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="닫기"
        style={{
          position: 'absolute', top: 'max(12px, env(safe-area-inset-top))', right: 12, zIndex: 3,
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)', border: 'none',
          color: '#fff', fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>

      {/* Counter */}
      <div style={{
        position: 'absolute', top: 'max(18px, env(safe-area-inset-top))', left: '50%',
        transform: 'translateX(-50%)', zIndex: 3,
        fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600,
      }}>
        {idx + 1} / {total}
      </div>

      {/* Image */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', padding: '60px 16px 80px', overflow: 'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url.replace(/^http:\/\//, 'https://')}
          alt={img.caption || `이미지 ${idx + 1}`}
          onClick={() => setZoom(z => !z)}
          style={{
            maxWidth: zoom ? '200%' : '95vw',
            maxHeight: zoom ? 'none' : '80vh',
            objectFit: 'contain',
            borderRadius: 4,
            cursor: zoom ? 'zoom-out' : 'zoom-in',
            transition: 'transform 0.2s ease',
            userSelect: 'none',
          }}
          draggable={false}
        />
      </div>

      {/* Navigation arrows (desktop) */}
      {total > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="이전"
            style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="다음"
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: 'none',
              color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ›
          </button>
        </>
      )}

      {/* Caption + dots */}
      <div style={{
        position: 'absolute', bottom: 'max(16px, env(safe-area-inset-bottom))',
        left: 0, right: 0, textAlign: 'center', zIndex: 3,
      }}>
        {img.caption && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
            {img.caption}
          </div>
        )}
        {total > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                style={{
                  width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
                  border: 'none', cursor: 'pointer', padding: 0,
                  background: i === idx ? '#fff' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

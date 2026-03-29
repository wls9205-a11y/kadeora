'use client';
import { useState, useRef, useCallback } from 'react';

interface AptImage {
  url: string;
  thumbnail?: string;
  caption?: string;
}

/** 외부 이미지 → 카더라 워터마크 프록시 URL 변환 */
function toProxyUrl(url: string): string {
  // 이미 프록시 URL이면 그대로
  if (url.startsWith('/api/apt-img')) return url;
  // kadeora 자체 이미지면 프록시 불필요
  if (url.startsWith('/api/og') || url.includes('kadeora.app/api/')) return url;
  return `/api/apt-img?src=${encodeURIComponent(url)}`;
}

const Watermark = () => (
  <svg width="100" height="100" viewBox="0 0 72 72" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.35, pointerEvents: 'none', zIndex: 1 }}>
    <rect width="72" height="72" rx="18" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
    <circle cx="18" cy="36" r="6.5" fill="rgba(255,255,255,0.7)" />
    <circle cx="36" cy="36" r="6.5" fill="rgba(255,255,255,0.7)" />
    <circle cx="54" cy="36" r="6.5" fill="rgba(255,255,255,0.7)" />
  </svg>
);

const WatermarkSm = () => (
  <div style={{ position: 'absolute', bottom: 8, right: 42, opacity: 0.6, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 4, zIndex: 1 }}>
    <svg width="14" height="14" viewBox="0 0 72 72">
      <circle cx="18" cy="36" r="7" fill="rgba(255,255,255,0.8)" />
      <circle cx="36" cy="36" r="7" fill="rgba(255,255,255,0.8)" />
      <circle cx="54" cy="36" r="7" fill="rgba(255,255,255,0.8)" />
    </svg>
    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>kadeora.app</span>
  </div>
);

export default function AptImageGallery({ images, name, region, badges }: {
  images: AptImage[];
  name: string;
  region: string;
  badges?: React.ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [loadFails, setLoadFails] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const safeImages = images.map(img => ({ ...img, url: toProxyUrl(img.url) }));
  const visibleImages = safeImages.filter((_, i) => !loadFails.has(i));
  const total = visibleImages.length;

  const handleImgError = useCallback((originalIdx: number) => {
    setLoadFails((prev: Set<number>) => new Set(prev).add(originalIdx));
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    setIdx(Math.round(scrollLeft / clientWidth));
  };

  const goTo = (i: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: i * scrollRef.current.clientWidth, behavior: 'smooth' });
  };

  if (total === 0) return null;

  return (
    <>
      <div style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden', background: '#0c1629' }}>
        {/* 모바일: 스와이프 갤러리 */}
        <div className="md:hidden">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            } as React.CSSProperties}
          >
            {visibleImages.map((img, i) => (
              <div key={i} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', position: 'relative' }}>
                <div
                  style={{ position: 'relative', height: 220, overflow: 'hidden', background: '#0c1629', cursor: 'pointer' }}
                  onClick={() => setLightbox(i)}
                >
                  <img
                    src={img.url} alt={img.caption || `${name} 현장 사진 ${i + 1}`}
                    width={720} height={400}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    referrerPolicy="no-referrer"
                    onError={() => handleImgError(images.findIndex(o => toProxyUrl(o.url) === img.url))}
                  />
                  <Watermark />
                  <WatermarkSm />
                  {i === 0 && badges}
                  <span style={{
                    position: 'absolute', bottom: 8, right: 8,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    fontSize: 11, padding: '3px 10px', borderRadius: 12, zIndex: 1,
                  }}>{i + 1} / {total}</span>
                </div>
                {img.caption && (
                  <div style={{
                    padding: '6px 12px', background: 'rgba(0,0,0,0.4)',
                    color: 'rgba(255,255,255,0.7)', fontSize: 11,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{img.caption}</div>
                )}
              </div>
            ))}
          </div>
          {total > 1 && (
            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', padding: '6px 0' }}>
              {visibleImages.map((_, i) => (
                <div
                  key={i}
                  onClick={() => goTo(i)}
                  style={{
                    width: i === idx ? 16 : 6, height: 6, borderRadius: 3,
                    background: i === idx ? '#fff' : 'rgba(255,255,255,0.25)',
                    transition: 'all 0.2s', cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 데스크탑: 1+2 그리드 */}
        <div className="hidden md:block">
          <div style={{
            display: 'grid',
            gridTemplateColumns: total >= 3 ? '2fr 1fr' : '1fr',
            gridTemplateRows: total >= 3 ? '1fr 1fr' : 'auto',
            gap: 3, height: 280,
          }}>
            <div
              style={{ position: 'relative', overflow: 'hidden', gridRow: total >= 3 ? '1 / 3' : 'auto', background: '#162035', cursor: 'pointer' }}
              onClick={() => setLightbox(0)}
            >
              <img
                src={visibleImages[0].url} alt={visibleImages[0].caption || `${name} 대표 이미지`}
                width={720} height={400}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                loading="eager" referrerPolicy="no-referrer"
              />
              <Watermark />
              <WatermarkSm />
              {badges}
            </div>
            {visibleImages.slice(1, 3).map((img, i) => (
              <div
                key={i}
                style={{ position: 'relative', overflow: 'hidden', background: '#162035', cursor: 'pointer' }}
                onClick={() => setLightbox(i + 1)}
              >
                <img
                  src={img.url} alt={img.caption || `${name} 사진 ${i + 2}`}
                  width={360} height={200}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading="lazy" referrerPolicy="no-referrer"
                />
                <WatermarkSm />
                {i === 1 && total > 3 && (
                  <span style={{
                    position: 'absolute', bottom: 8, right: 8,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    fontSize: 12, padding: '4px 12px', borderRadius: 12, fontWeight: 600,
                  }}>+{total - 3}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 라이트박스 — 클릭 시 전체화면 이미지 뷰어 */}
      {lightbox !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 10,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>

          <div style={{
            position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
            color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600,
          }}>{lightbox + 1} / {total}</div>

          <div onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '80vh' }}>
            <img
              src={visibleImages[lightbox]?.url}
              alt={visibleImages[lightbox]?.caption || `${name} 사진 ${lightbox + 1}`}
              style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }}
              referrerPolicy="no-referrer"
            />
            <Watermark />
            <WatermarkSm />
          </div>

          {visibleImages[lightbox]?.caption && (
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 12, textAlign: 'center', maxWidth: '80vw' }}>
              {visibleImages[lightbox].caption}
            </div>
          )}

          {lightbox > 0 && (
            <button
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#fff', fontSize: 22, cursor: 'pointer',
              }}
            >‹</button>
          )}
          {lightbox < total - 1 && (
            <button
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#fff', fontSize: 22, cursor: 'pointer',
              }}
            >›</button>
          )}
        </div>
      )}
    </>
  );
}

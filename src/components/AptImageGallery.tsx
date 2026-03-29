'use client';
import { useState, useRef } from 'react';

interface AptImage {
  url: string;
  thumbnail?: string;
  caption?: string;
}

const WATERMARK = (
  <svg width="72" height="72" viewBox="0 0 72 72" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.2, pointerEvents: 'none' }}>
    <rect width="72" height="72" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
    <circle cx="18" cy="36" r="6" fill="rgba(255,255,255,0.5)" />
    <circle cx="36" cy="36" r="6" fill="rgba(255,255,255,0.5)" />
    <circle cx="54" cy="36" r="6" fill="rgba(255,255,255,0.5)" />
  </svg>
);

const WATERMARK_SM = (
  <div style={{ position: 'absolute', bottom: 6, right: 8, opacity: 0.4, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
    <svg width="12" height="12" viewBox="0 0 72 72">
      <circle cx="18" cy="36" r="7" fill="rgba(255,255,255,0.6)" />
      <circle cx="36" cy="36" r="7" fill="rgba(255,255,255,0.6)" />
      <circle cx="54" cy="36" r="7" fill="rgba(255,255,255,0.6)" />
    </svg>
    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>kadeora.app</span>
  </div>
);

export default function AptImageGallery({ images, name, region, badges }: {
  images: AptImage[];
  name: string;
  region: string;
  badges?: React.ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const total = images.length;

  if (total === 0) return null;

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    setIdx(Math.round(scrollLeft / clientWidth));
  };

  const goTo = (i: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: i * scrollRef.current.clientWidth, behavior: 'smooth' });
  };

  return (
    <div style={{ marginBottom: 10, borderRadius: 12, overflow: 'hidden', background: '#0c1629' }}>
      {/* 모바일: 스와이프 갤러리 */}
      <div className="md:hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
          }}
        >
          {images.map((img, i) => (
            <div key={i} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', position: 'relative' }}>
              <div style={{ position: 'relative', height: 220, overflow: 'hidden', background: '#0c1629' }}>
                <img
                  src={img.url} alt={img.caption || `${name} 현장 사진 ${i + 1}`}
                  width={720} height={400}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {WATERMARK}
                {WATERMARK_SM}
                {i === 0 && badges}
                {/* 카운터 */}
                <span style={{
                  position: 'absolute', bottom: 8, right: 8,
                  background: 'rgba(0,0,0,0.6)', color: '#fff',
                  fontSize: 11, padding: '3px 10px', borderRadius: 12,
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
        {/* 도트 인디케이터 */}
        {total > 1 && (
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', padding: '6px 0' }}>
            {images.map((_, i) => (
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
          {/* 메인 이미지 */}
          <div style={{ position: 'relative', overflow: 'hidden', gridRow: total >= 3 ? '1 / 3' : 'auto', background: '#162035' }}>
            <img
              src={images[0].url} alt={images[0].caption || `${name} 대표 이미지`}
              width={720} height={400}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              loading="eager"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {WATERMARK}
            {WATERMARK_SM}
            {badges}
          </div>
          {/* 서브 이미지 */}
          {images.slice(1, 3).map((img, i) => (
            <div key={i} style={{ position: 'relative', overflow: 'hidden', background: '#162035' }}>
              <img
                src={img.url} alt={img.caption || `${name} 사진 ${i + 2}`}
                width={360} height={200}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              {WATERMARK_SM}
              {/* 마지막 서브 이미지에 "+N" 카운터 */}
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
  );
}

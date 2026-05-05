'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import ImageLightbox from '@/components/ImageLightbox';

interface AptImage {
  url: string;
  thumbnail?: string;
  caption?: string;
}

/** http:// → https:// 강제 변환 (Mixed Content 방지) */
function toHttps(url: string): string {
  return url.replace(/^http:\/\//, 'https://');
}

function isSatellite(url: string): boolean {
  return url.includes('/api/satellite');
}

const SatelliteBadge = () => (
  <span style={{
    position: 'absolute', top: 8, right: 8, zIndex: 2,
    background: 'rgba(0,0,0,0.6)', color: '#fff',
    fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-card)',
    display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600,
  }}>
    🛰️ 위성 사진
  </span>
);

/** CSS 오버레이 워터마크 — 중앙 로고 (recommended 35%) */
const Watermark = () => (
  <svg width="100" height="100" viewBox="0 0 72 72" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.35, pointerEvents: 'none', zIndex: 1 }}>
    <rect width="72" height="72" rx="18" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
    <circle cx="18" cy="36" r="6.5" fill="rgba(255,255,255,0.7)" />
    <circle cx="36" cy="36" r="6.5" fill="rgba(255,255,255,0.7)" />
    <circle cx="54" cy="36" r="6.5" fill="rgba(255,255,255,0.7)" />
  </svg>
);

/** CSS 오버레이 워터마크 — 우하단 텍스트 (recommended 60%) */
const WatermarkSm = () => (
  <div style={{ position: 'absolute', bottom: 8, right: 42, opacity: 0.6, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)', zIndex: 1 }}>
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
  const [isDesktop, setIsDesktop] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 혼합 타입(string | object) 정규화 — url 누락 항목은 제거
  const normalized = (images || []).map((img: any) =>
    typeof img === 'string' ? { url: img } : img
  ).filter((img: any) => img?.url);

  // SSR-safe 데스크탑 판정
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener?.('change', update);
    return () => mql.removeEventListener?.('change', update);
  }, []);

  const safeImages = normalized.map((img: any) => ({ ...img, url: toHttps(img.url) }));
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

  if (total === 0) {
    // 모든 이미지 로드 실패 → 그라데이션 폴백 UI (badges 유지)
    return (
      <div style={{
        position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 14,
        height: 140,
        background: 'linear-gradient(135deg, #0c1629 0%, #1a3050 50%, #1e3a8a 100%)',
      }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 'var(--sp-xs)' }}>{region}</div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, color: '#fff', lineHeight: 1.2, wordBreak: 'keep-all' }}>{name}</div>
        </div>
        {badges}
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 10, borderRadius: 'var(--radius-card)', overflow: 'hidden', background: '#0c1629' }}>
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
                    src={img.url} alt={img.caption || `${name} ${region} 아파트 현장 사진 ${i + 1}`}
                    width={720} height={400}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    referrerPolicy="no-referrer"
                    onError={() => handleImgError(normalized.findIndex((o: any) => toHttps(o.url) === img.url))}
                  />
                  <Watermark />
                  <WatermarkSm />
                  {isSatellite(img.url) && <SatelliteBadge />}
                  {i === 0 && badges}
                  <span style={{
                    position: 'absolute', bottom: 8, right: 8,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    fontSize: 11, padding: '3px 10px', borderRadius: 'var(--radius-card)', zIndex: 1,
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
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '6px 0' }}>
              {visibleImages.map((_, i) => (
                <div
                  key={i}
                  onClick={() => goTo(i)}
                  style={{
                    width: i === idx ? 16 : 6, height: 6, borderRadius: 4,
                    background: i === idx ? '#fff' : 'rgba(255,255,255,0.25)',
                    transition: 'all var(--transition-normal)', cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 데스크탑: 1+4 그리드 (matchMedia + Tailwind 양쪽 가드 — SSR 시 모바일 우선) */}
        {isDesktop && (
        <div className="hidden md:block">
          {total === 1 ? (
            // 1장: 풀폭
            <div
              style={{ position: 'relative', overflow: 'hidden', maxHeight: 480, aspectRatio: '4/3', background: '#162035', cursor: 'pointer' }}
              onClick={() => setLightbox(0)}
            >
              <img
                src={visibleImages[0].url} alt={visibleImages[0].caption || `${name} ${region} 아파트 대표 이미지`}
                width={1280} height={960}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                loading="eager" referrerPolicy="no-referrer"
                onError={() => handleImgError(normalized.findIndex((o: any) => toHttps(o.url) === visibleImages[0].url))}
              />
              <Watermark />
              <WatermarkSm />
              {isSatellite(visibleImages[0].url) && <SatelliteBadge />}
              {badges}
            </div>
          ) : total === 2 ? (
            // 2장: 좌우 분할
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxHeight: 480 }}>
              {visibleImages.slice(0, 2).map((img, i) => (
                <div
                  key={i}
                  style={{ position: 'relative', overflow: 'hidden', aspectRatio: '4/3', background: '#162035', cursor: 'pointer' }}
                  onClick={() => setLightbox(i)}
                >
                  <img
                    src={img.url} alt={img.caption || `${name} ${region} 아파트 사진 ${i + 1}`}
                    width={720} height={540}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading={i === 0 ? 'eager' : 'lazy'} referrerPolicy="no-referrer"
                    onError={() => handleImgError(normalized.findIndex((o: any) => toHttps(o.url) === img.url))}
                  />
                  {i === 0 && <Watermark />}
                  <WatermarkSm />
                  {isSatellite(img.url) && <SatelliteBadge />}
                  {i === 0 && badges}
                </div>
              ))}
            </div>
          ) : (
            // 3+장: 좌측 대표 + 우측 2x2 썸네일
            <div style={{ position: 'relative' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gap: 4, maxHeight: 480,
              }}>
                {/* 대표 이미지 — 좌측 2행 span */}
                <div
                  style={{ position: 'relative', overflow: 'hidden', gridRow: '1 / 3', aspectRatio: '4/3', background: '#162035', cursor: 'pointer' }}
                  onClick={() => setLightbox(0)}
                >
                  <img
                    src={visibleImages[0].url} alt={visibleImages[0].caption || `${name} ${region} 아파트 대표 이미지`}
                    width={1280} height={960}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="eager" referrerPolicy="no-referrer"
                    onError={() => handleImgError(normalized.findIndex((o: any) => toHttps(o.url) === visibleImages[0].url))}
                  />
                  <Watermark />
                  <WatermarkSm />
                  {isSatellite(visibleImages[0].url) && <SatelliteBadge />}
                  {badges}
                </div>
                {/* 썸네일 4장 (2x2) */}
                {visibleImages.slice(1, 5).map((img, i) => (
                  <div
                    key={i}
                    style={{ position: 'relative', overflow: 'hidden', aspectRatio: '4/3', background: '#162035', cursor: 'pointer' }}
                    onClick={() => setLightbox(i + 1)}
                  >
                    <img
                      src={img.url} alt={img.caption || `${name} ${region} 아파트 사진 ${i + 2}`}
                      width={480} height={360}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading="lazy" referrerPolicy="no-referrer"
                      onError={() => handleImgError(normalized.findIndex((o: any) => toHttps(o.url) === img.url))}
                    />
                    <WatermarkSm />
                    {isSatellite(img.url) && <SatelliteBadge />}
                  </div>
                ))}
              </div>
              {/* 전체보기 버튼 (N > 5) */}
              {total > 5 && (
                <button
                  type="button"
                  onClick={() => setLightbox(0)}
                  style={{
                    position: 'absolute', bottom: 12, right: 12,
                    background: 'rgba(0,0,0,0.7)', color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontSize: 13, padding: '8px 14px', borderRadius: 'var(--radius-card)',
                    fontWeight: 600, cursor: 'pointer', zIndex: 2,
                  }}
                >
                  전체보기 ({total})
                </button>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* 라이트박스 — 풀스크린 뷰어 (스와이프/키보드/핀치줌 지원) */}
      {lightbox !== null && (
        <ImageLightbox
          images={visibleImages.map((img, i) => ({ url: img.url, caption: img.caption || `${name} 사진 ${i + 1}` }))}
          initialIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* JSON-LD: ImageGallery + ImageObject — SEO 풍부한 결과 노출 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ImageGallery',
            name: '단지 사진',
            image: normalized.map((img: any, i: number) => ({
              '@type': 'ImageObject',
              contentUrl: img.url,
              thumbnailUrl: img.thumbnail || img.thumb || img.url,
              caption: img.caption || `이미지 ${i + 1}`,
            })),
          }),
        }}
      />
    </>
  );
}

'use client';
import Image from 'next/image';
import { useState } from 'react';

interface BlogImage {
  url: string;
  alt: string;
  caption?: string;
  type?: string;
}

interface Props {
  images: BlogImage[];
  title: string;
  priority?: boolean;
}

export default function BlogHeroImage({ images, title, priority = true }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [loadError, setLoadError] = useState<Set<number>>(new Set());

  if (!images.length) return null;

  const visibleImages = images.filter((_, i) => !loadError.has(i));
  if (!visibleImages.length) return null;

  const single = visibleImages.length === 1;
  const current = visibleImages[activeIdx] || visibleImages[0];

  return (
    <figure style={{ margin: '0 0 20px', padding: 0 }}>
      {/* 메인 이미지 */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '1200/630',
        borderRadius: 'var(--radius-card)', overflow: 'hidden',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
      }}>
        <Image
          src={current.url}
          alt={current.alt || title}
          fill
          sizes="(max-width: 780px) 100vw, 720px"
          style={{ objectFit: 'cover' }}
          priority={priority}
          onError={() => setLoadError(prev => new Set(prev).add(activeIdx))}
          unoptimized
        />
      </div>

      {/* 캐러셀 도트 (2장 이상일 때) */}
      {!single && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6,
          marginTop: 8,
        }}>
          {visibleImages.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              aria-label={`이미지 ${i + 1}`}
              style={{
                width: activeIdx === i ? 20 : 8, height: 8,
                borderRadius: 4, border: 'none', cursor: 'pointer',
                background: activeIdx === i ? 'var(--brand)' : 'var(--border)',
                transition: 'all 0.2s ease',
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* 캡션 */}
      {current.caption && (
        <figcaption style={{
          fontSize: 12, color: 'var(--text-tertiary)',
          textAlign: 'center', marginTop: 6, lineHeight: 1.5,
        }}>
          {current.caption}
        </figcaption>
      )}
    </figure>
  );
}

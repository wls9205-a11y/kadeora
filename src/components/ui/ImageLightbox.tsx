'use client';

import { useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';

type ImgItem = { url: string; caption?: string | null; alt?: string | null };

export function ImageLightbox({
  images,
  columns = 3,
  aspectRatio = '4 / 3',
}: {
  images: ImgItem[];
  columns?: 2 | 3;
  aspectRatio?: string;
}) {
  const [index, setIndex] = useState(-1);
  if (!images?.length) return null;

  const gridCls = columns === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3';

  return (
    <>
      <div
        className={`grid ${gridCls} gap-2`}
        style={{ display: 'grid', gridTemplateColumns: columns === 2 ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)', gap: 8 }}
      >
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`이미지 ${i + 1} 확대 보기`}
            style={{
              overflow: 'hidden',
              borderRadius: 8,
              background: 'var(--bg-surface, #f4f4f5)',
              border: '0.5px solid var(--border, #e4e4e7)',
              padding: 0,
              cursor: 'zoom-in',
              aspectRatio,
              display: 'block',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt ?? img.caption ?? `이미지 ${i + 1}`}
              loading={i < 3 ? 'eager' : 'lazy'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.visibility = 'hidden';
              }}
            />
          </button>
        ))}
      </div>
      <Lightbox
        open={index >= 0}
        close={() => setIndex(-1)}
        index={Math.max(0, index)}
        slides={images.map((img) => ({
          src: img.url,
          alt: img.alt ?? img.caption ?? undefined,
          description: img.caption ?? undefined,
        }))}
        plugins={[Zoom, Counter]}
        controller={{ closeOnBackdropClick: true }}
        zoom={{ maxZoomPixelRatio: 3 }}
      />
    </>
  );
}

export default ImageLightbox;

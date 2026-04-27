import React from 'react';

interface OgCard {
  idx: number;
  type: string;
  url: string;
  alt?: string;
}

interface CardCarouselProps {
  slug: string;
  name: string;
  cards?: OgCard[] | null;
}

const FALLBACK_TYPES = ['cover', 'metric', 'units', 'timing', 'place', 'spec'];

export default function CardCarousel({ slug, name, cards }: CardCarouselProps) {
  const list: OgCard[] = Array.isArray(cards) && cards.length === 6
    ? cards
    : FALLBACK_TYPES.map((type, i) => ({
        idx: i + 1,
        type,
        url: `/api/og-apt?slug=${encodeURIComponent(slug)}&card=${i + 1}&v=1`,
        alt: `${name} ${type}`,
      }));

  return (
    <section
      aria-label={`${name} 카드 6장`}
      style={{ margin: '20px -16px 24px' }}
    >
      <div
        className="kd-card-carousel"
        style={{
          display: 'flex',
          gap: 12,
          padding: '0 16px',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {list.map((c) => (
          <div
            key={c.idx}
            style={{
              flex: '0 0 80%',
              maxWidth: 320,
              aspectRatio: '1 / 1',
              scrollSnapAlign: 'start',
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              position: 'relative',
            }}
          >
            <img
              src={c.url}
              alt={c.alt || `${name} ${c.type}`}
              loading="lazy"
              decoding="async"
              width={630}
              height={630}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ))}
      </div>
      <style>{`
        .kd-card-carousel::-webkit-scrollbar { display: none; }
        @media (min-width: 640px) {
          .kd-card-carousel > div { flex: 0 0 calc((100% - 24px) / 3) !important; max-width: none !important; }
        }
      `}</style>
    </section>
  );
}

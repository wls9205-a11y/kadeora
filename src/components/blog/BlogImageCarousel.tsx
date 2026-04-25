/**
 * BlogImageCarousel — 블로그 본문 상단 횡스크롤 이미지 캐러셀.
 *
 * - 실 이미지가 있으면 url 기반 카드. 없으면 카테고리 이모지+그라데이션 fallback.
 * - 각 카드: <figure itemScope itemType="ImageObject"> + <figcaption> (네이버 이미지탭/구글 리치)
 * - scroll-snap, scrollbar 숨김, 모바일/터치 OK
 * - 다크/라이트 모두 --blog-* 토큰 사용
 *
 * Props:
 *   images: { url, alt?, caption? }[]
 *   title: string
 *   category: string
 *
 * 결과: images.length < 2 → null (단일 이미지 캐러셀 의미 없음)
 */

interface CarouselImage {
  url: string;
  alt?: string | null;
  caption?: string | null;
}

interface Props {
  images: CarouselImage[];
  title: string;
  category: string;
}

const CATEGORY_EMOJIS: Record<string, string[]> = {
  apt: ['🏗️', '🏙️', '📊', '📐', '💰', '🗺️'],
  unsold: ['🏚️', '📉', '🗺️', '💰', '📋', '🔍'],
  stock: ['📈', '💹', '📊', '🏦', '💰', '🔔'],
  finance: ['💡', '💰', '📊', '🧮', '📈', '🏦'],
  general: ['💡', '📱', '🏠', '🔧', '📋', '✨'],
  default: ['📰', '📋', '💡', '🔍', '📊', '✨'],
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  apt: 'linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.05) 100%)',
  unsold: 'linear-gradient(135deg, rgba(251,146,60,0.18) 0%, rgba(251,146,60,0.05) 100%)',
  stock: 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.05) 100%)',
  finance: 'linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0.05) 100%)',
  general: 'linear-gradient(135deg, rgba(148,163,184,0.18) 0%, rgba(148,163,184,0.05) 100%)',
  default: 'linear-gradient(135deg, rgba(96,165,250,0.18) 0%, rgba(96,165,250,0.05) 100%)',
};

const CATEGORY_LABEL: Record<string, string> = {
  apt: '청약·분양',
  unsold: '미분양',
  stock: '주식',
  finance: '재테크',
  general: '생활',
};

export default function BlogImageCarousel({ images, title, category }: Props) {
  const real = (images || []).filter(i => i?.url && !/\/api\/og/.test(i.url));
  const usingFallback = real.length === 0;

  const emojis = CATEGORY_EMOJIS[category] || CATEGORY_EMOJIS.default;
  const gradient = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.default;
  const label = CATEGORY_LABEL[category] || category;

  // 실이미지 < 2 + fallback 미사용 → 표시 의미 없음
  if (real.length === 1 && !usingFallback) return null;

  const items = usingFallback
    ? emojis.map((e, i) => ({
        emoji: e,
        url: null as string | null,
        alt: `${title} — ${label} 이미지 ${i + 1}`,
        caption: null as string | null,
      }))
    : real.slice(0, 8).map((img, i) => ({
        emoji: null as string | null,
        url: img.url,
        alt: img.alt || `${title} — ${label} 이미지 ${i + 1}`,
        caption: img.caption ?? null,
      }));

  if (items.length < 2) return null;

  return (
    <section
      aria-label={`${title} 이미지 캐러셀`}
      style={{ margin: '0 -16px 18px', padding: '0 16px' }}
    >
      <div
        className="kd-blog-carousel"
        style={{
          display: 'flex',
          gap: 14,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: 4,
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((it, i) => (
          <figure
            key={i}
            itemScope
            itemType="https://schema.org/ImageObject"
            style={{
              flex: '0 0 170px',
              scrollSnapAlign: 'start',
              margin: 0,
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid var(--blog-info-box-border, var(--border))',
              background: 'var(--blog-carousel-bg, var(--bg-surface))',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            }}
            className="kd-blog-carousel-card"
          >
            <div
              style={{
                height: 120,
                background: it.url
                  ? `url('${it.url}') center/cover no-repeat, ${gradient}`
                  : gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 42,
                lineHeight: 1,
              }}
              aria-hidden={it.url ? undefined : true}
            >
              {!it.url && it.emoji}
              {it.url && <meta itemProp="contentUrl" content={it.url} />}
              <meta itemProp="name" content={it.alt} />
            </div>
            <figcaption
              style={{
                padding: '8px 10px 10px',
                fontSize: 11,
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
              }}
              itemProp="caption"
            >
              <span
                style={{
                  display: 'block',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontSize: 11.5,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {it.caption || it.alt}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  marginTop: 2,
                  display: 'block',
                }}
              >
                kadeora.app · {label}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `.kd-blog-carousel::-webkit-scrollbar{display:none}@media (hover:hover){.kd-blog-carousel-card:hover{transform:translateY(-3px);box-shadow:0 8px 18px rgba(0,0,0,0.12)}}` }} />
    </section>
  );
}

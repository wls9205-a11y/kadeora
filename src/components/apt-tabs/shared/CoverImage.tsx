/**
 * CoverImage
 *
 * 단지 대표 이미지. cover_image_url 있으면 next/image로 렌더, 없으면 InitialPlaceholder.
 * cover_image_kind에 따라 우상단 라벨 자동 표시 (조감도/위성뷰/AI 일러스트).
 */

import Image from 'next/image';
import { InitialPlaceholder } from './InitialPlaceholder';
import type { AptSiteCover } from '../types';

type Props = {
  site: AptSiteCover;
  aspectRatio?: string;
  priority?: boolean;
  sizes?: string;
  showKindLabel?: boolean;
  className?: string;
};

const KIND_LABELS = {
  official: '조감도',
  satellite: '위성뷰',
  ai: 'AI 일러스트',
  initial: '',
} as const;

export function CoverImage({
  site,
  aspectRatio = '16/9',
  priority = false,
  sizes = '(max-width: 768px) 100vw, 50vw',
  showKindLabel = true,
  className,
}: Props) {
  const wrapperStyle: React.CSSProperties = {
    aspectRatio,
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    background: 'var(--aptr-bg-elevated)',
  };

  // 4차 폴백
  if (!site.cover_image_url) {
    return (
      <div className={className} style={wrapperStyle}>
        <InitialPlaceholder name={site.name} />
      </div>
    );
  }

  const kindLabel = site.cover_image_kind ? KIND_LABELS[site.cover_image_kind] : '';
  const altKind = kindLabel || '대표 이미지';

  return (
    <div className={className} style={wrapperStyle}>
      <Image
        src={site.cover_image_url}
        alt={`${site.name} ${altKind}`}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={site.cover_image_blurhash ? 'blur' : 'empty'}
        blurDataURL={site.cover_image_blurhash ?? undefined}
        style={{ objectFit: 'cover' }}
      />
      {showKindLabel && kindLabel ? (
        <span
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '3px 7px',
            fontSize: '10px',
            fontWeight: 500,
            borderRadius: 'var(--aptr-radius-xs)',
            background: 'var(--aptr-image-overlay-bg)',
            color: 'var(--aptr-image-overlay-fg)',
            letterSpacing: '0.2px',
            wordBreak: 'keep-all',
          }}
        >
          {kindLabel}
        </span>
      ) : null}
    </div>
  );
}

'use client';

// v3 커밋3 — 현장 상세 히어로.
//
// 이미지 체인은 페이지 쪽에서 정한다 (hero_image_url → satellite_image_url → 없음).
// ⚠️ 3순위를 생성 카드로 채우지 말 것 — 이미지가 있는 척이 된다 (s7-2 결정).
//    src 가 비면 여기서도 사진 자리를 만들지 않고, 같은 비율의 텍스트 폴백만 낸다.
//
// h1 은 이 캡션 안에 하나만 있다. 캡션을 따로 만들고 h1 을 sr-only 로 남기면
// 같은 문구가 두 번 나온다 — children 으로 받아 서버에서 그대로 렌더한다.
//
// ⚠️ LCP. 위성 webp 1024px 가 최상단 전폭으로 오면 이 이미지가 LCP 요소다.
//    eager + fetchPriority=high 를 떼지 말 것. 페이지 쪽 preload 링크와 짝이다.

import { useState } from 'react';
import ImageLightbox from '@/components/ImageLightbox';

/** http:// → https:// 강제 변환 (Mixed Content 방지) */
function toHttps(url: string): string {
  return url.replace(/^http:\/\//, 'https://');
}

/** CSS 오버레이 워터마크 — 우하단 텍스트. AptImageGallery 와 같은 마크. */
const WatermarkSm = () => (
  <div
    aria-hidden="true"
    style={{
      position: 'absolute', bottom: 8, left: 12, opacity: 0.55, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 4, zIndex: 2,
    }}
  >
    <svg width="13" height="13" viewBox="0 0 72 72">
      <circle cx="18" cy="36" r="7" fill="rgba(255,255,255,0.85)" />
      <circle cx="36" cy="36" r="7" fill="rgba(255,255,255,0.85)" />
      <circle cx="54" cy="36" r="7" fill="rgba(255,255,255,0.85)" />
    </svg>
    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>kadeora.app</span>
  </div>
);

export type SiteHeroProps = {
  /** '' 이면 사진 없이 텍스트 폴백을 같은 비율로 낸다. */
  src: string;
  name: string;
  region: string;
  /** 출처 표기 — 우하단. */
  credit: string;
  /** 좌상단 배지 묶음. */
  badges?: React.ReactNode;
  /** h1 + 보조줄. 서버에서 넘긴다. */
  children: React.ReactNode;
};

export default function SiteHero({ src, name, region, credit, badges, children }: SiteHeroProps) {
  const [lightbox, setLightbox] = useState(false);
  const [failed, setFailed] = useState(false);

  const url = src ? toHttps(src) : '';
  const hasImage = !!url && !failed;

  return (
    <>
      <style>{`
        /* 아티클 좌우 패딩을 상쇄해 컨테이너 전폭으로 눕힌다 */
        .kd-hero {
          position: relative;
          margin: 0 calc(-1 * var(--sp-lg)) 14px;
          overflow: hidden;
          background: var(--bg-elevated);
          aspect-ratio: 4 / 3;
        }
        @media (min-width: 768px) {
          .kd-hero { aspect-ratio: 21 / 9; border-radius: var(--radius-lg); margin-inline: 0; }
        }
        .kd-hero-img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        /* 캡션 가독성 — 아래쪽 그라데이션. 흰 글자는 이 위에서만 쓴다 */
        .kd-hero-scrim {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background: linear-gradient(transparent, rgba(9,13,20,.55));
        }
      `}</style>

      <div className="kd-hero">
        {hasImage ? (
          <>
            <img
              src={url}
              alt={`${name} ${region} 현장 이미지`}
              width={1280}
              height={720}
              className="kd-hero-img"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
              onClick={() => setLightbox(true)}
              style={{ cursor: 'zoom-in' }}
            />
            <div className="kd-hero-scrim" />
            <WatermarkSm />
          </>
        ) : (
          // 사진 없는 현장 — 위성 미보유 520건 + 좌표 없음 75건. 드문 경우가 아니다.
          // 같은 비율을 지켜 목록 → 상세 사이 레이아웃 점프를 없앤다.
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(160deg, var(--bg-elevated), var(--bg-sunken))',
            }}
          />
        )}

        {/* 배지 — 좌상단 */}
        {badges}

        {/* 출처 — 우하단 */}
        {hasImage && credit && (
          <div
            style={{
              position: 'absolute', right: 12, bottom: 8, zIndex: 2, maxWidth: '60%',
              fontSize: 10.5, lineHeight: 1.4, textAlign: 'right',
              color: 'rgba(255,255,255,0.86)',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {credit}
          </div>
        )}

        {/* 캡션 — h1 + 보조줄. 사진이 없으면 본문색으로 뒤집는다 */}
        <div
          data-kd-hero-caption={hasImage ? 'on-image' : 'plain'}
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2,
            padding: '14px 16px 26px',
            color: hasImage ? '#FFFFFF' : 'var(--text-primary)',
            textShadow: hasImage ? '0 1px 3px rgba(0,0,0,0.55)' : 'none',
          }}
        >
          {children}
        </div>
      </div>

      {lightbox && hasImage && (
        <ImageLightbox
          images={[{ url, caption: credit || `${name} 현장 이미지` }]}
          initialIndex={0}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  );
}

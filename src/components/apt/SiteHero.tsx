'use client';

// v3 커밋3 — 현장 상세 히어로.
//
// 이미지 체인은 페이지 쪽에서 정한다.
//   조감도(hero_image_url) → 생성 카드(og-apt) → 위성(satellite_image_url) → 없음
//   ⚠️ 단, 기축(post_move_in·landmark_active)은 카드를 건너뛰고 위성을 그대로 쓴다.
//      준공된 단지는 항공 사진 자체가 정보다 (ADDENDUM §6-4 · 리스크 8).
//
// ⚠️ s7-2 의 "3순위를 생성 카드로 채우지 말 것" 은 **철회됐다** (ADDENDUM §6-4).
//    그때의 걱정은 '사진이 있는 척'이었는데, og-apt 카드는 사진처럼 보이지 않는
//    명백한 생성 그래픽이고 목록 썸네일(get_apt_pipeline 의 thumb_mode
//    'card_before_satellite')과 같은 이미지다. 목록과 상세가 다른 그림을 쓰면
//    같은 현장이 두 얼굴이 된다.
//    다만 카드는 **사진이 아니므로** variant='card' 로 따로 다룬다 — 아래 참고.
//
// src 가 비면 사진 자리를 만들지 않고 같은 비율의 텍스트 폴백만 낸다.
//
// h1 은 이 캡션 안에 하나만 있다. 캡션을 따로 만들고 h1 을 sr-only 로 남기면
// 같은 문구가 두 번 나온다 — children 으로 받아 서버에서 그대로 렌더한다.
//
// ⚠️ LCP. 위성 webp 1024px 가 최상단 전폭으로 오면 이 이미지가 LCP 요소다.
//    eager + fetchPriority=high 를 떼지 말 것. 페이지 쪽 preload 링크와 짝이다.

import { useState } from 'react';
import ImageLightbox from '@/components/ImageLightbox';
import { initialsOf, toneOf } from '@/components/ui/ListThumb';

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
    <span style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>kadeora.app</span>
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
  /**
   * 'photo' 조감도·위성 사진. 전폭으로 눕히고 cover 로 채운다.
   * 'card'  og-apt 생성 카드.
   *   ⚠️ og-apt 는 **정사각(SIDE×SIDE)** 이다. 데스크탑 21/9 에 cover 로 넣으면
   *      카드 한가운데만 잘려 글자가 날아간다. 그래서 카드일 때는
   *      21/9 로 눕히지 않고 4:3 을 유지한 채 contain 으로 넣는다.
   *   ⚠️ 워터마크·라이트박스도 끈다 — 카드에 이미 카더라 브랜딩이 있고 확대할 것이 없다.
   */
  variant?: 'photo' | 'card';
  /**
   * 뷰포트별 다른 소스. 생성 카드가 비율마다 **레이아웃이 다르므로**
   * 한 장을 늘려 쓰지 않고 <picture> 로 고른다 (ADDENDUM §A-2).
   * ⚠️ 미디어 조건은 .kd-hero 의 CSS 분기(768px)와 같은 값이어야 한다 —
   *    어긋나면 21:9 이미지를 4:3 상자에 넣게 된다.
   */
  sources?: { media: string; src: string }[];
  /** h1 + 보조줄. 서버에서 넘긴다. */
  children: React.ReactNode;
};

export default function SiteHero({ src, name, region, credit, badges, variant = 'photo', sources, children }: SiteHeroProps) {
  const [lightbox, setLightbox] = useState(false);
  const [failed, setFailed] = useState(false);

  const url = src ? toHttps(src) : '';
  const hasImage = !!url && !failed;
  const isCard = variant === 'card';

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

        /* ── 생성 카드 전용 ──
           ADDENDUM §A: og-apt 가 이제 비율별로 **다른 레이아웃**을 그린다
           (4x3 모바일 · 21x9 데스크탑). 컨테이너 비율과 이미지 비율이 같아졌으므로
           예전의 contain + 남색 레터박스 우회는 걷어냈다 — 늘리거나 채우지 않는다.
           ⚠️ 이미지 소스는 <picture> 로 갈린다. 아래 sources 참고. */
        .kd-hero--card .kd-hero-img { object-fit: cover; }
        /* 카드 안에 이미 캡션이 있다. 스크림을 옅게 둬 두 겹으로 보이지 않게 한다. */
        .kd-hero--card .kd-hero-scrim {
          background: linear-gradient(transparent 70%, rgba(9,13,20,.35));
        }
        /* 캡션 가독성 — 아래쪽 그라데이션. 흰 글자는 이 위에서만 쓴다 */
        .kd-hero-scrim {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background: linear-gradient(transparent, rgba(9,13,20,.55));
        }
      `}</style>

      <div className={isCard ? 'kd-hero kd-hero--card' : 'kd-hero'}>
        {hasImage ? (
          <>
            {/* ⚠️ 카드는 비율마다 레이아웃이 다르다. 한 장을 늘리지 않고 소스를 고른다.
                sources 가 없으면 기존과 동일하게 단일 <img> 다. */}
            <picture>
              {(sources ?? []).map((s) => (
                <source key={s.media} media={s.media} srcSet={toHttps(s.src)} />
              ))}
              <img
                src={url}
                alt={isCard ? `${name} ${region} 분양 정보 카드` : `${name} ${region} 현장 이미지`}
                width={isCard ? 1200 : 1280}
                height={isCard ? 900 : 720}
                className="kd-hero-img"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setFailed(true)}
                onClick={isCard ? undefined : () => setLightbox(true)}
                style={isCard ? undefined : { cursor: 'zoom-in' }}
              />
            </picture>
            <div className="kd-hero-scrim" />
            {/* 카드에는 이미 카더라 브랜딩이 들어 있다. 워터마크를 겹치지 않는다. */}
            {!isCard && <WatermarkSm />}
          </>
        ) : (
          // 사진 없는 현장 — 위성 미보유 520건 + 좌표 없음 75건. 드문 경우가 아니다.
          // 같은 비율을 지켜 목록 → 상세 사이 레이아웃 점프를 없앤다.
          // v10-D: 이니셜 블록. 목록 64×64 와 같은 규칙(이름 앞 2자 + 이름 해시 색)을 쓰되
          //   전폭에서는 글자만 키운다. 판정을 두 벌로 만들지 않으려 ListThumb 의 헬퍼를 그대로 쓴다.
          //   ⚠️ aspect-ratio 는 .kd-hero 가 잡으므로 4/3·21/9 어디서도 비율이 깨지지 않는다.
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: toneOf(name).bg,
            }}
          >
            <span
              style={{
                fontSize: 'clamp(48px, 12vw, 96px)',
                fontWeight: 600,
                // 장식 워터마크(opacity .5)다 — 48~96px 디스플레이 자간에 UI 텍스트 기준을 적용하지 않았다.
                letterSpacing: '-.05em',
                lineHeight: 1,
                color: toneOf(name).fg,
                opacity: 0.5,
              }}
            >
              {initialsOf(name)}
            </span>
          </div>
        )}

        {/* 배지 — 좌상단 */}
        {badges}

        {/* 출처 — 우하단 */}
        {hasImage && credit && (
          <div
            style={{
              position: 'absolute', right: 12, bottom: 8, zIndex: 2, maxWidth: '60%',
              fontSize: 'var(--fs-xs)', lineHeight: 1.4, textAlign: 'right',
              color: 'rgba(255,255,255,0.86)',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {credit}
          </div>
        )}

        {/* 캡션 — h1 + 보조줄. 사진이 없으면 본문색으로 뒤집는다.
            ⚠️ 카드일 때는 여기 겹치지 않는다 — 카드 안에 이미 단지명이 크게 들어 있어
               같은 이름이 두 번 보인다. 아래 흐름 배치로 내린다. */}
        {!isCard && (
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
        )}
      </div>

      {/* 카드용 캡션 — 이미지 아래 흐름 배치. h1 은 어느 경로에서도 정확히 하나다. */}
      {isCard && (
        <div data-kd-hero-caption="below-card" style={{ padding: '10px 0 14px', color: 'var(--text-primary)' }}>
          {children}
        </div>
      )}

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

// r4-P3 — 상세 페이지 최상단. h1 을 여기서 낸다.
//
// 이미지가 없으면 이미지 영역 자체를 렌더하지 않는다.
// 위성 사진 없는 현장에서 빈 회색 박스가 뜨던 걸 막는다.

import React from 'react';
import Image from 'next/image';

export type BadgeTone = 'status' | 'new';

export interface DetailBadgeProps {
  label: string;
  tone: BadgeTone;
}

const BADGE_TONE: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  status: { bg: 'var(--brand-bg)', fg: 'var(--brand)', border: 'var(--brand-border)' },
  new: { bg: 'var(--accent-green-bg)', fg: 'var(--accent-green)', border: 'var(--accent-green-border)' },
};

/** 배지. 색은 전부 토큰 — 하드코딩 rgba/헥사를 쓰지 않는다. */
export function DetailBadge({ label, tone }: DetailBadgeProps) {
  const c = BADGE_TONE[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 'var(--radius-pill)',
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

export interface DetailHeroProps {
  /** 라틴 대문자 eyebrow. 이모지 대체. */
  eyebrow?: string;
  title: string;
  /** h1 의 id — 상위 요소의 aria-labelledby 와 짝을 맞출 때. */
  titleId?: string;
  /** null 이면 이미지 블록 자체를 렌더하지 않는다. */
  image?: { url: string; alt: string; credit?: string } | null;
  /** 최대 2개. */
  badges?: DetailBadgeProps[];
  /** 지역·일자 등 이미 포맷된 짧은 문자열. */
  caption?: string;
}

export default function DetailHero({
  eyebrow,
  title,
  titleId,
  image,
  badges,
  caption,
}: DetailHeroProps) {
  const shown = (badges ?? []).slice(0, 2);

  return (
    <header>
      {image ? (
        <figure style={{ margin: '0 0 var(--sp-md)' }}>
          <div
            style={{
              position: 'relative',
              aspectRatio: '16 / 9',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'var(--bg-elevated)',
            }}
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="(max-width: 767px) 100vw, 720px"
              style={{ objectFit: 'cover' }}
              priority
            />
          </div>
          {image.credit ? (
            <figcaption
              style={{
                marginTop: 4,
                fontSize: 'var(--fs-xs)',
                color: 'var(--text-tertiary)',
              }}
            >
              {image.credit}
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      {shown.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--sp-xs)' }}>
          {shown.map((b) => (
            <DetailBadge key={b.label} {...b} />
          ))}
        </div>
      ) : null}

      {eyebrow ? (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-xs)',
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--brand)',
            fontWeight: 600,
            marginBottom: 3,
          }}
        >
          {eyebrow}
        </div>
      ) : null}

      <h1
        id={titleId}
        style={{
          fontSize: 'var(--fs-2xl)',
          fontWeight: 600,
          letterSpacing: '-.025em',
          lineHeight: 1.25,
          margin: 0,
          color: 'var(--text-primary)',
          wordBreak: 'keep-all',
        }}
      >
        {title}
      </h1>

      {caption ? (
        <p
          style={{
            margin: 'var(--sp-xs) 0 0',
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-tertiary)',
          }}
        >
          {caption}
        </p>
      ) : null}
    </header>
  );
}

// r4-P3 — 현장(분양·재개발) 카드 v3.
//
// props 계약은 P6 이 그대로 쓴다. 바꾸려면 멈추고 보고한다.
// image 가 null 이면 이미지 영역 자체를 렌더하지 않는다 — 빈 회색 박스를 만들지 않는다.

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { DetailBadge, type DetailBadgeProps } from '@/components/detail/DetailHero';

export interface SiteCardProps {
  href: string;
  /** null 이면 미렌더. */
  image: { url: string; alt: string; credit?: string } | null;
  /** 최대 2개. */
  badges: DetailBadgeProps[];
  title: string;
  summary: string;
  /** 지역·일자 등 이미 포맷된 짧은 문자열. */
  caption?: string;
}

export default function SiteCard({
  href,
  image,
  badges,
  title,
  summary,
  caption,
}: SiteCardProps) {
  const shown = (badges ?? []).slice(0, 2);

  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        background: 'var(--bg-surface)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      {image ? (
        <div
          style={{
            position: 'relative',
            aspectRatio: '16 / 10',
            background: 'var(--bg-elevated)',
          }}
        >
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="(max-width: 767px) 100vw, 400px"
            style={{ objectFit: 'cover' }}
          />
        </div>
      ) : null}

      <div style={{ padding: 'var(--card-p)', minWidth: 0 }}>
        {shown.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {shown.map((b) => (
              <DetailBadge key={b.label} {...b} />
            ))}
          </div>
        ) : null}

        <h3
          style={{
            margin: 0,
            fontSize: 'var(--fs-md)',
            fontWeight: 600,
            lineHeight: 1.35,
            letterSpacing: '-.015em',
            color: 'var(--text-primary)',
            wordBreak: 'keep-all',
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: '6px 0 0',
            fontSize: 'var(--fs-sm)',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            wordBreak: 'keep-all',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {summary}
        </p>

        {caption ? (
          <p
            style={{
              margin: '8px 0 0',
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            {caption}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

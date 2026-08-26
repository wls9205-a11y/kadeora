// r4-P3 — 글 카드 v3 (블로그·피드).
//
// 조회수 규칙은 카드가 정하지 않는다. 상위에서 p75/p90 판정을 끝낸 문자열만 caption 으로 받는다.
// 중앙값 18 짜리 숫자를 카드마다 찍으면 오히려 "안 읽히는 글" 이라는 신호가 된다.

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type PostBadgeTone = 'hot' | 'new';

export interface PostCardProps {
  href: string;
  title: string;
  summary?: string;
  /** 카테고리 등 라틴 대문자 eyebrow. 이모지를 넣지 않는다. */
  eyebrow?: string;
  /** null 이면 이미지 영역 미렌더. */
  image?: { url: string; alt: string } | null;
  /** 날짜·조회수 등 이미 포맷된 짧은 문자열. */
  caption?: string;
  badge?: { label: string; tone: PostBadgeTone } | null;
}

const BADGE_TONE: Record<PostBadgeTone, { bg: string; fg: string; border: string }> = {
  hot: { bg: 'var(--accent-orange-bg)', fg: 'var(--accent-orange)', border: 'var(--border)' },
  new: { bg: 'var(--accent-green-bg)', fg: 'var(--accent-green)', border: 'var(--accent-green-border)' },
};

export default function PostCard({
  href,
  title,
  summary,
  eyebrow,
  image,
  caption,
  badge,
}: PostCardProps) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        gap: 'var(--sp-md)',
        alignItems: 'flex-start',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        background: 'var(--bg-surface)',
        padding: 'var(--card-p)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        {eyebrow || badge ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {eyebrow ? (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-xs)',
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                  color: 'var(--brand)',
                  fontWeight: 600,
                }}
              >
                {eyebrow}
              </span>
            ) : null}
            {badge ? (
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-pill)',
                  background: BADGE_TONE[badge.tone].bg,
                  color: BADGE_TONE[badge.tone].fg,
                  border: `1px solid ${BADGE_TONE[badge.tone].border}`,
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 500,
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                }}
              >
                {badge.label}
              </span>
            ) : null}
          </div>
        ) : null}

        <h3
          style={{
            margin: 0,
            fontSize: 'var(--fs-md)',
            fontWeight: 600,
            lineHeight: 1.4,
            letterSpacing: '-.015em',
            color: 'var(--text-primary)',
            wordBreak: 'keep-all',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </h3>

        {summary ? (
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
        ) : null}

        {caption ? (
          <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
            {caption}
          </p>
        ) : null}
      </div>

      {image ? (
        <div
          style={{
            position: 'relative',
            width: 96,
            aspectRatio: '4 / 3',
            flexShrink: 0,
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            background: 'var(--bg-elevated)',
          }}
        >
          <Image src={image.url} alt={image.alt} fill sizes="96px" style={{ objectFit: 'cover' }} />
        </div>
      ) : null}
    </Link>
  );
}

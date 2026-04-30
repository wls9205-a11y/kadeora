/**
 * CompactRow
 *
 * 컴팩트 행. badge / 단지명+meta / 보조 / 값 / chevron.
 * thumbnail 옵션으로 작은 사진 (44×32) 추가 가능.
 *
 * 그룹 컨테이너 안에서 여러 개 stack될 때 첫 행은 isFirst=true (border-top 제거).
 */

import Link from 'next/link';
import { CoverImage } from './CoverImage';
import { BADGE_VARS } from '../utils';
import type { AptSiteCover, BadgeKind, ToneKind } from '../types';

export type CompactRowProps = {
  href: string;
  badge?: { kind: BadgeKind; label: string };
  thumbnail?: AptSiteCover; // 작은 썸네일 표시
  title: string;
  meta?: string;
  primaryValue?: string;
  primaryValueTone?: ToneKind;
  secondaryValue?: string;
  secondaryValueTone?: ToneKind;
  progressPercent?: number;
  progressTone?: ToneKind;
  isFirst?: boolean;
};

function toneToColor(tone: ToneKind | undefined): string {
  switch (tone) {
    case 'positive':
      return 'var(--aptr-positive)';
    case 'negative':
      return 'var(--aptr-negative)';
    default:
      return 'var(--aptr-text-primary)';
  }
}

export function CompactRow({
  href,
  badge,
  thumbnail,
  title,
  meta,
  primaryValue,
  primaryValueTone = 'neutral',
  secondaryValue,
  secondaryValueTone,
  progressPercent,
  progressTone = 'neutral',
  isFirst = false,
}: CompactRowProps) {
  const badgeColors = badge ? BADGE_VARS[badge.kind] : null;

  return (
    <Link
      href={href}
      className="aptr-link-reset aptr-focus"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '11px 14px',
        borderTop: isFirst ? 'none' : '0.5px solid var(--aptr-border-subtle)',
      }}
    >
      {thumbnail ? (
        <div
          style={{
            width: '44px',
            height: '32px',
            borderRadius: 'var(--aptr-radius-xs)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <CoverImage site={thumbnail} aspectRatio="auto" showKindLabel={false} />
        </div>
      ) : null}

      {badgeColors ? (
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            background: badgeColors.bg,
            color: badgeColors.fg,
            borderRadius: 'var(--aptr-radius-xs)',
            fontWeight: 500,
            minWidth: '30px',
            textAlign: 'center',
            flexShrink: 0,
            letterSpacing: '0.2px',
            wordBreak: 'keep-all',
          }}
        >
          {badge!.label}
        </span>
      ) : null}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="aptr-text-clip"
          style={{ fontSize: '13px', fontWeight: 500, color: 'var(--aptr-text-primary)' }}
        >
          {title}
        </div>
        {meta ? (
          <div
            className="aptr-text-clip"
            style={{
              fontSize: '11px',
              color: 'var(--aptr-text-tertiary)',
              marginTop: '2px',
            }}
          >
            {meta}
          </div>
        ) : null}
      </div>

      {typeof progressPercent === 'number' ? (
        <div
          style={{
            width: '54px',
            height: '4px',
            background: 'var(--aptr-badge-gray-bg)',
            borderRadius: 'var(--aptr-radius-xs)',
            overflow: 'hidden',
            flexShrink: 0,
          }}
          aria-label={`진행률 ${progressPercent}%`}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, progressPercent))}%`,
              height: '100%',
              background:
                progressTone === 'positive'
                  ? 'var(--aptr-positive)'
                  : progressTone === 'negative'
                  ? 'var(--aptr-negative)'
                  : badgeColors?.fg ?? 'var(--aptr-brand)',
            }}
          />
        </div>
      ) : null}

      {primaryValue ? (
        <span
          className="aptr-num"
          style={{
            fontSize: '12px',
            color: toneToColor(primaryValueTone),
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {primaryValue}
        </span>
      ) : null}

      {secondaryValue ? (
        <span
          className="aptr-num"
          style={{
            fontSize: '11px',
            color: toneToColor(secondaryValueTone ?? primaryValueTone),
            fontWeight: 500,
            flexShrink: 0,
            minWidth: '42px',
            textAlign: 'right',
          }}
        >
          {secondaryValue}
        </span>
      ) : null}

      <span
        aria-hidden="true"
        style={{ fontSize: '11px', color: 'var(--aptr-text-tertiary)', flexShrink: 0 }}
      >
        ›
      </span>
    </Link>
  );
}

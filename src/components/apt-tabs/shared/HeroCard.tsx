/**
 * HeroCard
 *
 * 사진 hero 카드. 상단에 사진 + 좌상단 badge + 우상단 메타 라벨 + 그라디언트 오버레이의 정보.
 * 하단에 추가 stat 그리드 옵션. 4탭 모두에서 시그니처 first card로 사용.
 */

import Link from 'next/link';
import { CoverImage } from './CoverImage';
import { BADGE_VARS } from '../utils';
import type { AptSiteCover, BadgeKind } from '../types';

export type HeroCardProps = {
  site: AptSiteCover;
  badge?: { kind: BadgeKind; label: string };
  topRightLabel?: string; // "조감도", "D-180" 등
  title?: string;          // 단지명 override (기본: site.name)
  subtitle: string;        // "124세대 · 평균 28억"
  stats?: { label: string; value: string; tone?: 'positive' | 'negative' | 'accent' }[];
  imageHeight?: number;
  href: string;
  priority?: boolean;
};

export function HeroCard({
  site,
  badge,
  topRightLabel,
  title,
  subtitle,
  stats,
  imageHeight = 140,
  href,
  priority = false,
}: HeroCardProps) {
  const badgeColors = badge ? BADGE_VARS[badge.kind] : null;

  return (
    <Link
      href={href}
      className="aptr-link-reset aptr-focus"
      style={{
        display: 'block',
        background: 'var(--aptr-bg-card)',
        border: '0.5px solid var(--aptr-border-subtle)',
        borderRadius: 'var(--aptr-radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--aptr-shadow-card)',
      }}
    >
      <div style={{ position: 'relative', height: `${imageHeight}px` }}>
        <CoverImage
          site={site}
          aspectRatio="auto"
          priority={priority}
          showKindLabel={false}
        />

        {badgeColors ? (
          <span
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              padding: '3px 8px',
              fontSize: '10px',
              fontWeight: 500,
              borderRadius: 'var(--aptr-radius-xs)',
              background: badgeColors.bg,
              color: badgeColors.fg,
              letterSpacing: '0.2px',
              wordBreak: 'keep-all',
            }}
          >
            {badge!.label}
          </span>
        ) : null}

        {topRightLabel ? (
          <span
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              padding: '3px 8px',
              fontSize: '10px',
              fontWeight: 500,
              borderRadius: 'var(--aptr-radius-xs)',
              background: 'var(--aptr-image-overlay-bg)',
              color: 'var(--aptr-image-overlay-fg)',
              letterSpacing: '0.2px',
              wordBreak: 'keep-all',
            }}
          >
            {topRightLabel}
          </span>
        ) : null}

        {/* 그라디언트 오버레이 정보 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '14px 14px 12px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.78), transparent)',
            color: '#FFFFFF',
          }}
        >
          <div
            className="aptr-headline"
            style={{ fontSize: '16px', fontWeight: 500, lineHeight: 1.15 }}
          >
            {title ?? site.name}
          </div>
          <div
            className="aptr-prose"
            style={{
              fontSize: '11px',
              opacity: 0.88,
              marginTop: '3px',
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>

      {stats && stats.length > 0 ? (
        <div
          style={{
            padding: '11px 14px',
            display: 'grid',
            gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
            gap: '8px',
          }}
        >
          {stats.map((s) => (
            <div key={s.label}>
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--aptr-text-tertiary)',
                  letterSpacing: '0.3px',
                }}
              >
                {s.label}
              </div>
              <div
                className="aptr-num"
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  marginTop: '2px',
                  color:
                    s.tone === 'positive'
                      ? 'var(--aptr-positive)'
                      : s.tone === 'negative'
                      ? 'var(--aptr-negative)'
                      : s.tone === 'accent'
                      ? badgeColors?.fg ?? 'var(--aptr-text-primary)'
                      : 'var(--aptr-text-primary)',
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

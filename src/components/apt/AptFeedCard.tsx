// s269: V1 균등 피드 카드. 풀-width, 이미지 160px, 카테고리 색 뱃지 + 메타.
// 무한 스크롤 안의 단일 단위. 카테고리 토글되어도 동일한 카드 구조 유지.

import Link from 'next/link';
import Image from 'next/image';

export type FeedItem = {
  id: string;
  section: 'subscription' | 'unsold' | 'redev' | string;
  badge_label: string;
  badge_color: 'amber' | 'coral' | 'green' | 'blue' | 'purple';
  title: string;
  region?: string | null;
  meta?: string | null;
  image_url?: string | null;
  href?: string | null;
  dday?: number | null;
  created_at: string;
};

const BADGE_COLORS: Record<string, [string, string]> = {
  amber:  ['#FAEEDA', '#854F0B'],
  coral:  ['#FAECE7', '#993C1D'],
  green:  ['#E1F5EE', '#085041'],
  blue:   ['#E6F1FB', '#0C447C'],
  purple: ['#EEEDFE', '#3C3489'],
};

const FALLBACK_COLORS = ['#FCA5A5', '#FDBA74', '#FCD34D', '#86EFAC', '#7DD3FC', '#A5B4FC', '#F0ABFC'];

function fallbackColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diffSec = (Date.now() - t) / 1000;
  if (diffSec < 60) return '방금';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일 전`;
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400 / 7)}주 전`;
  return `${Math.floor(diffSec / 86400 / 30)}달 전`;
}

const SECTION_LABEL: Record<string, string> = {
  subscription: '청약',
  unsold: '미분양',
  redev: '재개발',
};

function ddayChip(d: number | null | undefined): { bg: string; fg: string; label: string } | null {
  if (d == null) return null;
  if (d < 0)   return { bg: '#F3F4F6', fg: '#4B5563', label: '마감' };
  if (d <= 3)  return { bg: '#DC2626', fg: '#FFFFFF', label: `D-${d}` };
  if (d <= 7)  return { bg: '#FEE2E2', fg: '#991B1B', label: `D-${d}` };
  return null;
}

export default function AptFeedCard({ item, priority = false }: { item: FeedItem; priority?: boolean }) {
  const [bg, fg] = BADGE_COLORS[item.badge_color] ?? BADGE_COLORS.blue;
  const sectionLabel = SECTION_LABEL[item.section] ?? item.section;
  const href = item.href ?? '#';
  const placeholderBg = fallbackColor(item.id);
  const dchip = ddayChip(item.dday);

  return (
    <Link
      href={href}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        border: '1px solid var(--border-base, #E5E7EB)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--bg-surface, #FFFFFF)',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 160,
          background: item.image_url ? '#F3F4F6' : placeholderBg,
        }}
      >
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            sizes="(max-width: 720px) 100vw, 720px"
            style={{ objectFit: 'cover' }}
            priority={priority}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40, opacity: 0.4,
            }}
          >
            🏢
          </div>
        )}
        <div
          style={{
            position: 'absolute', top: 10, left: 10,
            display: 'flex', gap: 4, flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 999,
              background: bg, color: fg, fontWeight: 500,
            }}
          >
            {sectionLabel}
          </span>
          {item.badge_label && item.badge_label !== sectionLabel && (
            <span
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(255,255,255,0.95)',
                color: '#111827', fontWeight: 500,
              }}
            >
              {item.badge_label}
            </span>
          )}
        </div>
        {dchip && (
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <span
              style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 999,
                background: dchip.bg, color: dchip.fg, fontWeight: 500,
              }}
            >
              {dchip.label}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 14px' }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary, #111827)' }}>
          {item.title}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary, #6B7280)', margin: 0 }}>
          {item.region}
          {item.meta ? <span style={{ margin: '0 6px' }}>·</span> : null}
          {item.meta}
        </p>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 10, fontSize: 11, color: 'var(--text-tertiary, #9CA3AF)',
          }}
        >
          <span>{relativeTime(item.created_at)} 등록</span>
        </div>
      </div>
    </Link>
  );
}

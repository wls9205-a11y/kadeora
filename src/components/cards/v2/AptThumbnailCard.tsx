'use client';
// s262 Phase E — AptThumbnailCard (140px wide × 88px thumb + info).
// thumbnail null → deterministic 색 + 🏢 placeholder (id 기반 hash).

import Link from 'next/link';
import Image from 'next/image';
import IssueScoreBadge from '@/components/issue/IssueScoreBadge';
import CommentChip from '@/components/comments/CommentChip';

type Props = {
  id: number | string;
  name: string;
  location?: string | null;
  price?: number | null;        // sale_price_min (만 단위 또는 원 단위)
  score?: number | null;
  dday?: number | null;
  commentCount?: number;
  commentHot?: boolean;
  thumbnailUrl?: string | null;
  houseTy?: string | null;       // '84A' 같은 type
  href?: string;
  priority?: boolean;            // 첫 2장만 priority 권장 (Rule #89)
};

const FALLBACK_COLORS = ['#FCA5A5', '#FDBA74', '#FCD34D', '#86EFAC', '#7DD3FC', '#A5B4FC', '#F0ABFC'];

function fallbackColor(id: number | string): string {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

function ddayChip(d: number | null | undefined): { bg: string; fg: string; label: string } | null {
  if (d == null) return null;
  if (d < 0)   return { bg: '#F3F4F6', fg: '#4B5563', label: '마감' };
  if (d <= 3)  return { bg: '#DC2626', fg: '#FFFFFF', label: `D-${d}` };
  if (d <= 7)  return { bg: '#FEE2E2', fg: '#991B1B', label: `D-${d}` };
  if (d <= 30) return { bg: '#FEF3C7', fg: '#92400E', label: `D-${d}` };
  return null;
}

function fmtPrice(p: number | null | undefined): string {
  if (p == null) return '';
  // sale_price_min 은 보통 만원 단위. 1억 이상은 'X.X억' 표시.
  if (p >= 10000) return `${(p / 10000).toFixed(1)}억`;
  return `${p.toLocaleString()}만`;
}

export default function AptThumbnailCard({
  id, name, location, price, score, dday,
  commentCount = 0, commentHot = false,
  thumbnailUrl, houseTy, href, priority = false,
}: Props) {
  const url = href ?? `/apt/subscription/${id}`;
  const dchip = ddayChip(dday);
  const bg = fallbackColor(id);

  return (
    <Link
      href={url}
      style={{
        display: 'block',
        flex: '0 0 140px',
        width: 140,
        scrollSnapAlign: 'start',
        textDecoration: 'none',
        color: '#111827',
        borderRadius: 6,
        overflow: 'hidden',
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 1px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ position: 'relative', width: 140, height: 88, background: bg }}>
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={name}
            fill
            sizes="140px"
            style={{ objectFit: 'cover' }}
            priority={priority}
            loading={priority ? undefined : 'lazy'}
          />
        ) : (
          <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            🏢
          </span>
        )}
        {score != null ? (
          <span style={{ position: 'absolute', top: 4, left: 4 }}>
            <IssueScoreBadge score={score} />
          </span>
        ) : null}
        {dchip ? (
          <span
            style={{
              position: 'absolute', top: 4, right: 4,
              background: dchip.bg, color: dchip.fg,
              padding: '1px 5px', borderRadius: 3,
              fontSize: 10.5, fontWeight: 700, lineHeight: 1.4,
            }}
          >
            {dchip.label}
          </span>
        ) : null}
      </div>
      <div style={{ padding: '6px 8px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
          <span style={{ fontSize: 11, color: '#6B7280', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {location ?? ''}
            {houseTy ? ` · ${houseTy}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 1 }}>
            {fmtPrice(price)}
          </span>
          {commentCount > 0 || commentHot ? (
            <CommentChip count={commentCount} hot={commentHot} hideZero />
          ) : null}
        </div>
      </div>
    </Link>
  );
}

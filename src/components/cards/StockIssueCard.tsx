'use client';
// s262 Phase B — Stock 이슈 카드 (v3 compact).
// 2 줄 구성: [점수][이름][가격][등락칩] / [메타][이유칩 3-4개][💬]
// border-left 3px = stockBarColor(tone). 패딩 6/9, radius 6.
// Architecture Rule #83 — 모든 색은 stockChipStyle/stockBarColor + REASON_CHIP_STYLE 헬퍼만.

import Link from 'next/link';
import {
  getStockTone,
  stockChipStyle,
  stockBarColor,
  formatChangePct,
} from '@/lib/stockColor';
import IssueScoreBadge from '@/components/issue/IssueScoreBadge';
import IssueReasonChips from '@/components/issue/IssueReasonChips';
import WarningLabel from '@/components/issue/WarningLabel';
import CommentChip from '@/components/comments/CommentChip';
import type { StockIssueScore } from '@/lib/issue/types';

type Props = {
  data: StockIssueScore;
  commentCount?: number;
  commentHot?: boolean;
  href?: string;
};

function formatPrice(p: number | null): string {
  if (p == null) return '-';
  return p.toLocaleString();
}

function formatVolume(v: number | null): string {
  if (v == null) return '';
  if (v >= 10_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

export default function StockIssueCard({ data, commentCount = 0, commentHot = false, href }: Props) {
  const tone = getStockTone(data.change_pct);
  const chip = stockChipStyle(tone);
  const bar = stockBarColor(tone);
  const url = href ?? `/stock/${data.symbol}`;

  return (
    <Link
      href={url}
      style={{
        display: 'block',
        padding: '6px 9px',
        margin: 3,
        borderRadius: 6,
        // s274 Rule #94 — 인라인 하드코딩 hex 는 테마 CSS 로 덮이지 않는다.
        // 기본 테마가 dark(--bg-base #050A18) 인데 카드만 흰색으로 남아 있던 회귀.
        background: 'var(--bg-surface, #0D1730)',
        borderLeft: `3px solid ${bar}`,
        boxShadow: '0 1px 1px rgba(0,0,0,0.04)',
        textDecoration: 'none',
        color: 'var(--text-primary, #F2F5FA)',
      }}
    >
      {/* Row 1: [score] [name] [price] [chip] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IssueScoreBadge score={data.score} />
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.name}
        </span>
        <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary, #B8CCDF)' }}>
          {formatPrice(data.price)}
        </span>
        <span
          style={{
            ...chip,
            padding: '1px 6px',
            borderRadius: 3,
            fontSize: 11,
            lineHeight: 1.4,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {formatChangePct(data.change_pct)}
        </span>
      </div>

      {/* Row 2: [meta] [reason chips] [warning] [comment] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #8BA3C0)', whiteSpace: 'nowrap' }}>
          {data.market}
          {data.sector ? ` · ${data.sector}` : ''}
          {data.volume ? ` · ${formatVolume(data.volume)}` : ''}
        </span>
        <span style={{ flex: 1 }} />
        <IssueReasonChips reasons={data.reasons} max={3} />
        <WarningLabel warning={data.warning} />
        <CommentChip count={commentCount} hot={commentHot} />
      </div>
    </Link>
  );
}

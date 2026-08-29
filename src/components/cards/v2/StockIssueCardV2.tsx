'use client';
// s262 Phase E — StockIssueCard V2 (sparkline + 1+2행 컴팩트).
// 1행: [score badge][sparkline][name/meta(flex)][price][등락칩]
// 2행: [reason chips][warning][💬 카운트]
// thumbnail prop 제거. sparkline_5d 직접 받음.

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
import SparklineMini from '@/components/carousel/SparklineMini';
import type { StockIssueScore } from '@/lib/issue/types';

type Props = {
  data: StockIssueScore & { sparkline_5d?: number[] | null };
  commentCount?: number;
  commentHot?: boolean;
  href?: string;
};

function fmtPrice(p: number | null): string {
  return p == null ? '-' : p.toLocaleString();
}

export default function StockIssueCardV2({ data, commentCount = 0, commentHot = false, href }: Props) {
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
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-surface)',
        borderLeft: `3px solid ${bar}`,
        boxShadow: 'var(--shadow-sm)',
        textDecoration: 'none',
        color: 'var(--text-primary)',
      }}
    >
      {/* Row 1 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
        <IssueScoreBadge score={data.score} />
        <SparklineMini data={data.sparkline_5d ?? null} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 500, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.name}
          </span>
          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-tertiary)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.market}{data.sector ? ` · ${data.sector}` : ''}
          </span>
        </span>
        <span style={{ fontSize: 'var(--fs-2xs)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {fmtPrice(data.price)}
        </span>
        <span style={{ ...chip, padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-2xs)', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {formatChangePct(data.change_pct)}
        </span>
      </div>

      {/* Row 2 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
        <IssueReasonChips reasons={data.reasons} max={4} />
        <WarningLabel warning={data.warning} />
        <span style={{ flex: 1 }} />
        <CommentChip count={commentCount} hot={commentHot} />
      </div>
    </Link>
  );
}

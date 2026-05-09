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
        borderRadius: 6,
        background: '#FFFFFF',
        borderLeft: `3px solid ${bar}`,
        boxShadow: '0 1px 1px rgba(0,0,0,0.04)',
        textDecoration: 'none',
        color: '#111827',
      }}
    >
      {/* Row 1 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IssueScoreBadge score={data.score} />
        <SparklineMini data={data.sparkline_5d ?? null} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.name}
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.market}{data.sector ? ` · ${data.sector}` : ''}
          </span>
        </span>
        <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: '#374151', whiteSpace: 'nowrap' }}>
          {fmtPrice(data.price)}
        </span>
        <span style={{ ...chip, padding: '1px 6px', borderRadius: 3, fontSize: 11, lineHeight: 1.4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
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

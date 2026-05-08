'use client';
// s262 Phase B — Apt 이슈 카드 (v3 compact).
// StockIssueCard 와 동일 패턴. 등락칩 자리 → D-day 칩.

import Link from 'next/link';
import IssueScoreBadge from '@/components/issue/IssueScoreBadge';
import IssueReasonChips from '@/components/issue/IssueReasonChips';
import WarningLabel from '@/components/issue/WarningLabel';
import CommentChip from '@/components/comments/CommentChip';
import type { AptIssueScore } from '@/lib/issue/types';

type Props = {
  data: AptIssueScore;
  commentCount?: number;
  commentHot?: boolean;
  href?: string;
};

// D-day 칩 색 — 0~3일: red solid, 4~7일: red light, 8~30일: amber, >30일 또는 마감: gray.
function ddayChipStyle(d: number | null): { background: string; color: string; fontWeight: number; label: string } {
  if (d == null) return { background: '#F3F4F6', color: '#4B5563', fontWeight: 600, label: '미정' };
  if (d < 0)     return { background: '#F3F4F6', color: '#4B5563', fontWeight: 600, label: '마감' };
  if (d <= 3)    return { background: '#DC2626', color: '#FFFFFF', fontWeight: 700, label: `D-${d}` };
  if (d <= 7)    return { background: '#FEE2E2', color: '#991B1B', fontWeight: 600, label: `D-${d}` };
  if (d <= 30)   return { background: '#FEF3C7', color: '#92400E', fontWeight: 600, label: `D-${d}` };
  return { background: '#F3F4F6', color: '#4B5563', fontWeight: 600, label: `D-${d}` };
}

function formatPyeong(p: number | null): string {
  if (p == null) return '';
  return `${(p / 10000).toFixed(0)}만/평`;
}

export default function AptIssueCard({ data, commentCount = 0, commentHot = false, href }: Props) {
  const dchip = ddayChipStyle(data.dday);
  // 좌측 색 — D-day 임박도에 따라
  const bar =
    data.dday != null && data.dday >= 0 && data.dday <= 3 ? '#DC2626' :
    data.dday != null && data.dday <= 7  ? '#EF4444' :
    data.dday != null && data.dday <= 30 ? '#F59E0B' : '#9CA3AF';
  const url = href ?? `/apt/subscription/${data.id}`;

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
      {/* Row 1: [score] [name] [pyeong] [dday chip] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IssueScoreBadge score={data.score} />
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.house_nm}
        </span>
        {data.price_per_pyeong ? (
          <span style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: '#374151' }}>
            {formatPyeong(data.price_per_pyeong)}
          </span>
        ) : null}
        <span
          style={{
            background: dchip.background,
            color: dchip.color,
            fontWeight: dchip.fontWeight,
            padding: '1px 6px',
            borderRadius: 3,
            fontSize: 11,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          {dchip.label}
        </span>
      </div>

      {/* Row 2 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
          {data.region_nm ?? ''}
          {data.mdatrgbn_nm ? ` · ${data.mdatrgbn_nm}` : ''}
          {data.competition_rate_1st ? ` · ${data.competition_rate_1st.toFixed(1)}:1` : ''}
        </span>
        <span style={{ flex: 1 }} />
        <IssueReasonChips reasons={data.reasons} max={3} />
        <WarningLabel warning={data.warning} />
        <CommentChip count={commentCount} hot={commentHot} />
      </div>
    </Link>
  );
}

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

  // s274 — StockIssueCard 와 동일하게 .kd-lc* 클래스로 이동. 색만 변수로 전달.
  return (
    <Link
      href={url}
      className="kd-lc"
      style={{
        '--kd-bar': bar,
        '--kd-chip-bg': dchip.background,
        '--kd-chip-fg': dchip.color,
        '--kd-chip-fw': dchip.fontWeight,
      } as React.CSSProperties}
    >
      {/* Row 1: [score] [name] [pyeong] [dday chip] */}
      <div className="kd-lc-r1">
        <IssueScoreBadge score={data.score} />
        <span className="kd-lc-name">{data.house_nm}</span>
        {data.price_per_pyeong ? (
          <span className="kd-lc-num">{formatPyeong(data.price_per_pyeong)}</span>
        ) : null}
        <span className="kd-lc-chip">{dchip.label}</span>
      </div>

      {/* Row 2 */}
      <div className="kd-lc-r2">
        <span className="kd-lc-meta">
          {data.region_nm ?? ''}
          {data.mdatrgbn_nm ? ` · ${data.mdatrgbn_nm}` : ''}
          {data.competition_rate_1st ? ` · ${data.competition_rate_1st.toFixed(1)}:1` : ''}
        </span>
        <span className="kd-lc-spacer" />
        <IssueReasonChips reasons={data.reasons} max={3} />
        <WarningLabel warning={data.warning} />
        <CommentChip count={commentCount} hot={commentHot} />
      </div>
    </Link>
  );
}

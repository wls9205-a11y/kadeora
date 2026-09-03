'use client';
// s262 Phase E — StockIssueCard V2 (sparkline + 1+2행 컴팩트).
// 1행: [score badge][sparkline][name/meta(flex)][price][등락칩]
// 2행: [warning][💬 카운트] — M4-1 에서 reason chips 는 1행 메타의 최상위 1개로 접었고,
//        둘 다 없으면 줄을 그리지 않는다(댓글 0 미표기).
// thumbnail prop 제거. sparkline_5d 직접 받음.

import Link from 'next/link';
import {
  getStockTone,
  stockChipStyle,
  stockBarColor,
  formatChangePct,
} from '@/lib/stockColor';
import IssueScoreBadge from '@/components/issue/IssueScoreBadge';
import WarningLabel from '@/components/issue/WarningLabel';
import { REASON_LABELS, REASON_MIN_VALUE } from '@/lib/issue/labels';
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
  /* 최상위 사유 1개만 라벨 텍스트로. 값이 REASON_MIN_VALUE 미만이면 붙이지 않는다. */
  const topReasonLabel = (Array.isArray(data.reasons) ? data.reasons : [])
    .filter((r) => typeof r?.value === 'number' && r.value >= REASON_MIN_VALUE && REASON_LABELS[r.tag])
    .sort((a, b) => b.value - a.value)
    .map((r) => REASON_LABELS[r.tag])[0] ?? null;
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
            {[data.market, data.sector, topReasonLabel].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span style={{ fontSize: 'var(--fs-2xs)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {fmtPrice(data.price)}
        </span>
        <span style={{ ...chip, padding: '1px 6px', borderRadius: 'var(--radius-xs)', fontSize: 'var(--fs-2xs)', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {formatChangePct(data.change_pct)}
        </span>
      </div>

      {/* Row 2 — M4-1 행 정규화.
          사유 칩 4개는 1행 메타의 «최상위 하나» 로 접었다(매 행 반복은 정보가 아니라 배경이다).
          경고와 댓글만 남고, 둘 다 «있을 때만» 그린다 — 댓글 0 은 그리지 않는다(hideZero).
          ⚠️ 이 줄에 남는 것이 없으면 줄 자체를 렌더하지 않는다 — 빈 줄이 행 높이를 먹지 않게. */}
      {(data.warning || (commentCount ?? 0) > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <WarningLabel warning={data.warning} />
          <span style={{ flex: 1 }} />
          <CommentChip count={commentCount ?? 0} hot={commentHot} hideZero />
        </div>
      )}
    </Link>
  );
}

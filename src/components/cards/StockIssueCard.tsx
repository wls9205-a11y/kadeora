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

  // s274 — 레이아웃/타이포는 .kd-lc* 클래스(components.css)로 옮겼다.
  // 이 컴포넌트는 'use client' 라 style 객체가 HTML 속성 + RSC flight payload
  // 양쪽에 직렬화되는데, 30행이 깔리는 /stock 에서 그게 페이지 무게의 대부분이었다.
  // 색은 여전히 stockBarColor/stockChipStyle 이 만든 값을 변수로만 넘긴다 (Rule #83).
  return (
    <Link
      href={url}
      className="kd-lc"
      style={{
        '--kd-bar': bar,
        '--kd-chip-bg': chip.background,
        '--kd-chip-fg': chip.color,
        '--kd-chip-fw': chip.fontWeight,
      } as React.CSSProperties}
    >
      {/* Row 1: [score] [name] [price] [chip] */}
      <div className="kd-lc-r1">
        <IssueScoreBadge score={data.score} />
        <span className="kd-lc-name">{data.name}</span>
        <span className="kd-lc-num">{formatPrice(data.price)}</span>
        <span className="kd-lc-chip">{formatChangePct(data.change_pct)}</span>
      </div>

      {/* Row 2: [meta] [reason chips] [warning] [comment] */}
      <div className="kd-lc-r2">
        <span className="kd-lc-meta">
          {data.market}
          {data.sector ? ` · ${data.sector}` : ''}
          {data.volume ? ` · ${formatVolume(data.volume)}` : ''}
        </span>
        <span className="kd-lc-spacer" />
        <IssueReasonChips reasons={data.reasons} max={3} />
        <WarningLabel warning={data.warning} />
        <CommentChip count={commentCount} hot={commentHot} />
      </div>
    </Link>
  );
}

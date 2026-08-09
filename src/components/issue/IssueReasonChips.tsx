// s262 Phase B — Issue reason chips (8+색 카테고리).
// REASON_MIN_VALUE 이하는 그리지 않음 (카드 노이즈 방지).
// max prop 으로 표시 개수 제한 (카드 1줄 3-4개 권장).

import { REASON_LABELS, REASON_CHIP_STYLE, REASON_MIN_VALUE } from '@/lib/issue/labels';
import type { IssueReason } from '@/lib/issue/types';

type Props = {
  reasons: IssueReason[] | null | undefined;
  max?: number;
};

export default function IssueReasonChips({ reasons, max = 4 }: Props) {
  if (!Array.isArray(reasons) || reasons.length === 0) return null;
  const visible = reasons
    .filter((r) => typeof r?.value === 'number' && r.value >= REASON_MIN_VALUE && REASON_LABELS[r.tag])
    .sort((a, b) => b.value - a.value)
    .slice(0, max);
  if (visible.length === 0) return null;
  return (
    // s274 — 레이아웃은 .kd-chips/.kd-chip, 색은 REASON_CHIP_STYLE 그대로 변수 전달.
    <span className="kd-chips">
      {visible.map((r) => {
        const style = REASON_CHIP_STYLE[r.tag];
        return (
          <span
            key={r.tag}
            className="kd-chip"
            style={{ '--kd-c-bg': style.background, '--kd-c-fg': style.color } as React.CSSProperties}
          >
            {REASON_LABELS[r.tag]}
          </span>
        );
      })}
    </span>
  );
}

// s262 Phase B — 경고 라벨 (volatility_high / new_listing / managed_stock / unsold_repeat).
// 모두 amber 톤 ⚠️ + 한국어 라벨. warning 이 null 이면 안 그림.

import { WARNING_LABELS, WARNING_STYLE } from '@/lib/issue/labels';
import type { IssueWarning } from '@/lib/issue/types';

type Props = {
  warning: IssueWarning | null | undefined;
};

export default function WarningLabel({ warning }: Props) {
  if (!warning || !WARNING_LABELS[warning]) return null;
  return (
    // s274 — 레이아웃은 .kd-chip--warn, 색은 WARNING_STYLE 그대로 변수 전달.
    <span
      className="kd-chip kd-chip--warn"
      style={{
        '--kd-c-bg': WARNING_STYLE.background,
        '--kd-c-fg': WARNING_STYLE.color,
        '--kd-c-bd': WARNING_STYLE.border,
      } as React.CSSProperties}
      role="status"
    >
      <span aria-hidden>⚠️</span>
      {WARNING_LABELS[warning]}
    </span>
  );
}

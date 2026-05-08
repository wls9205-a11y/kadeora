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
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '1px 6px',
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.4,
        background: WARNING_STYLE.background,
        color: WARNING_STYLE.color,
        border: `1px solid ${WARNING_STYLE.border}`,
        whiteSpace: 'nowrap',
      }}
      role="status"
    >
      <span aria-hidden>⚠️</span>
      {WARNING_LABELS[warning]}
    </span>
  );
}

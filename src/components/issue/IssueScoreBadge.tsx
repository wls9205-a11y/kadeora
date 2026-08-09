// s262 Phase B — Issue 점수 숫자 배지.
// 70+ 빨강 / 50+ 주황 / 그외 회색. hex 는 동일 카드 시스템 색.

import { scoreToDisplay } from '@/lib/issue/calc';

type Props = {
  score: number | null | undefined;
  size?: 'sm' | 'md';
};

export default function IssueScoreBadge({ score, size = 'sm' }: Props) {
  const v = scoreToDisplay(score);
  const tone = v >= 70 ? '#DC2626' : v >= 50 ? '#EF4444' : '#6B7280';
  // s274 — 레이아웃은 .kd-badge (components.css), 색만 변수로.
  return (
    <span
      className={size === 'md' ? 'kd-badge kd-badge--md' : 'kd-badge'}
      style={{ '--kd-c-bg': tone } as React.CSSProperties}
      aria-label={`이슈 점수 ${v}`}
    >
      {v}
    </span>
  );
}

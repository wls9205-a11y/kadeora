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
  const fontSize = size === 'md' ? 13 : 11.5;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: size === 'md' ? 32 : 26,
        height: size === 'md' ? 22 : 18,
        padding: '0 6px',
        borderRadius: 4,
        background: tone,
        color: '#FFFFFF',
        fontSize,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}
      aria-label={`이슈 점수 ${v}`}
    >
      {v}
    </span>
  );
}

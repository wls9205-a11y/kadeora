// s262 Phase B — Issue 점수 가로 바 (3px 높이).
// 0..1 점수 비율로 fill. 색상은 IssueScoreBadge 와 동일 톤.

import { scoreToDisplay } from '@/lib/issue/calc';

type Props = {
  score: number | null | undefined;
  width?: number;
};

export default function IssueScoreBar({ score, width = 60 }: Props) {
  const v = scoreToDisplay(score);
  const tone = v >= 70 ? '#DC2626' : v >= 50 ? '#EF4444' : '#9CA3AF';
  return (
    <span
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        display: 'inline-block',
        width,
        height: 3,
        background: '#F3F4F6',
        borderRadius: 1.5,
        overflow: 'hidden',
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          display: 'block',
          width: `${v}%`,
          height: '100%',
          background: tone,
        }}
      />
    </span>
  );
}

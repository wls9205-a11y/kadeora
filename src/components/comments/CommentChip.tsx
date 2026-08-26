// s262 Phase B — 댓글 카운트 칩 (💬 N).
// hot=true 면 빨강 #DC2626 + "핫" 텍스트. count=0 도 그림 (사용처에서 hide 결정).

type Props = {
  count: number;
  hot?: boolean;
  hideZero?: boolean;
};

export default function CommentChip({ count, hot = false, hideZero = false }: Props) {
  if (hideZero && (!count || count <= 0)) return null;
  const styles = hot
    ? { background: '#DC2626', color: '#FFFFFF', fontWeight: 500 }
    : { background: '#F3F4F6', color: '#4B5563', fontWeight: 600 };
  return (
    // s274 — 레이아웃은 .kd-chip, 색만 변수로.
    <span
      className="kd-chip kd-chip--num"
      style={{
        '--kd-c-bg': styles.background,
        '--kd-c-fg': styles.color,
        '--kd-c-fw': styles.fontWeight,
      } as React.CSSProperties}
      aria-label={`댓글 ${count}${hot ? ' (인기)' : ''}`}
    >
      <span aria-hidden>💬</span>
      <span>{count}</span>
      {hot ? <span>핫</span> : null}
    </span>
  );
}

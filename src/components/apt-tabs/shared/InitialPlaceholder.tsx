/**
 * InitialPlaceholder
 *
 * 4단계 폴백의 최종 단계. 단지명 첫 2글자를 deterministic 색상 위에 표시.
 * 같은 단지는 같은 색이 나옴 (해시 기반).
 *
 * 라이트/다크 색상은 apt-tabs.css에 미리 정의된 --aptr-placeholder-{bg,fg}-N 변수로 자동 전환.
 */

const RAMPS = 7;

type Props = {
  name: string;
  className?: string;
};

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const cleaned = name.replace(/[\s()【】「」'"·\-,.]/g, '');
  return cleaned.slice(0, 2);
}

export function InitialPlaceholder({ name, className }: Props) {
  const idx = hashName(name) % RAMPS;
  const initials = getInitials(name);

  return (
    <div
      className={className}
      role="img"
      aria-label={`${name} 대표 이미지 placeholder`}
      style={{
        width: '100%',
        height: '100%',
        background: `var(--aptr-placeholder-bg-${idx})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <span
        style={{
          fontSize: 'clamp(20px, 6vw, 36px)',
          fontWeight: 500,
          color: `var(--aptr-placeholder-fg-${idx})`,
          letterSpacing: '-0.02em',
          fontFamily: 'var(--font-serif, ui-serif, Georgia, serif)',
          wordBreak: 'keep-all',
        }}
      >
        {initials}
      </span>
    </div>
  );
}

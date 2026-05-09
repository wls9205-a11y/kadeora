// s262 Phase E — Carousel dots indicator.
// 활성 14×6, 비활성 6×6, gap 5. 색 #DC2626 / var(--color-border-secondary).

type Props = {
  count: number;
  active: number;
  onJump?: (i: number) => void;
};

export default function CarouselDots({ count, active, onJump }: Props) {
  if (count <= 1) return null;
  return (
    <div
      role="tablist"
      aria-label="carousel pagination"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 0',
        justifyContent: 'center',
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        const Tag = onJump ? 'button' : ('span' as const);
        return (
          <Tag
            key={i}
            role="tab"
            aria-selected={isActive}
            aria-label={`page ${i + 1}`}
            onClick={onJump ? () => onJump(i) : undefined}
            style={{
              width: isActive ? 14 : 6,
              height: 6,
              borderRadius: 3,
              background: isActive ? '#DC2626' : 'var(--color-border-secondary, #E5E7EB)',
              transition: 'width 160ms, background 160ms',
              padding: 0,
              border: 'none',
              cursor: onJump ? 'pointer' : 'default',
            }}
          />
        );
      })}
    </div>
  );
}

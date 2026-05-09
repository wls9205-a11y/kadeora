// s262 Phase E — CSS scroll-snap 가로 스크롤. 라이브러리 0.
// 카드 폭 ~140px 기준, scroll-snap-align: start. iOS overscroll-behavior 잠금.

type Props = {
  children: React.ReactNode;
  ariaLabel?: string;
};

export default function AptHScroll({ children, ariaLabel }: Props) {
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        gap: 8,
        padding: '4px 6px 8px',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorX: 'contain',
        scrollbarWidth: 'none',
      }}
    >
      {children}
    </div>
  );
}

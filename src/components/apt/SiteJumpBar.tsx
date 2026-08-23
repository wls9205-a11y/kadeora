// v3 커밋3 — 현장 상세 섹션 점프 바.
//
// 클라이언트 JS 없이 앵커만 쓴다 (스크롤은 각 섹션의 scroll-margin-top 이 받는다).
// 히어로가 LCP 요소라 그 바로 아래에 하이드레이션 비용을 얹지 않는다.
//
// 상단 고정 스택 (실측):
//   Navigation <header>  sticky top:0 · z-100 · 내부 height 44 + border-bottom 1px = 45px
//   StickyTalkBanner     fixed top:0 · z-110 · 52px — 커밋6 에서 현장 상세는 렌더하지 않는다
//   이 바                 sticky top:45 · z-60
//
// ⚠️ z-index 를 100 이상으로 올리지 말 것 — 헤더 위로 올라온다.
// ⚠️ 각 섹션의 scrollMarginTop 은 SECTION_SCROLL_MARGIN 을 쓴다.
//    기존 60 은 헤더(45)만 겨우 피하는 값이라 이 바 아래로 제목이 숨는다.

/** Navigation <header> 실측 높이 (내부 44 + border-bottom 1). */
export const HEADER_HEIGHT = 45;
/** 이 바의 높이 (칩 44 + 상하 패딩 6 + border-bottom 1). */
export const JUMP_BAR_HEIGHT = 57;
/** 섹션 앵커의 scroll-margin-top. 헤더 + 점프바 + 여유 8. */
export const SECTION_SCROLL_MARGIN = HEADER_HEIGHT + JUMP_BAR_HEIGHT + 8;

export type JumpItem = { id: string; label: string; show: boolean };

export default function SiteJumpBar({ items }: { items: JumpItem[] }) {
  const shown = items.filter(i => i.show);
  // 칩이 2개 미만이면 바가 정보를 주지 않는다 — 자리만 먹는다.
  if (shown.length < 2) return null;

  return (
    <nav
      aria-label="섹션 바로가기"
      style={{
        position: 'sticky',
        top: HEADER_HEIGHT,
        zIndex: 60,
        // 아티클 좌우 패딩을 상쇄해 스크롤 끝이 화면 끝에 닿게 한다
        margin: '0 calc(-1 * var(--sp-lg)) var(--sp-md)',
        padding: '6px var(--sp-lg)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      <div style={{ display: 'flex', gap: 6, width: 'max-content' }}>
        {shown.map(i => (
          <a
            key={i.id}
            href={`#${i.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 44,
              padding: '0 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--bg-sunken)',
              color: 'var(--text-secondary)',
              fontSize: 12.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              textDecoration: 'none',
            }}
          >
            {i.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

// v3 커밋3 — 현장 상세 섹션 점프 바.
//
// 클라이언트 JS 없이 «순수 앵커» 만 쓴다 (스크롤은 각 섹션의 scroll-margin-top 이 받는다).
// 히어로가 LCP 요소라 그 바로 아래에 하이드레이션 비용을 얹지 않는다.
//
// ⚠️ U-1a — 예전에는 칩을 누르면 AccordionEnhancer 가 그 섹션을 «열어» 줬다.
//    전 섹션이 펼쳐지면서 열 것이 없어졌고, Enhancer 도 퇴역했다.
//    이제 이 바는 브라우저의 fragment 이동만 쓴다 — 연동 대상이 없다.
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
/**
 * 이 바의 높이. U-1a 에서 57 → **42** 로 낮췄다.
 *
 * ⚠️ 낮추면서 «칩의 누를 크기를 줄이지 않았다» — 그러면 접근성이 후퇴한다.
 *    시각 높이 30px + Rule #77 `.touch-target` 으로 히트 영역 44px 를 유지한다.
 *    (DS_RULES §1-5 ② — 「레이아웃이 움직이면 안 되는 자리」의 기본 수법.)
 * ⚠️ 이 바는 sticky 라 «높이가 곧 본문을 가리는 양» 이다. 전 섹션 펼침으로
 *    본문이 길어졌으므로 상단 고정물이 차지하는 자리를 줄이는 쪽이 맞다.
 */
export const JUMP_BAR_HEIGHT = 42;
// ⛔ 이 값을 바꾸면 components.css 의 `.kd-detail-rail { --rail-top }` «도» 바꿀 것.
//    레일이 멈추는 자리 = 헤더 45 + 이 값 + 여유 16 이다. CSS 라 자동으로 안 따라온다.
//    (U-1a 에서 57→42 로 바꾸면서 실제로 한 번 갈렸다.)
/** 섹션 앵커의 scroll-margin-top. 헤더 + 점프바 + 여유 8. */
export const SECTION_SCROLL_MARGIN = HEADER_HEIGHT + JUMP_BAR_HEIGHT + 8;

export type JumpItem = { id: string; label: string; show: boolean };

/**
 * U-1b — 시안 E 의 서브내비는 오른쪽 «끝에» CTA 를 둔다.
 *
 * ⚠️ 칩 줄은 가로 스크롤이라, CTA 를 그 안에 넣으면 «같이 밀려 나간다».
 *    그래서 스크롤 컨테이너는 flex:1 로 두고 CTA 는 그 «밖에» 둔다 — 항상 보인다.
 * ⛔ show=false 면 렌더하지 않는다. 눌러도 갈 곳이 없는 버튼을 만들지 않는다.
 */
export type JumpCta = { id: string; label: string; show: boolean };

export default function SiteJumpBar({ items, cta }: { items: JumpItem[]; cta?: JumpCta }) {
  const shown = items.filter(i => i.show);
  // 칩이 2개 미만이면 바가 정보를 주지 않는다 — 자리만 먹는다.
  if (shown.length < 2) return null;

  return (
    <nav
      aria-label="섹션 바로가기"
      className="kd-jumpbar"
      style={{
        position: 'sticky',
        top: HEADER_HEIGHT,
        zIndex: 60,
        // 아티클 좌우 패딩을 상쇄해 스크롤 끝이 화면 끝에 닿게 한다
        margin: '0 calc(-1 * var(--sp-lg)) var(--sp-md)',
        height: JUMP_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--sp-lg)',
        boxSizing: 'border-box',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--sp-xs)', width: 'max-content', flex: 1, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {shown.map(i => (
          <a
            key={i.id}
            href={`#${i.id}`}
            // ⚠️ 시각 «36px» · 히트 44px (실측 정정 — 30 이 안 되는 이유가 있다).
            //    responsive.css 의 전역 규칙이 모바일 a[href] 에 min-height:36 을 걸고,
            //    그건 @layer overrides 라 여기 height:30 을 «이긴다».
            //    바 높이 42 는 지켜지고(36 + 상하 3) 히트 44 도 지켜진다.
            //    ⛔ 전역 36 을 여기서 뒤집지 않는다 — 그 규칙은 모바일 «전 화면» 을 문다.
            className="touch-target"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 30, // 전역 min-height:36 에 눌려 실제 36 이다(위 주석)
              padding: '0 var(--sp-md)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--bg-sunken)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              textDecoration: 'none',
            }}
          >
            {i.label}
          </a>
        ))}
      </div>
      {cta?.show && (
        <a
          href={`#${cta.id}`}
          className="touch-target"
          style={{
            flex: 'none',
            marginLeft: 'var(--sp-sm)',
            display: 'inline-flex',
            alignItems: 'center',
            height: 30, // 칩과 같은 높이 — 전역 min-height:36 에 눌려 실제 36 이다
            padding: '0 var(--sp-md)',
            borderRadius: 'var(--radius-sm)',
            // 강조색 3역할 고정(U-1b): 골드 = «행동». 네이비는 값, 검증 3색은 뱃지 전용.
            background: 'var(--kd-accent)',
            color: 'var(--text-inverse)',
            fontSize: 'var(--fs-xs)',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
        >
          {cta.label}
        </a>
      )}
    </nav>
  );
}

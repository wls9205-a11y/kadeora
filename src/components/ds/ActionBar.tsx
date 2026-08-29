// DS-2 표준 ④-b — 하단 고정 «2버튼» 바.
//
// B8(`7447e252`)이 /apt/[id] 에서 확정한 배치를 «현장 도메인과 분리해» 일반화한 것이다.
//   좌(주) 브랜드 색 · 우(부) 보조 색 · 50/50 동일 높이 · 한 줄.
//
// ⚠️ B8 이 배운 것 두 가지가 여기 박혀 있다:
//   ① 위계는 «크기» 가 아니라 «색과 자리» 로 준다.
//      한쪽만 두 줄(보조 문구)이면 그쪽이 더 커 보여 50/50 이 50/50 으로 안 읽힌다.
//   ② display 를 인라인으로 «주지 않는다».
//      인라인 display 는 유틸리티·레이어를 항상 이겨서 반응형 숨김을 무력화한다.
//      B8 실측에서 `md:hidden` 이 v3 커밋2 이래 아무 일도 하지 않고 있었다.
//      → 보이기/숨기기는 CSS 클래스(.kd-site-action-bar, components.css)가 정한다.
//
// ⚠️ 이 컴포넌트는 «아직 어느 화면도 쓰지 않는다». SiteActionBar 가 살아 있는 인스턴스이고,
//    그 교체는 /apt/[id] 를 만지는 일이라 이 트랙 범위 밖이다(설계서 §0 · U-1층).
//    U 설계가 B8 배치를 승계할 때 이 표준을 채택한다.
// ⛔ 그때까지 SiteActionBar 를 이 컴포넌트로 갈아끼우지 말 것 — 상세 동결 조항 위반이다.

import type { CSSProperties, ReactNode } from 'react';

/** 바 높이(px). 스페이서와 공유한다. B8 실측값. */
export const ACTION_BAR_HEIGHT = 48;

/**
 * 두 칸의 «공통» 형태. 50/50 · 같은 높이 · 한 줄.
 * ⛔ 한쪽에만 flex/minHeight 를 적지 말 것 — 다음 사람이 한쪽만 고쳐 높이가 갈린다.
 */
export const ACTION_SLOT: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: ACTION_BAR_HEIGHT,
  padding: '0 8px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  textAlign: 'center',
  borderRadius: 'var(--radius-md)',
  boxSizing: 'border-box',
  // 문구가 길어지면(큰 글씨 접근성 모드) 줄바꿈으로 흘러내리게 둔다.
  // nowrap 으로 자르면 「분양 정보 안내 신...」 이 된다.
  fontSize: 'var(--fs-sm)',
  fontWeight: 600,
  lineHeight: 1.15,
};

export interface ActionBarProps {
  /** 주 행동. 브랜드 색 · 좌측. 없으면 보조가 바 전체를 쓴다. */
  primary?: ReactNode;
  /** 보조 행동. */
  secondary: ReactNode;
  /** 하단 탭바 등 아래에 이미 깔린 것의 높이(px). */
  bottomOffset?: number;
  /** 바가 보이는가. 숨길 때만 인라인으로 덮는다 — 그 방향은 이겨야 맞다. */
  visible?: boolean;
}

export default function ActionBar({ primary, secondary, bottomOffset = 62, visible = true }: ActionBarProps) {
  return (
    <>
      {/* 바가 본문 끝을 덮지 않도록 flow 에서 자리를 확보한다 */}
      <div
        aria-hidden="true"
        className="kd-site-action-bar-spacer"
        style={{ height: visible ? ACTION_BAR_HEIGHT + 12 : 0 }}
      />
      <div
        className="kd-site-action-bar"
        data-ds="action-bar"
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 98,
          // ⛔ 보일 때 display 를 주지 않는다. 위 주석 ② 참조.
          display: visible ? undefined : 'none',
          gap: 8,
        }}
      >
        {primary}
        {secondary}
      </div>
    </>
  );
}

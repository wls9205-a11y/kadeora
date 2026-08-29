// U-1a — 현장 상세 섹션. **접히지 않는다.**
//
// ── 왜 펼쳤나 (V15 B 의 전제가 바뀌었다) ──────────────────────────────────────
// V15 B 는 「섹션이 15개가 넘고 공고 전 현장은 절반이 빈다」를 근거로 접었다.
// 그런데 그 사이에 «빈 섹션은 호출부가 아예 렌더하지 않는» 규약이 자리 잡았고
// (「데이터가 없는 섹션은 빈 아코디언을 만들지 않는다」), 실제로 남는 섹션은
// 그 현장이 «가진 것» 뿐이다. 접는 이유였던 「스크롤이 끝나지 않는다」가 사라졌다.
//
// 그리고 U-1층의 목표가 「살아 있는 단일 페이지」다 — 읽는 사람이 «한 번에 보는» 것이
// 이 화면의 값이고, AI 검색이 인용하는 것도 «펼쳐진 본문» 이다.
// 클릭 한 번을 요구하는 것은 그 값을 스스로 깎는 일이다.
//
// ⛔ 접이식으로 되돌리지 말 것. 되돌리려면 「왜 다시 접는가」를 여기 적을 것.
//
// ── 무엇이 남았나 ────────────────────────────────────────────────────────────
// · id · scroll-margin — 점프바 앵커·색인·내부 링크가 걸려 있다. «절대 바꾸지 말 것».
// · h2 계층 — 사이트링크·앵커 후보가 여기 산다(V15 D-3).
// · 카드 외형(.kd-acc) — 클래스명은 그대로 두고 CSS 만 펼침 기준으로 고쳤다.
//   ⚠️ 클래스명을 바꾸면 스모크 선택자가 조용히 0을 센다(B7-1 에서 두 번 물린 자리).
//
// ⚠️ defaultOpen · openOnDesktop 은 «이제 아무 일도 하지 않는다». 호출부 19곳을 한꺼번에
//    고치면 이 커밋에서 바꾼 것과 못 바꾼 것이 섞인다 — prop 은 남기고 무시한다.
//    (다음 상세 커밋에서 호출부를 정리한다.)

import React from 'react';
import { SECTION_SCROLL_MARGIN } from '@/components/apt/SiteJumpBar';

export interface DetailSectionProps {
  /** 점프바 앵커 대상. 기존 id 를 그대로 유지할 것 — 색인·내부 링크가 걸려 있다. */
  id: string;
  title: string;
  /** 제목 우측 보조 텍스트 (건수 등). */
  meta?: React.ReactNode;
  /** @deprecated U-1a 에서 전 섹션 펼침으로 바뀌어 무시된다. 호출부 정리는 후속. */
  defaultOpen?: boolean;
  /** @deprecated U-1a 에서 전 섹션 펼침으로 바뀌어 무시된다. 호출부 정리는 후속. */
  openOnDesktop?: boolean;
  children: React.ReactNode;
}

export default function DetailSection({ id, title, meta, children }: DetailSectionProps) {
  return (
    <section
      id={id}
      className="kd-acc"
      aria-labelledby={`${id}-h`}
      style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}
    >
      {/* 예전엔 <summary> 였다. caret 과 클릭 영역이 사라졌으므로
          헤더는 «제목 줄» 일 뿐이다 — 커서·hover·focus 도 걷었다(CSS). */}
      <div className="kd-acc-sum">
        <h2 id={`${id}-h`} className="kd-acc-title">{title}</h2>
        {meta ? <span className="kd-acc-meta">{meta}</span> : null}
      </div>
      <div className="kd-acc-body">{children}</div>
    </section>
  );
}

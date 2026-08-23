// V15 B — 현장 상세 접이식 섹션.
//
// 왜 접나: 현장 상세는 섹션이 15개가 넘고, 공고 전 현장은 그중 절반이 빈다.
// 다 펼쳐 두면 "이 현장이 뭔가" 를 알기 전에 스크롤이 끝나지 않는다.
//
// ⚠️ 조건부 언마운트로 구현하지 말 것. 네이티브 <details> 는 닫혀 있어도
//    자식이 DOM 에 그대로 남는다 — 색인 대상 텍스트가 사라지지 않는다.
//    (구글은 접힌 콘텐츠를 인덱싱한다. 네이버는 문서화가 약해
//     핵심 텍스트 3~4줄을 접이식 **밖** 요약에 따로 둔다 — V15 B-2.)
//
// ⚠️ 데이터가 없는 섹션은 호출부에서 아예 렌더하지 않는다. 빈 아코디언을 만들지 않는다.
//
// ⚠️ <summary> 안의 <h2> 는 유효하다 (summary 의 콘텐츠 모델이 heading content 를 허용).
//    아코디언 헤더가 h2 계층을 그대로 유지해야 사이트링크·앵커 후보가 살아 있다 (V15 D-3).
//
// JS 없이도 동작한다. 해시 이동 시 자동 열림과 데스크탑 기본 열림만
// AccordionEnhancer 가 점진 향상으로 얹는다.

import React from 'react';
import { SECTION_SCROLL_MARGIN } from '@/components/apt/SiteJumpBar';

export interface DetailSectionProps {
  /** 점프바 앵커 대상. 기존 id 를 그대로 유지할 것 — 색인·내부 링크가 걸려 있다. */
  id: string;
  title: string;
  /** 제목 우측 보조 텍스트 (건수 등). */
  meta?: React.ReactNode;
  /** 모바일 포함 항상 기본 열림. 첫 섹션(공급 정보)만 true. */
  defaultOpen?: boolean;
  /** ≥1024px 에서만 기본 열림. 넓은 화면이 허전하면 안 된다. */
  openOnDesktop?: boolean;
  children: React.ReactNode;
}

export default function DetailSection({
  id,
  title,
  meta,
  defaultOpen = false,
  openOnDesktop = false,
  children,
}: DetailSectionProps) {
  return (
    <details
      id={id}
      className="kd-acc"
      open={defaultOpen}
      {...(openOnDesktop ? { 'data-open-desktop': '' } : {})}
      style={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}
    >
      <summary className="kd-acc-sum">
        {/* 좌측 ▶ — 열리면 90도. 문자로 두면 폰트에 따라 크기가 튀지만
            선을 그리는 것보다 스크린리더 무시(aria-hidden)가 명확하다. */}
        <span className="kd-acc-caret" aria-hidden="true">▶</span>
        <h2 className="kd-acc-title">{title}</h2>
        {meta ? <span className="kd-acc-meta">{meta}</span> : null}
      </summary>
      <div className="kd-acc-body">{children}</div>
    </details>
  );
}

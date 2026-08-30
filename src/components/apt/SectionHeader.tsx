// s2 — 섹션 3단 리듬: eyebrow / H2 / (콘텐츠) / 텍스트 링크.
//
// eyebrow 는 라틴 대문자 + Mono 로 섹션의 성격을 먼저 알린다.
// 그래서 H2 앞에 붙던 이모지는 제거한다 — eyebrow 가 그 역할을 대신한다.
//
// 하단 링크는 버튼이 아니다. 페이지 안에서 CTA 는 카드/CTA바가 담당하고,
// 섹션 링크는 "더 있다"는 신호만 준다.
//
// V4-1 (2026-08-30, 지시서 DS3-V4 §3-3 + 판정회신 증분1 ④)
//   - 인라인 style 을 .kd-sechead* 로 «동반 회수» 했다. 값은 옮긴 것이지 바꾼 것이
//     아니다 — 사다리 밖이던 여백 두 곳만 --sp-* 로 스냅했다(components.css 주석).
//   - 골드 룰은 «opt-in» 이다. rule 을 넘기지 않은 기존 호출 13곳은 그대로 산다.
//     화면 전환은 각 화면 커밋(V4-2~V4-5)이 지고, 이 커밋은 전역을 흔들지 않는다.
//   ⛔ eyebrow 를 10px/600 으로 바꾸지 말 것. 모노 스펙은 s2 의 것이고,
//      그 안은 --fs-* 사다리 밖이라 폐기됐다.
//   ⛔ 제목 «우측» 에 텍스트링크를 만들지 말 것. 이동 경로는 목록 바닥의
//      SectionLink 한 벌뿐이다(8/26 「더보기는 바닥에 문장으로」).

import React from 'react';
import Link from 'next/link';

export interface SectionHeaderProps {
  /**
   * 라틴 대문자. 예: 'FEATURED — 분양중'
   * v3: 선택 항목. 상세 페이지(apt/[id] · stock/[symbol])는 넘기지 않는다 —
   * eyebrow 7개가 연속으로 나오면 리듬이 아니라 소음이다. 목록은 그대로 쓴다.
   */
  eyebrow?: string;
  /** 한글 제목. 이모지를 넣지 않는다. */
  title: string;
  /** h2 의 id — 상위 section 의 aria-labelledby 와 짝을 맞춘다. */
  id?: string;
  /** 제목 우측 보조 텍스트 (건수·정렬 기준 등). 링크가 아니다. */
  meta?: React.ReactNode;
  /**
   * V4 골드 룰(22×2)을 제목 위에 얹는다. 기본 false.
   * 장식이다 — 룰이 안 보여도 섹션 식별은 제목 텍스트가 진다
   * (실측 #FFC53D on #FFFFFF = 1.58:1).
   */
  rule?: boolean;
}

export default function SectionHeader({ eyebrow, title, id, meta, rule }: SectionHeaderProps) {
  return (
    <div className="kd-sechead">
      <div className="kd-sechead__main">
        {rule ? <div className="kd-sechead__rule" aria-hidden="true" /> : null}
        {eyebrow ? <div className="kd-sechead__eb">{eyebrow}</div> : null}
        <h2 id={id} className="kd-sechead__title">
          {title}
        </h2>
      </div>
      {meta ? <span className="kd-sechead__meta">{meta}</span> : null}
    </div>
  );
}

export interface SectionLinkProps {
  href: string;
  children: React.ReactNode;
}

/**
 * 섹션 하단 텍스트 링크. 버튼이 아니라 1px 규칙선 위의 텍스트다.
 * 색·선은 전부 기존 토큰(--border/--text-secondary)만 쓴다.
 */
export function SectionLink({ href, children }: SectionLinkProps) {
  return (
    <div className="kd-seclink">
      <Link href={href}>
        {children}
        <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );
}

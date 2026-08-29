// s2 — 섹션 3단 리듬: eyebrow / H2 / (콘텐츠) / 텍스트 링크.
//
// eyebrow 는 라틴 대문자 + Mono 로 섹션의 성격을 먼저 알린다.
// 그래서 H2 앞에 붙던 이모지는 제거한다 — eyebrow 가 그 역할을 대신한다.
//
// 하단 링크는 버튼이 아니다. 페이지 안에서 CTA 는 카드/CTA바가 담당하고,
// 섹션 링크는 "더 있다"는 신호만 준다.

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
  /** 제목 우측 보조 텍스트 (건수·정렬 기준 등). */
  meta?: React.ReactNode;
}

export default function SectionHeader({ eyebrow, title, id, meta }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--sp-sm)',
        marginBottom: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow ? (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-xs)',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--brand)',
              fontWeight: 500,
              marginBottom: 3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <h2
          id={id}
          style={{
            fontSize: 'var(--fs-xl)',
            fontWeight: 600,
            letterSpacing: '-.02em',
            lineHeight: 1.25,
            margin: 0,
            color: 'var(--text-primary)',
            wordBreak: 'keep-all',
          }}
        >
          {title}
        </h2>
      </div>
      {meta ? (
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {meta}
        </span>
      ) : null}
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
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 9 }}>
      <Link
        href={href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--sp-xs)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
        }}
      >
        {children}
        <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );
}

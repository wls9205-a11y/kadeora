// r4-P3 — 상세 페이지 공통 골격.
//
// 블록 순서를 컴포넌트가 고정한다. 페이지마다 순서가 달라지던 걸 막는 게 목적이다.
// 없는 블록은 렌더하지 않는다 — 빈 표·빈 FAQ 를 남기지 않는다.
//
// 접근성: 각 블록은 <section aria-labelledby> 로 감싸고 h2 에 id 를 붙인다.
// 본문(body) 안의 H2 들은 DetailSection 을 써서 같은 규칙을 따른다.

import React from 'react';

export interface DetailShellProps {
  /** h1 을 포함하는 최상단 블록. section 으로 감싸지 않는다. */
  hero: React.ReactNode;
  /** 리드폼·CTA 등 행동 유도. hero 바로 아래 고정. */
  action?: React.ReactNode;
  /** 3줄 요약 등 개요 블록. */
  summary?: React.ReactNode;
  /** 본문. 내부 H2 는 DetailSection 으로 감싼다. */
  body: React.ReactNode;
  /** SpecTable. */
  table?: React.ReactNode;
  /** FAQBlock. */
  faq?: React.ReactNode;
  /** RelatedBelt. */
  related?: React.ReactNode;
  /** 고지·면책. 항상 마지막. */
  disclaimer: React.ReactNode;
}

export interface DetailSectionProps {
  /** h2 의 id. section 의 aria-labelledby 와 짝을 맞춘다. */
  id: string;
  title: string;
  /** 라틴 대문자 eyebrow. 이모지 대체용. */
  eyebrow?: string;
  /** 제목 우측 보조 텍스트. */
  meta?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * H2 하나 = section 하나. 상세 페이지의 모든 H2 는 이걸 통과한다.
 */
export function DetailSection({ id, title, eyebrow, meta, children }: DetailSectionProps) {
  return (
    <section aria-labelledby={id} style={{ marginTop: 'var(--sp-2xl)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 'var(--sp-sm)',
          marginBottom: 'var(--sp-sm)',
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
                fontWeight: 600,
                marginBottom: 3,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <h2
            id={id}
            style={{
              fontSize: 'var(--fs-lg)',
              fontWeight: 700,
              letterSpacing: '-.02em',
              lineHeight: 1.3,
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
      {children}
    </section>
  );
}

export default function DetailShell({
  hero,
  action,
  summary,
  body,
  table,
  faq,
  related,
  disclaimer,
}: DetailShellProps) {
  return (
    <article
      style={{
        maxWidth: 'var(--container-read)',
        margin: '0 auto',
        padding: 'var(--sp-md)',
        color: 'var(--text-primary)',
      }}
    >
      {hero}

      {action ? <div style={{ marginTop: 'var(--sp-lg)' }}>{action}</div> : null}

      {summary ? (
        <DetailSection id="detail-summary" eyebrow="SUMMARY — 한눈에" title="요약">
          {summary}
        </DetailSection>
      ) : null}

      {body}

      {table ? (
        <DetailSection id="detail-spec" eyebrow="SPEC — 기본 정보" title="상세 정보">
          {table}
        </DetailSection>
      ) : null}

      {faq ? (
        <DetailSection id="detail-faq" eyebrow="FAQ — 자주 묻는 질문" title="자주 묻는 질문">
          {faq}
        </DetailSection>
      ) : null}

      {related ? (
        <DetailSection id="detail-related" eyebrow="RELATED — 함께 보기" title="함께 보기">
          {related}
        </DetailSection>
      ) : null}

      <footer
        style={{
          marginTop: 'var(--sp-2xl)',
          paddingTop: 'var(--sp-lg)',
          borderTop: '1px solid var(--border)',
          fontSize: 'var(--fs-xs)',
          lineHeight: 1.7,
          color: 'var(--text-tertiary)',
        }}
      >
        {disclaimer}
      </footer>
    </article>
  );
}

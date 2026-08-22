// r4-P3 — FAQ 블록.
//
// 화면 문구와 FAQPage JSON-LD 를 같은 배열에서 만든다.
// 둘이 어긋나면 구조화 데이터 위반이다 — 그래서 소스를 하나로 묶는다.
//
// 주의: 한 페이지에 FAQPage 는 하나여야 한다. 페이지에 이미 별도 FAQ JSON-LD 가
// 있으면 그쪽을 지우거나 emitJsonLd={false} 로 끈다.

import React from 'react';

export interface FAQItem {
  q: string;
  a: string;
}

export interface FAQBlockProps {
  items: FAQItem[];
  /** FAQPage JSON-LD 동시 출력. 기본 true. */
  emitJsonLd?: boolean;
}

export default function FAQBlock({ items, emitJsonLd = true }: FAQBlockProps) {
  const valid = items.filter((it) => it.q?.trim() && it.a?.trim());
  if (valid.length === 0) return null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };

  return (
    <>
      <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
        {valid.map((it) => (
          <div
            key={it.q}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              padding: 'var(--sp-md)',
            }}
          >
            <dt
              style={{
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                wordBreak: 'keep-all',
              }}
            >
              {it.q}
            </dt>
            <dd
              style={{
                margin: 'var(--sp-xs) 0 0',
                fontSize: 'var(--fs-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                wordBreak: 'keep-all',
              }}
            >
              {it.a}
            </dd>
          </div>
        ))}
      </dl>
      {emitJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
    </>
  );
}

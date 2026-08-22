// r4-P3 — 상세 하단 연관 링크 벨트.
//
// 카드가 아니다. 목적은 다음 클릭 한 번이지 내용 요약이 아니다.
// 그래서 이미지도 요약문도 없다 — 제목 + 짧은 캡션만.

import React from 'react';
import Link from 'next/link';

export interface RelatedItem {
  href: string;
  title: string;
  /** 지역·일자·건수 등 이미 포맷된 짧은 문자열. */
  caption?: string;
}

export interface RelatedBeltProps {
  items: RelatedItem[];
  /** 최대 표시 개수. 기본 6. */
  limit?: number;
}

export default function RelatedBelt({ items, limit = 6 }: RelatedBeltProps) {
  const visible = items.filter((it) => it.href && it.title).slice(0, limit);
  if (visible.length === 0) return null;

  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 'var(--sp-sm)',
      }}
    >
      {visible.map((it) => (
        <li key={it.href}>
          <Link
            href={it.href}
            style={{
              display: 'block',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)',
              padding: 'var(--sp-sm) var(--sp-md)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 'var(--fs-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.45,
                wordBreak: 'keep-all',
              }}
            >
              {it.title}
            </span>
            {it.caption ? (
              <span
                style={{
                  display: 'block',
                  marginTop: 2,
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-tertiary)',
                }}
              >
                {it.caption}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

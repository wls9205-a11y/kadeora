import React from 'react';
import Link from 'next/link';

export interface AIRelatedItem {
  tag: string;
  title: string;
  meta?: string;
  href: string;
}

interface Props {
  items: AIRelatedItem[];
  title?: string;
  maxItems?: number;
}

export default function AIRelatedPanel({ items, title = '이 화면 관련 분석', maxItems = 5 }: Props) {
  const list = (items || []).slice(0, maxItems);
  if (list.length === 0) return null;

  return (
    <section
      aria-label={`AI ${title}`}
      style={{
        background: 'var(--kd-bg-card)',
        border: '1px solid var(--kd-border)',
        borderRadius: 'var(--kd-radius-card)',
        padding: 'var(--kd-gap-md)',
        margin: '0 0 var(--kd-gap-md)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--kd-gap-sm)', marginBottom: 'var(--kd-gap-md)' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 8px',
            background: 'var(--kd-accent)',
            color: '#1A1A18',
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: 1,
            borderRadius: 'var(--kd-radius-sm)',
          }}
        >
          AI
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--kd-text-1)' }}>{title}</span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--kd-gap-sm)' }}>
        {list.map((it, i) => (
          <li key={`${it.href}-${i}`}>
            <Link href={it.href} style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--kd-accent)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{it.tag}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--kd-text-1)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {it.title}
                </span>
                {it.meta && (
                  <span style={{ fontSize: 10, color: 'var(--kd-text-3)', fontWeight: 600 }}>{it.meta}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

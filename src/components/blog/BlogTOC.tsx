'use client';

import { useState } from 'react';
import type { TocItem } from '@/lib/extractToc';

interface Props {
  items: TocItem[];
  title?: string;
}

export default function BlogTOC({ items, title = '목차' }: Props) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;

  const list = (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((it, i) => (
        <li
          key={`${it.id}-${i}`}
          style={{
            marginBottom: 6,
            paddingLeft: it.level === 3 ? 14 : 0,
          }}
        >
          <a
            href={`#${it.id}`}
            style={{
              fontSize: it.level === 2 ? 13 : 12,
              color: it.level === 2 ? 'var(--text-primary)' : 'var(--text-secondary)',
              textDecoration: 'none',
              fontWeight: it.level === 2 ? 700 : 500,
              display: 'block',
              padding: '4px 0',
              lineHeight: 1.45,
            }}
          >
            {it.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <aside
        className="blog-toc-desktop"
        style={{
          position: 'sticky',
          top: 80,
          alignSelf: 'flex-start',
          padding: '14px 14px',
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.02)',
          maxHeight: 'calc(100vh - 100px)',
          overflowY: 'auto',
        }}
      >
        <h4
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'var(--text-tertiary)',
            letterSpacing: 1,
            textTransform: 'uppercase',
            margin: '0 0 10px',
          }}
        >
          {title}
        </h4>
        {list}
      </aside>

      <details
        className="blog-toc-mobile"
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        style={{
          margin: '12px 0 16px',
          padding: '10px 14px',
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--text-primary)',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{title} · {items.length}</span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{open ? '−' : '+'}</span>
        </summary>
        <div style={{ marginTop: 10 }}>{list}</div>
      </details>

      <style>{`
        @media (max-width: 1023px) {
          .blog-toc-desktop { display: none; }
        }
        @media (min-width: 1024px) {
          .blog-toc-mobile { display: none; }
        }
      `}</style>
    </>
  );
}

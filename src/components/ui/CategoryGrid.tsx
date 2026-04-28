import React from 'react';
import Link from 'next/link';

export interface CategoryGridItem {
  icon?: string;
  label: string;
  count?: number | null;
  href: string;
  active?: boolean;
}

interface Props {
  title: string;
  items: CategoryGridItem[];
}

export default function CategoryGrid({ title, items }: Props) {
  if (!items || items.length === 0) return null;

  return (
    <section style={{ margin: '0 0 var(--kd-gap-lg)' }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--kd-text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 'var(--kd-gap-sm)', padding: '0 4px' }}>
        {title}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it, i) => (
          <li key={`${it.label}-${i}`}>
            <Link
              href={it.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--kd-gap-sm)',
                padding: '6px 10px',
                borderRadius: 'var(--kd-radius-sm)',
                background: it.active ? 'var(--kd-accent-soft)' : 'transparent',
                border: it.active ? '1px solid var(--kd-accent-border)' : '1px solid transparent',
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: it.active ? 800 : 600,
                color: it.active ? 'var(--kd-accent)' : 'var(--kd-text-2)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                {it.icon && <span style={{ flexShrink: 0 }}>{it.icon}</span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
              </span>
              {it.count != null && (
                <span style={{ fontSize: 10, fontWeight: 700, color: it.active ? 'var(--kd-accent)' : 'var(--kd-text-3)', flexShrink: 0 }}>
                  {it.count.toLocaleString()}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

'use client';
import React from 'react';

interface Item { label: string; value: React.ReactNode; tone?: 'red' | 'green' | 'orange' | 'default' }

interface Props { items: Item[] }

const TONE_COLOR: Record<NonNullable<Item['tone']>, string> = {
  red:     'var(--accent-red)',
  green:   'var(--accent-green)',
  orange:  'var(--accent-orange)',
  default: 'var(--text-primary)',
};

export default function KPIStrip({ items }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 14, flexWrap: 'wrap',
      padding: '6px 10px', borderRadius: 'var(--radius-md, 10px)',
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      fontSize: 12,
    }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{it.label}</span>
          <span style={{ color: TONE_COLOR[it.tone ?? 'default'], fontWeight: 800 }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

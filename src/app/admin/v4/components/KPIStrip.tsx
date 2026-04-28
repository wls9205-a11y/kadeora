'use client';
import React from 'react';

interface Item { label: string; value: React.ReactNode; tone?: 'red' | 'green' | 'orange' | 'default' }

interface Props { items: Item[] }

const TONE_COLOR: Record<NonNullable<Item['tone']>, string> = {
  red:     'var(--accent-red, #f87171)',
  green:   'var(--accent-green, #34d399)',
  orange:  'var(--accent-orange, #fb923c)',
  default: 'var(--text-primary, #fff)',
};

export default function KPIStrip({ items }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 14, flexWrap: 'wrap',
      padding: '6px 10px', borderRadius: 'var(--radius-md, 10px)',
      background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
      fontSize: 12,
    }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ color: 'var(--text-tertiary, #888)', fontWeight: 600 }}>{it.label}</span>
          <span style={{ color: TONE_COLOR[it.tone ?? 'default'], fontWeight: 800 }}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

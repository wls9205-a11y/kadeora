'use client';
import React from 'react';

type Health = 'critical' | 'warn' | 'ok';

interface Props {
  label: string;
  value: React.ReactNode;
  delta?: string | number | null;
  deltaColor?: 'red' | 'green' | 'tertiary';
  drilldown?: string;
  health?: Health;
  unit?: string;
}

const HEALTH_BORDER: Record<Health, string> = {
  critical: 'var(--accent-red, #f87171)',
  warn:     'var(--accent-orange, #fb923c)',
  ok:       'var(--accent-green, #34d399)',
};

const DELTA_COLOR: Record<NonNullable<Props['deltaColor']>, string> = {
  red:      'var(--accent-red, #f87171)',
  green:    'var(--accent-green, #34d399)',
  tertiary: 'var(--text-tertiary, #888)',
};

export default function AdminKPI({ label, value, delta, deltaColor = 'tertiary', drilldown, health, unit }: Props) {
  const borderLeft = health ? `3px solid ${HEALTH_BORDER[health]}` : '3px solid transparent';
  const card = (
    <div style={{
      padding: 12, borderRadius: 'var(--radius-md, 10px)',
      background: 'var(--bg-surface, #1a1b22)',
      border: '1px solid var(--border, #2a2b35)',
      borderLeft,
      minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary, #888)', letterSpacing: 0.3, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary, #fff)', lineHeight: 1 }}>
          {value}
        </div>
        {unit && <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>{unit}</span>}
      </div>
      {delta !== undefined && delta !== null && (
        <div style={{ fontSize: 11, fontWeight: 600, color: DELTA_COLOR[deltaColor] }}>
          {delta}
        </div>
      )}
    </div>
  );
  if (drilldown) {
    return (
      <a href={drilldown} style={{ textDecoration: 'none', display: 'block' }}>
        {card}
      </a>
    );
  }
  return card;
}

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
  critical: 'var(--accent-red)',
  warn:     'var(--accent-orange)',
  ok:       'var(--accent-green)',
};

const DELTA_COLOR: Record<NonNullable<Props['deltaColor']>, string> = {
  red:      'var(--accent-red)',
  green:    'var(--accent-green)',
  tertiary: 'var(--text-tertiary)',
};

export default function AdminKPI({ label, value, delta, deltaColor = 'tertiary', drilldown, health, unit }: Props) {
  const borderLeft = health ? `3px solid ${HEALTH_BORDER[health]}` : '3px solid transparent';
  const card = (
    <div style={{
      padding: 12, borderRadius: 'var(--radius-md, 10px)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderLeft,
      minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 'var(--fw-title)', color: 'var(--text-tertiary)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-num)', color: 'var(--text-primary)', lineHeight: 1 }}>
          {value}
        </div>
        {unit && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{unit}</span>}
      </div>
      {delta !== undefined && delta !== null && (
        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-title)', color: DELTA_COLOR[deltaColor] }}>
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

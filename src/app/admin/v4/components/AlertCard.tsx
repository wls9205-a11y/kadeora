'use client';
import React from 'react';

type Severity = 'critical' | 'warn' | 'info';

interface Props {
  severity: Severity;
  title: string;
  hideWhenEmpty?: boolean;
  count?: number;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

const PALETTE: Record<Severity, { bg: string; border: string; text: string; icon: string }> = {
  critical: { bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.45)', text: '#f87171', icon: '🚨' },
  warn:     { bg: 'rgba(251,146,60,0.08)',   border: 'rgba(251,146,60,0.4)',   text: '#fb923c', icon: '⚠️' },
  info:     { bg: 'rgba(59,130,246,0.06)',   border: 'rgba(59,130,246,0.3)',   text: '#60a5fa', icon: 'ℹ️' },
};

export default function AlertCard({ severity, title, hideWhenEmpty, count, children, actions }: Props) {
  if (hideWhenEmpty && (count === 0 || count == null)) return null;
  const p = PALETTE[severity];
  return (
    <div style={{
      padding: 14, borderRadius: 'var(--radius-md, 10px)',
      background: p.bg, border: `1px solid ${p.border}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{p.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: p.text }}>{title}</span>
        {typeof count === 'number' && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: p.text, opacity: 0.85 }}>
            {count}건
          </span>
        )}
      </div>
      {children && <div style={{ fontSize: 12, color: 'var(--text-secondary, #ccc)' }}>{children}</div>}
      {actions && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

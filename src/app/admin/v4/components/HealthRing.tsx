'use client';
import React from 'react';

interface Props {
  score: number; // 0-100
  size?: number;
  label?: string;
}

function colorFor(s: number): string {
  if (s <= 40) return '#f87171';
  if (s <= 70) return '#fbbf24';
  return '#34d399';
}

export default function HealthRing({ score, size = 64, label = '헬스 점수' }: Props) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  const r = (size / 2) - 4;
  const c = 2 * Math.PI * r;
  const dash = c * (pct / 100);
  const color = colorFor(pct);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', borderRadius: 'var(--radius-md, 10px)',
      background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border, #2a2b35)" strokeWidth={4} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={4} fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 900, color: color,
        }}>
          {pct}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary, #888)', letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary, #ccc)' }}>/ 100</span>
      </div>
    </div>
  );
}

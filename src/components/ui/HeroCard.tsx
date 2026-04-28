import React from 'react';
import Link from 'next/link';

export interface HeroStat {
  value: string;
  label: string;
  tone?: 'default' | 'success' | 'danger';
}

interface Props {
  tag: string;
  title: string;
  meta?: string;
  stats?: HeroStat[];
  href?: string;
}

function toneColor(tone: HeroStat['tone']): string {
  if (tone === 'success') return 'var(--kd-success)';
  if (tone === 'danger') return 'var(--kd-danger)';
  return 'var(--kd-accent)';
}

export default function HeroCard({ tag, title, meta, stats, href }: Props) {
  const inner = (
    <article
      style={{
        background: 'var(--kd-bg-card)',
        border: '1px solid var(--kd-border)',
        borderRadius: 'var(--kd-radius-card)',
        padding: 'var(--kd-gap-lg)',
        margin: '0 0 var(--kd-gap-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--kd-gap-sm)',
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--kd-accent)', letterSpacing: 1, textTransform: 'uppercase' }}>{tag}</span>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--kd-text-1)', letterSpacing: -0.5, lineHeight: 1.2, wordBreak: 'keep-all' }}>{title}</h2>
      {meta && <div style={{ fontSize: 12, color: 'var(--kd-text-2)', fontWeight: 600, lineHeight: 1.5 }}>{meta}</div>}
      {Array.isArray(stats) && stats.length > 0 && (
        <div
          style={{
            marginTop: 'var(--kd-gap-sm)',
            paddingTop: 'var(--kd-gap-md)',
            borderTop: '1px solid var(--kd-border)',
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`,
            gap: 'var(--kd-gap-sm)',
          }}
        >
          {stats.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: toneColor(s.tone), letterSpacing: -0.5, lineHeight: 1.1 }}>{s.value}</span>
              <span style={{ fontSize: 10, color: 'var(--kd-text-3)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );

  if (href) return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>;
  return inner;
}

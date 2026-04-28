import React from 'react';

interface Props {
  text: string;
  variant?: 'default' | 'compact';
}

export default function LiveBar({ text, variant = 'default' }: Props) {
  const isCompact = variant === 'compact';
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--kd-gap-sm)',
        padding: isCompact ? '6px 12px' : '8px 14px',
        margin: '0 0 var(--kd-gap-md)',
        background: 'var(--kd-bg-soft)',
        border: '1px solid var(--kd-border)',
        borderRadius: 'var(--kd-radius)',
        fontSize: isCompact ? 11 : 12,
        color: 'var(--kd-text-2)',
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--kd-live)',
          animation: 'kd-pulse 2s ease-in-out infinite',
        }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';

const SIZES = [
  { label: '작게', value: 'small' },
  { label: '보통', value: 'medium' },
  { label: '크게', value: 'large' },
];

export default function FontSizeControl() {
  const [size, setSize] = useState('medium');

  useEffect(() => {
    const saved = localStorage.getItem('kd_font_size');
    if (saved && ['small', 'medium', 'large'].includes(saved)) {
      setSize(saved);
    }
  }, []);

  const change = (v: string) => {
    setSize(v);
    localStorage.setItem('kd_font_size', v);
    const el = document.documentElement;
    el.classList.remove('font-small', 'font-medium', 'font-large');
    el.classList.add(`font-${v}`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginRight: 4 }}>글자</span>
      {SIZES.map(s => (
        <button
          key={s.value}
          onClick={() => change(s.value)}
          style={{
            padding: '3px 8px', borderRadius: 'var(--radius-xs)', border: 'none', cursor: 'pointer',
            fontSize: 'var(--fs-xs)', fontWeight: size === s.value ? 700 : 400,
            background: size === s.value ? 'var(--brand)' : 'var(--bg-hover)',
            color: size === s.value ? 'var(--text-inverse)' : 'var(--text-tertiary)',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

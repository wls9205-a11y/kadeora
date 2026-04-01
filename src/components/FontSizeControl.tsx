'use client';

import { useState, useEffect } from 'react';

const SIZES = [
  { label: '글자', value: 0 },  // placeholder, not used
  { label: '작게', value: 13 },
  { label: '보통', value: 16 },
  { label: '크게', value: 20 },
];

export default function FontSizeControl() {
  const [size, setSize] = useState(16);

  useEffect(() => {
    const saved = localStorage.getItem('kd_font_size');
    if (saved) {
      const n = parseInt(saved);
      if ([13, 16, 20].includes(n)) {
        setSize(n);
        document.documentElement.style.setProperty('--content-font-size', `${n}px`);
      }
    }
  }, []);

  const change = (v: number) => {
    setSize(v);
    localStorage.setItem('kd_font_size', String(v));
    document.documentElement.style.setProperty('--content-font-size', `${v}px`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)' }}>
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginRight: 4 }}>글자</span>
      {SIZES.filter(s => s.value > 0).map(s => (
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

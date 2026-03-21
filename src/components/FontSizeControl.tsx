'use client';

import { useState, useEffect } from 'react';

const SIZES = [
  { label: '작게', value: 13 },
  { label: '보통', value: 15 },
  { label: '크게', value: 17 },
];

export default function FontSizeControl() {
  const [size, setSize] = useState(15);

  useEffect(() => {
    const saved = localStorage.getItem('kd_font_size');
    if (saved) {
      const n = parseInt(saved);
      if ([13, 15, 17].includes(n)) {
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 4 }}>글자</span>
      {SIZES.map(s => (
        <button
          key={s.value}
          onClick={() => change(s.value)}
          style={{
            padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: size === s.value ? 700 : 400,
            background: size === s.value ? 'var(--brand)' : 'var(--bg-hover)',
            color: size === s.value ? '#fff' : 'var(--text-tertiary)',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

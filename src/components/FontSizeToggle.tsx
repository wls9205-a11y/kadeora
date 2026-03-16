'use client';
import { useState, useEffect } from 'react';

const SIZES = [
  { label: '작게', value: 'small', base: '13px' },
  { label: '보통', value: 'medium', base: '15px' },
  { label: '크게', value: 'large', base: '17px' },
];

export default function FontSizeToggle() {
  const [size, setSize] = useState('medium');

  useEffect(() => {
    const saved = localStorage.getItem('kd_font_size') || 'medium';
    setSize(saved);
    applySize(saved);
  }, []);

  const applySize = (val: string) => {
    const s = SIZES.find(x => x.value === val) || SIZES[1];
    document.documentElement.style.setProperty('--font-base', s.base);
  };

  const handleChange = (val: string) => {
    setSize(val);
    localStorage.setItem('kd_font_size', val);
    applySize(val);
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>글씨 크기</span>
      <div style={{ display:'flex', gap:4 }}>
        {SIZES.map(s => (
          <button key={s.value} onClick={() => handleChange(s.value)}
            style={{
              padding:'4px 12px', borderRadius:9999,
              fontSize: s.value === 'small' ? 11 : s.value === 'large' ? 15 : 13,
              fontWeight: size === s.value ? 700 : 400,
              backgroundColor: size === s.value ? 'var(--brand)' : 'var(--bg-hover)',
              color: size === s.value ? 'var(--text-inverse)' : 'var(--text-secondary)',
              border: `1px solid ${size === s.value ? 'var(--brand)' : 'var(--border)'}`,
              cursor:'pointer', transition:'all 0.15s',
            }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

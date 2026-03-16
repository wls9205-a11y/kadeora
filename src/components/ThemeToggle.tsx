'use client';
import { useState, useEffect } from 'react';

function getInitialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  const s = localStorage.getItem('kd-theme');
  if (s === 'dark' || s === 'light') return s;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme,   setTheme]   = useState<'dark' | 'light'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = getInitialTheme();
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('kd-theme', next);
  }

  /* SSR hydration 전엔 빈 placeholder */
  if (!mounted) return <div style={{ width:40, height:40, flexShrink:0 }} />;

  return (
    <button onClick={toggle}
      aria-label={theme === 'dark' ? '라이트 모드' : '다크 모드'}
      title={theme === 'dark' ? '☀️ 라이트 모드로 전환' : '🌙 다크 모드로 전환'}
      style={{
        width:40, height:40, borderRadius:'50%',
        border:'1px solid var(--kd-border)',
        background:'var(--kd-surface-2)',
        display:'flex', alignItems:'center', justifyContent:'center',
        cursor:'pointer', fontSize:16, flexShrink:0,
        transition:'border-color 0.12s, background 0.12s',
        color:'var(--kd-text)',
      }}
      onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--kd-border-hover)')}
      onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--kd-border)')}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
'use client';
import { useEffect, useState, useCallback } from 'react';

const KEY = 'kadeora-theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme:dark)').matches;
    const current = stored ? stored === 'dark' : prefersDark;
    setIsDark(current);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    // 햅틱
    try { if ('vibrate' in navigator) navigator.vibrate(10); } catch {}
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem(KEY, next ? 'dark' : 'light');
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // PWA 상태바
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next ? '#0d1117' : '#ff5b36');
  }, [isDark]);

  if (!mounted) return <div className={`w-8 h-8 ${className}`} />;

  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-full transition-colors hover:bg-opacity-10 ${className}`}
      style={{ color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

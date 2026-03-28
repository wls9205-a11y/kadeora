'use client';
import { useState, useEffect } from 'react';

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) setProgress(Math.min((scrollTop / docHeight) * 100, 100));
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  if (progress < 1) return null;

  return (
    <>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        height: 3, background: 'rgba(37,99,235,0.08)', pointerEvents: 'none',
      }}>
        <div style={{
          height: '100%', width: `${progress}%`,
          background: 'linear-gradient(90deg, var(--brand), var(--accent-green))',
          transition: 'width 0.1s linear',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>
      {progress > 10 && progress < 98 && (
        <div style={{
          position: 'fixed', top: 8, right: 12, zIndex: 9999,
          fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
          background: 'var(--bg-elevated)', padding: '2px 8px',
          borderRadius: 10, border: '1px solid var(--border)',
          pointerEvents: 'none', opacity: 0.8,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(progress)}%
        </div>
      )}
    </>
  );
}

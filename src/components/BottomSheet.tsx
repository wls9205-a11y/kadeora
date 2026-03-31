'use client';
import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  title?: string;
}

export default function BottomSheet({ open, onClose, children, maxWidth = 520, title }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Escape 키 닫기
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    // 배경 스크롤 방지
    document.body.style.overflow = 'hidden';
    // 포커스 트랩
    const el = contentRef.current;
    if (el) {
      const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length) focusable[0].focus();
    }
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* 배경 오버레이 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }} />

      {/* 콘텐츠 */}
      <div
        ref={contentRef}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth,
          maxHeight: '80vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          padding: '12px 20px 32px',
          boxShadow: 'var(--shadow-xl)',
          animation: 'slideUp 0.25s ease',
        }}
      >
        {/* 드래그 핸들 */}
        <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 2, margin: '0 auto 12px' }} />

        {/* 제목 + 닫기 */}
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-md)' }}>
            <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
            <button onClick={onClose} style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: '50%', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16,
            }} aria-label="닫기">✕</button>
          </div>
        )}

        {children}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.5; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

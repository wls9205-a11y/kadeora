'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'var(--success-bg)', border: 'var(--success)', icon: 'var(--success)' },
  error: { bg: 'var(--error-bg)', border: 'var(--error)', icon: 'var(--error)' },
  info: { bg: 'var(--brand-light)', border: 'var(--brand)', icon: 'var(--brand)' },
  warning: { bg: 'var(--warning-bg)', border: 'var(--warning)', icon: 'var(--warning)' },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRemove = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onRemove(toast.id), 250);
  }, [toast.id, onRemove]);

  useEffect(() => {
    const duration = toast.duration ?? 3500;
    timerRef.current = setTimeout(handleRemove, duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.duration, handleRemove]);

  const c = COLORS[toast.type];

  return (
    <div
      className={leaving ? 'animate-toastOut' : 'animate-toastIn'}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp-md)',
        padding: '12px 16px', borderRadius: 'var(--radius-card)',
        background: c.bg, border: `1px solid ${c.border}`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px var(--shadow-color, rgba(0,0,0,0.4))',
        minWidth: 280, maxWidth: 400,
        cursor: 'pointer',
      }}
      onClick={handleRemove}
    >
      <span style={{
        width: 24, height: 24, borderRadius: '50%',
        background: c.icon, color: 'var(--text-inverse)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'var(--fs-sm)', fontWeight: 700, flexShrink: 0,
      }}>{ICONS[toast.type]}</span>
      <span style={{ color: 'var(--text-primary)', fontSize: 'var(--fs-base)', lineHeight: 1.4, flex: 1 }}>
        {toast.message}
      </span>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  const success = useCallback((msg: string) => toast(msg, 'success'), [toast]);
  const error = useCallback((msg: string) => toast(msg, 'error', 5000), [toast]);
  const info = useCallback((msg: string) => toast(msg, 'info'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div role="log" aria-live="polite" aria-atomic="false" style={{
        position: 'fixed', bottom: 80, right: 20, zIndex: 100,
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)',
        alignItems: 'flex-end', pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} role="alert" style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} onRemove={remove} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

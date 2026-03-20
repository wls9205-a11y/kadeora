'use client';
import React, { useState } from 'react';

// Status badge
export function AdminBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    '정상': { bg: 'var(--success)', color: 'var(--text-inverse)' },
    '차단': { bg: 'var(--error)', color: 'var(--text-inverse)' },
    '대기': { bg: 'var(--warning)', color: 'var(--text-inverse)' },
    '완료': { bg: 'var(--info)', color: 'var(--text-inverse)' },
    '기각': { bg: 'var(--bg-hover)', color: 'var(--text-secondary)' },
  };
  const c = colors[status] ?? colors['정상'];
  return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: c.bg, color: c.color }}>{status}</span>;
}

// Action button with loading + feedback
export function ActionButton({ label, onClick, variant = 'default' }: { label: string; onClick: () => Promise<any>; variant?: 'default' | 'danger' | 'success' }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const colors = { default: 'var(--brand)', danger: 'var(--error)', success: 'var(--success)' };
  const handleClick = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await onClick();
      setResult({ ok: true, msg: res?.message || '완료' });
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message || '오류' });
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 3000);
    }
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button onClick={handleClick} disabled={loading} style={{
        fontSize: 12, padding: '5px 14px', borderRadius: 6, border: 'none',
        background: colors[variant], color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
        fontWeight: 600, opacity: loading ? 0.6 : 1,
      }}>{loading ? '처리 중...' : label}</button>
      {result && <span style={{ fontSize: 11, color: result.ok ? 'var(--success)' : 'var(--error)' }}>{result.msg}</span>}
    </div>
  );
}

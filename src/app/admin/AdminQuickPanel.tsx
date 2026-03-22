'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

interface CronResult { name: string; status: number; ok: boolean }

export default function AdminQuickPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<CronResult[] | null>(null);
  const [msg, setMsg] = useState('');

  const getToken = async () => {
    const sb = createSupabaseBrowser();
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? '';
  };

  const refreshAll = async () => {
    setLoading('all'); setMsg(''); setResults(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/refresh-all', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setResults(data.results ?? []);
      setMsg(data.success ? '전체 새로고침 완료' : '일부 실패');
    } catch { setMsg('오류 발생'); }
    setLoading(null);
  };

  const triggerCron = async (endpoint: string, label: string) => {
    setLoading(label); setMsg('');
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/trigger-cron', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint }),
      });
      setMsg(res.ok ? `${label} 완료` : `${label} 실패`);
    } catch { setMsg('오류 발생'); }
    setLoading(null);
  };

  const btn = (label: string, onClick: () => void, color = 'var(--brand)') => (
    <button key={label} onClick={onClick} disabled={!!loading}
      style={{
        padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)',
        background: loading === label ? 'var(--bg-hover)' : 'transparent',
        color: loading === label ? 'var(--text-tertiary)' : color,
        fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading && loading !== label ? 0.5 : 1,
      }}>
      {loading === label ? '...' : label}
    </button>
  );

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>빠른 관리</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {btn('전체 새로고침', refreshAll)}
        {btn('시드 게시글', () => triggerCron('/api/cron/seed-posts', '시드 게시글'))}
        {btn('시드 댓글', () => triggerCron('/api/cron/seed-comments', '시드 댓글'))}
        {btn('주식 시세', () => triggerCron('/api/stock-refresh', '주식 시세'))}
      </div>
      {msg && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 8 }}>{msg}</div>}
      {results && (
        <div style={{ marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
          {results.map(r => (
            <span key={r.name} style={{ marginRight: 12 }}>
              {r.ok ? '✓' : '✗'} {r.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

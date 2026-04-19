'use client';

import { useCallback, useEffect, useState } from 'react';

interface CronStatus {
  key: string;
  label: string;
  path: string;
  last_status: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_duration_ms: number | null;
  processed: number;
  created: number;
  failed: number;
  error: string | null;
}

function timeSince(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function dot(status: string): { color: string; label: string } {
  if (status === 'success') return { color: '#10B981', label: '성공' };
  if (status === 'running') return { color: '#3B82F6', label: '실행 중' };
  if (status === 'failed') return { color: '#EF4444', label: '실패' };
  if (status === 'timeout') return { color: '#F59E0B', label: '타임아웃' };
  if (status === 'skipped') return { color: '#94A3B8', label: '스킵' };
  return { color: '#64748B', label: status || '데이터 없음' };
}

export default function BigEventCronMonitor() {
  const [rows, setRows] = useState<CronStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/big-event-crons');
      const data = await res.json();
      setRows(data?.crons || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const trigger = async (key: string) => {
    setRunning(key);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/big-event-crons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const data = await res.json();
      setMessage(data?.ok ? `✓ ${key} 실행됨 (HTTP ${data.status})` : `✗ ${key}: ${data?.error || 'failed'}`);
      setTimeout(load, 2000);
    } catch (err: any) {
      setMessage(`✗ ${key}: ${err?.message || 'network'}`);
    }
    setRunning(null);
  };

  return (
    <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#E2E8F0', marginBottom: 10 }}>
        🏗️ Big Event Phase 2 Crons (세션 138·139)
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: '#94A3B8' }}>loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12, color: '#94A3B8' }}>cron_logs 기록 없음 (아직 실행된 적 없음)</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r) => {
            const d = dot(r.last_status);
            return (
              <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 10px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6 }}>
                <span title={d.label} style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>
                    {r.path} · {d.label} · {timeSince(r.last_started_at)}
                    {r.processed > 0 ? ` · ${r.processed}건 처리` : ''}
                    {r.created > 0 ? ` · +${r.created}` : ''}
                    {r.failed > 0 ? ` · 실패 ${r.failed}` : ''}
                  </div>
                  {r.error ? <div style={{ fontSize: 10, color: '#FCA5A5', marginTop: 2 }}>⚠ {r.error.slice(0, 140)}</div> : null}
                </div>
                <button
                  onClick={() => trigger(r.key)}
                  disabled={running === r.key}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(59,123,246,0.4)',
                    background: running === r.key ? 'rgba(59,123,246,0.2)' : 'transparent',
                    color: '#60A5FA',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: running === r.key ? 'wait' : 'pointer',
                  }}
                >
                  {running === r.key ? '…' : '🚀 Run'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {message ? (
        <div style={{ fontSize: 11, color: message.startsWith('✓') ? '#10B981' : '#F87171', marginTop: 8 }}>{message}</div>
      ) : null}
    </div>
  );
}

'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, C, DataTable, Spinner, ago } from '../admin-shared';

export default function ReportsSection() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=reports').then(r => r.json()).then(d => setReports(d.reports ?? [])).finally(() => setLoading(false));
  }, []);

  const action = async (id: number, act: string) => {
    await fetch(`/api/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act }) });
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: act === 'resolve' ? 'resolved' : 'dismissed' } : r));
  };

  if (loading) return <Spinner />;

  const pending = reports.filter(r => r.status === 'pending');
  const resolved = reports.filter(r => r.status !== 'pending');

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 20px' }}>🚨 신고 관리 <span style={{ fontSize: 14, color: C.textDim, fontWeight: 400 }}>({pending.length}건 미처리)</span></h1>

      <DataTable
        headers={['사유', '상세', '유형', '신고자', '상태', '신고일', '조치']}
        rows={reports.map(r => [
          r.reason,
          <span key="d" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{r.details || '—'}</span>,
          <Badge key="t" color={C.cyan}>{r.content_type}</Badge>,
          r.profiles?.nickname || '—',
          r.status === 'pending' ? <Badge key="s" color={C.yellow}>미처리</Badge> : r.status === 'resolved' ? <Badge key="s" color={C.green}>처리</Badge> : <Badge key="s" color={C.textDim}>기각</Badge>,
          ago(r.created_at),
          r.status === 'pending' ? (
            <div key="a" style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => action(r.id, 'resolve')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.greenBg, color: C.green, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>처리</button>
              <button onClick={() => action(r.id, 'dismiss')} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: C.redBg, color: C.red, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>기각</button>
            </div>
          ) : '—',
        ])}
      />
    </div>
  );
}

// ══════════════════════════════════════
// ⚡ GOD MODE
// ══════════════════════════════════════

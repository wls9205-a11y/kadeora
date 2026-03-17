'use client';
import { useState, useEffect } from 'react';

interface Report { id: number; reason: string; details: string; content_type: string; status: string; auto_hidden: boolean; created_at: string; post_id: number | null; comment_id: number | null; message_id: number | null }

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/reports');
    if (res.ok) { const d = await res.json(); setReports(d.reports ?? []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const action = async (id: number, act: string) => {
    await fetch(`/api/admin/reports/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act }) });
    load();
  };

  const filtered = reports.filter(r => filter === 'all' || r.status === filter);
  const tabs = ['all', 'pending', 'resolved', 'dismissed'];
  const tabLabel: Record<string, string> = { all: '전체', pending: '대기', resolved: '처리완료', dismissed: '무시' };
  const tab = (v: string) => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    background: filter === v ? 'var(--brand)' : 'var(--bg-hover)',
    color: filter === v ? 'var(--text-inverse)' : 'var(--text-secondary)',
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>🚨 신고 관리</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {tabs.map(t => <button key={t} onClick={() => setFilter(t)} style={tab(t)}>{tabLabel[t]}</button>)}
      </div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>신고 내역이 없습니다</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>신고일</th>
                <th style={{ padding: '10px 8px' }}>유형</th>
                <th style={{ padding: '10px 8px' }}>사유</th>
                <th style={{ padding: '10px 8px' }}>상세</th>
                <th style={{ padding: '10px 8px' }}>상태</th>
                <th style={{ padding: '10px 8px' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{
                  borderBottom: '1px solid var(--border)',
                  background: r.status === 'pending' ? 'var(--bg-hover)' : 'transparent',
                  borderLeft: r.status === 'pending' ? '3px solid var(--brand)' : '3px solid transparent',
                }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)' }}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{r.content_type}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>{r.reason}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--text-tertiary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.details || '-'}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                      background: r.status === 'pending' ? 'var(--warning)' : r.status === 'resolved' ? 'var(--success)' : 'var(--text-tertiary)',
                      color: 'var(--text-inverse)' }}>{tabLabel[r.status] || r.status}</span>
                  </td>
                  <td style={{ padding: '10px 8px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {r.status === 'pending' && (
                      <>
                        <button onClick={() => action(r.id, 'resolve')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--success)', background: 'transparent', color: 'var(--success)', cursor: 'pointer' }}>처리완료</button>
                        <button onClick={() => action(r.id, 'dismiss')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--text-tertiary)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer' }}>무시</button>
                        {(r.post_id || r.comment_id) && (
                          <button onClick={() => action(r.id, 'hide_content')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', cursor: 'pointer' }}>콘텐츠 숨김</button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';

interface Report { id: number; reason: string; details: string; content_type: string; status: string; auto_hidden: boolean; created_at: string; post_id: number | null; comment_id: number | null; message_id: number | null; reporter?: { nickname: string } | null }

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
  const tabLabel: Record<string, string> = { all: '전체', pending: '미처리', resolved: '처리완료', dismissed: '기각' };
  const pillStyle = (v: string) => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 700,
    background: filter === v ? 'var(--brand)' : 'var(--bg-hover)',
    color: filter === v ? 'var(--text-inverse)' : 'var(--text-secondary)',
  });

  const typeBadge = (type: string) => {
    const map: Record<string, { label: string; bg: string }> = {
      post: { label: '게시글', bg: 'var(--brand)' },
      comment: { label: '댓글', bg: 'var(--warning)' },
      chat: { label: '채팅', bg: 'var(--accent-purple)' },
    };
    const info = map[type] || { label: type, bg: 'var(--text-tertiary)' };
    return (
      <span style={{
        fontSize: 'var(--fs-xs)', padding: '2px 10px', borderRadius: 10, fontWeight: 700,
        background: info.bg, color: '#fff',
      }}>
        {info.label}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string }> = {
      pending: { bg: 'var(--warning)' },
      resolved: { bg: 'var(--success)' },
      dismissed: { bg: 'var(--text-tertiary)' },
    };
    const info = map[status] || { bg: 'var(--text-tertiary)' };
    return (
      <span style={{
        fontSize: 'var(--fs-xs)', padding: '2px 10px', borderRadius: 10, fontWeight: 700,
        background: info.bg, color: '#fff',
      }}>
        {tabLabel[status] || status}
      </span>
    );
  };

  return (
    <div>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>🚨 신고 관리</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabs.map(t => <button key={t} onClick={() => setFilter(t)} style={pillStyle(t)}>{tabLabel[t]}</button>)}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>신고 내역이 없습니다</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(r => (
            <div key={r.id} style={{
              background: 'var(--bg-surface)',
              border: r.status === 'pending' ? '2px solid var(--warning)' : '1px solid var(--border)',
              borderRadius: 12,
              padding: '16px 18px',
              position: 'relative',
            }}>
              {/* Top row: type badge + status badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {typeBadge(r.content_type)}
                {statusBadge(r.status)}
                {r.auto_hidden && (
                  <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: 'var(--error)', color: '#fff' }}>
                    자동숨김
                  </span>
                )}
              </div>

              {/* Reason */}
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                {r.reason}
              </div>

              {/* Details */}
              {r.details && (
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                  {r.details}
                </div>
              )}

              {/* Reporter + date */}
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 12 }}>
                {r.reporter?.nickname ? `신고자: ${r.reporter.nickname}` : '신고자: -'}
                {' · '}
                {new Date(r.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>

              {/* Action buttons */}
              {r.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => action(r.id, 'resolve')}
                    style={{
                      fontSize: 'var(--fs-sm)', padding: '6px 14px', borderRadius: 6, fontWeight: 700,
                      border: '1px solid var(--success)', background: 'transparent', color: 'var(--success)', cursor: 'pointer',
                    }}
                  >
                    처리완료
                  </button>
                  <button
                    onClick={() => action(r.id, 'dismiss')}
                    style={{
                      fontSize: 'var(--fs-sm)', padding: '6px 14px', borderRadius: 6, fontWeight: 700,
                      border: '1px solid var(--text-tertiary)', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer',
                    }}
                  >
                    기각
                  </button>
                  {(r.post_id || r.comment_id) && (
                    <button
                      onClick={() => action(r.id, 'hide_content')}
                      style={{
                        fontSize: 'var(--fs-sm)', padding: '6px 14px', borderRadius: 6, fontWeight: 700,
                        border: 'none', background: 'var(--error)', color: '#fff', cursor: 'pointer',
                      }}
                    >
                      콘텐츠 숨기기
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

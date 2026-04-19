'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface BellRow {
  id: number;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

function fmtTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

const TYPE_ICON: Record<string, string> = {
  big_event_news: '📰',
  draft_ready: '📝',
  stage_transition: '🏗️',
  fact_alert: '⚠️',
  cron_failure: '🔥',
  generic: '🔔',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BellRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=30');
      const data = await res.json();
      setRows(data?.rows || []);
      setUnread(data?.unread_count || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markOne = async (id: number) => {
    setLoading(true);
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await load();
    } finally { setLoading(false); }
  };

  const markAll = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      await load();
    } finally { setLoading(false); }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        aria-label="알림"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'transparent',
          color: '#94A3B8',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 14 }}>🔔</span>
        {unread > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              background: '#EF4444',
              color: '#fff',
              fontSize: 9,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #0b0f1a',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 36,
            width: 320,
            maxHeight: 440,
            overflowY: 'auto',
            background: 'rgba(10,16,30,0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
            zIndex: 60,
            padding: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', marginBottom: 4 }}>
            <strong style={{ fontSize: 12, color: '#E2E8F0' }}>알림 {unread > 0 ? `(${unread})` : ''}</strong>
            <button
              onClick={markAll}
              disabled={loading || unread === 0}
              style={{ fontSize: 11, color: '#60A5FA', background: 'transparent', border: 'none', cursor: unread === 0 ? 'default' : 'pointer' }}
            >
              모두 읽음
            </button>
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: '#64748b' }}>알림이 없습니다</div>
          ) : (
            rows.map((r) => {
              const unreadRow = !r.read_at;
              const content = (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12 }}>{TYPE_ICON[r.type] || '🔔'}</span>
                    <strong style={{ fontSize: 12, color: '#E2E8F0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</strong>
                    {unreadRow && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B7BF6' }} />}
                  </div>
                  {r.body ? <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.5, margin: '2px 0 4px' }}>{r.body}</div> : null}
                  <div style={{ fontSize: 10, color: '#64748b' }}>{fmtTime(r.created_at)}</div>
                </>
              );
              const base: React.CSSProperties = {
                display: 'block',
                padding: '8px 10px',
                borderRadius: 6,
                marginBottom: 4,
                background: unreadRow ? 'rgba(59,123,246,0.06)' : 'transparent',
                border: unreadRow ? '1px solid rgba(59,123,246,0.18)' : '1px solid transparent',
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer',
              };
              if (r.url) {
                return (
                  <a
                    key={r.id}
                    href={r.url}
                    onClick={() => { if (unreadRow) void markOne(r.id); }}
                    style={base}
                  >
                    {content}
                  </a>
                );
              }
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { if (unreadRow) void markOne(r.id); }}
                  style={base}
                >
                  {content}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

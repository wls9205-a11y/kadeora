'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import type { User } from '@supabase/supabase-js';

interface Notif {
  id: string;
  type: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const TYPE_ICON: Record<string, string> = {
  post_like: '❤️', comment: '💬', reply: '↩️',
  follow: '👤', badge: '🏅', new_post: '📝',
  comment_like: '👍', system: '🔔',
  like: '❤️', // 레거시 호환
};

export default function NotificationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const { success } = useToast();

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        const { data: n } = await sb
          .from('notifications')
          .select('*')
          .eq('user_id', u.id)
          .order('created_at', { ascending: false })
          .limit(50);
        setNotifs(n ?? []);
      }
      setLoading(false);
    });
  }, []);

  async function markAllRead() {
    if (!user) return;
    const sb = createSupabaseBrowser();
    await sb.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false);
    setNotifs(p => p.map(n => ({ ...n, is_read: true })));
    success('모두 읽음 처리됐습니다');
  }

  async function markOneRead(id: string) {
    const sb = createSupabaseBrowser();
    await sb.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  const unreadCount = notifs.filter(n => !n.is_read).length;

  if (!user && !loading) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--kd-text-dim)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
      <p>로그인이 필요합니다</p>
      <a href="/login" style={{ color: 'var(--brand)', fontWeight: 700 }}>로그인하기 →</a>
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--kd-text)' }}>
            🔔 알림
          </h1>
          {unreadCount > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--kd-text-muted)' }}>
              읽지 않은 알림 {unreadCount}개
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{
            padding: '7px 14px', borderRadius: 20, border: '1px solid var(--kd-border)',
            background: 'transparent', color: 'var(--kd-text-muted)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            모두 읽음
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 64, background: 'var(--kd-surface)', borderRadius: 4, border: '1px solid var(--kd-border)', animation: 'pulse 1.8s ease-in-out infinite' }} />
          ))}
        </div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--kd-text-dim)', background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 4 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <div>알림이 없습니다</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {notifs.map(n => (
            <div key={n.id}
              onClick={() => !n.is_read && markOneRead(n.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 16px', borderRadius: 4, cursor: 'pointer',
                background: n.is_read ? 'var(--kd-surface)' : 'var(--kd-primary-dim)',
                border: `1px solid ${n.is_read ? 'var(--kd-border)' : 'rgba(255,69,0,0.2)'}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--kd-surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'var(--kd-surface)' : 'var(--kd-primary-dim)')}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>
                {TYPE_ICON[n.type] ?? '🔔'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: 'var(--kd-text)', lineHeight: 1.4 }}>
                  {n.content}
                </div>
                <div style={{ fontSize: 12, color: 'var(--kd-text-muted)', marginTop: 4 }}>
                  {timeAgo(n.created_at)}
                </div>
              </div>
              {!n.is_read && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0, marginTop: 4 }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
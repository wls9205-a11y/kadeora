'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import PullToRefresh from '@/components/PullToRefresh';
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
  like: '❤️', invite: '🎁', mention: '@',
};

function getNotifLink(n: Notif): string {
  // 댓글/좋아요/답글 알림 → 피드
  if (n.type === 'comment' || n.type === 'like' || n.type === 'post_like' || n.type === 'reply' || n.type === 'comment_like') return '/feed';
  // 팔로우 알림 → 프로필
  if (n.type === 'follow') return '/profile';
  // 시스템/마케팅 알림 → 피드
  return '/feed';
}

export default function NotificationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const { success } = useToast();
  const router = useRouter();

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
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
      <p>로그인이 필요합니다</p>
      <a href="/login" style={{ color: 'var(--brand)', fontWeight: 700 }}>로그인하기 →</a>
    </div>
  );

  return (
    <PullToRefresh>
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
            🔔 알림
          </h1>
          {unreadCount > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
              읽지 않은 알림 {unreadCount}개
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{
            padding: '7px 14px', borderRadius: 20, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-secondary)',
            fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer',
          }}>
            모두 읽음
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 64, background: 'var(--bg-surface)', borderRadius: 4, border: '1px solid var(--border)', animation: 'pulse 1.8s ease-in-out infinite' }} />
          ))}
        </div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔔</div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>아직 알림이 없어요</div>
          <div style={{ fontSize: 'var(--fs-sm)' }}>댓글, 좋아요, 팔로우 알림이 여기 표시돼요</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {notifs.map(n => (
            <div key={n.id}
              onClick={() => { if (!n.is_read) markOneRead(n.id); router.push(getNotifLink(n)); }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 16px', borderRadius: 4, cursor: 'pointer',
                background: n.is_read ? 'var(--bg-surface)' : 'var(--brand-light)',
                border: `1px solid ${n.is_read ? 'var(--border)' : 'rgba(37,99,235,0.2)'}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'var(--bg-surface)' : 'var(--brand-light)')}
            >
              <span style={{ fontSize: 'var(--fs-xl)', flexShrink: 0 }}>
                {TYPE_ICON[n.type] ?? '🔔'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {n.content}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
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
    </PullToRefresh>
  );
}
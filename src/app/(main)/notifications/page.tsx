'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useToast } from '@/components/Toast';
import Link from 'next/link';
import type { Notification } from '@/types/database';
import type { User } from '@supabase/supabase-js';

const DEMO_NOTIFICATIONS: Notification[] = [
  { id: 1, user_id: 'demo', type: 'like', title: '좋아요 알림', message: '주식고수님이 회원님의 글을 좋아합니다', is_read: false, link: '/feed/2', created_at: new Date(Date.now() - 30 * 60000).toISOString() },
  { id: 2, user_id: 'demo', type: 'comment', title: '댓글 알림', message: '마켓워처님이 댓글을 남겼습니다: "좋은 분석이에요!"', is_read: false, link: '/feed/1', created_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { id: 3, user_id: 'demo', type: 'system', title: '시스템 공지', message: 'KADEORA v5.0 업데이트! 토론방 실시간 채팅 기능이 추가되었습니다', is_read: true, link: null, created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: 4, user_id: 'demo', type: 'like', title: '좋아요 알림', message: '금융인싸님 외 3명이 회원님의 글을 좋아합니다', is_read: true, link: '/feed/3', created_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString() },
];

const TYPE_ICONS: Record<string, string> = { like: '❤️', comment: '💬', system: '📢', follow: '👤', mention: '💌' };

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (!u) { setNotifications(DEMO_NOTIFICATIONS); setIsDemo(true); setLoading(false); return; }

      const { data: notifs, error: err } = await sb
        .from('notifications').select('*').eq('user_id', u.id)
        .order('created_at', { ascending: false }).limit(50);

      if (err || !notifs || notifs.length === 0) { setNotifications(DEMO_NOTIFICATIONS); setIsDemo(true); }
      else setNotifications(notifs);
      setLoading(false);

      // Realtime
      const channel = sb.channel('notifications:' + u.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${u.id}` },
          payload => setNotifications(prev => [payload.new as Notification, ...prev])
        ).subscribe();
      return () => { sb.removeChannel(channel); };
    });
  }, []);

  const markRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    if (!isDemo) await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    if (!isDemo) await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    success('모든 알림을 읽음 처리했습니다');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) return <div style={{ textAlign: 'center', padding: '80px 0', color: '#94A3B8' }}>로딩 중...</div>;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#F1F5F9' }}>🔔 알림</h1>
          {unreadCount > 0 && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8' }}>읽지 않은 알림 {unreadCount}개</p>}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{
            padding: '7px 14px', borderRadius: 8, background: 'transparent',
            border: '1px solid #1E293B', color: '#94A3B8', fontSize: 13, cursor: 'pointer',
          }}>모두 읽음</button>
        )}
      </div>

      {isDemo && (
        <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#3B82F6' }}>
          💡 {user ? '알림이 없습니다. 미리보기 데이터를 표시합니다.' : '로그인하면 실제 알림을 받아볼 수 있습니다.'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔕</div>
            <div>알림이 없습니다</div>
          </div>
        ) : (
          notifications.map(notif => {
            const Wrapper = notif.link ? Link : 'div';
            const wrapperProps = notif.link ? { href: notif.link, style: { textDecoration: 'none' } } : {};
            return (
              <Wrapper
                key={notif.id}
                {...(wrapperProps as Record<string, unknown>)}
                onClick={() => !notif.is_read && markRead(notif.id)}
              >
                <div style={{
                  background: notif.is_read ? '#111827' : '#0f1a2e',
                  border: `1px solid ${notif.is_read ? '#1E293B' : 'rgba(59,130,246,0.3)'}`,
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}>
                  <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>
                    {TYPE_ICONS[notif.type] ?? '📬'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 14, color: '#F1F5F9', lineHeight: 1.5 }}>
                        {notif.content}
                      </p>
                      {!notif.is_read && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: '#64748B' }}>{timeAgo(notif.created_at)}</span>
                  </div>
                </div>
              </Wrapper>
            );
          })
        )}
      </div>
    </div>
  );
}

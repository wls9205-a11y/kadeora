'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import PushSubscribeButton from './PushSubscribeButton';
import { useState, useEffect } from 'react';

const MENU = [
  { href: '/feed', icon: '📋', label: '피드' },
  { href: '/stock', icon: '📊', label: '주식' },
  { href: '/apt', icon: '🏢', label: '부동산' },
  { href: '/discuss', icon: '💬', label: '라운지' },
  { href: '/hot', icon: '🔥', label: '이번주 HOT' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // 모바일에서는 숨겨져 있으므로 API 호출 스킵
    if (typeof window !== 'undefined' && window.innerWidth < 900) return;
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user);
        sb.from('notifications').select('id', { count: 'exact', head: true })
          .eq('user_id', data.session.user.id).eq('is_read', false)
          .then(({ count }) => setUnread(count ?? 0));
      }
    });
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      position: 'sticky', top: 72, height: 'fit-content',
      display: 'flex', flexDirection: 'column', gap: 4,
      paddingTop: 8,
    }}>
      {MENU.map(item => {
        const active = isActive(item.href);
        return (
          <Link key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            textDecoration: 'none', fontSize: 'var(--fs-base)', fontWeight: active ? 700 : 400,
            color: active ? 'var(--brand)' : 'var(--text-primary)',
            background: active ? 'var(--bg-hover)' : 'transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <span style={{ fontSize: 'var(--fs-lg)' }}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}

      <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

      {user && (
        <>
          <Link href={`/profile/${user.id}?tab=bookmarks`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            textDecoration: 'none', fontSize: 'var(--fs-base)',
            color: 'var(--text-primary)', background: 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <span style={{ fontSize: 'var(--fs-lg)' }}>🔖</span> 내 북마크
          </Link>
          <Link href={`/profile/${user.id}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            textDecoration: 'none', fontSize: 'var(--fs-base)',
            color: isActive('/profile') ? 'var(--brand)' : 'var(--text-primary)',
            background: isActive('/profile') ? 'var(--bg-hover)' : 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
          onMouseLeave={e => { if (!isActive('/profile')) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <span style={{ fontSize: 'var(--fs-lg)' }}>👤</span> 내 프로필
          </Link>
          <Link href="/notifications" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            textDecoration: 'none', fontSize: 'var(--fs-base)',
            color: 'var(--text-primary)', background: 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <span style={{ fontSize: 'var(--fs-lg)' }}>🔔</span>
            알림
            {unread > 0 && (
              <span style={{
                marginLeft: 'auto', background: 'var(--brand)', color: 'var(--text-inverse)',
                fontSize: 'var(--fs-xs)', fontWeight: 700, borderRadius: 10,
                padding: '2px 6px', minWidth: 18, textAlign: 'center',
              }}>{unread}</span>
            )}
          </Link>
          <Link href="/write" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '11px 14px', borderRadius: 10, marginTop: 4,
            textDecoration: 'none', fontSize: 'var(--fs-base)', fontWeight: 700,
            color: 'var(--text-inverse)', background: 'var(--brand)',
          }}>
            ✏️ 글쓰기
          </Link>
        </>
      )}

      <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

      <Link href="/blog" style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        textDecoration: 'none', fontSize: 'var(--fs-base)', fontWeight: isActive('/blog') ? 700 : 400,
        color: isActive('/blog') ? 'var(--brand)' : 'var(--text-primary)',
        background: isActive('/blog') ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!isActive('/blog')) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!isActive('/blog')) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
        <span style={{ fontSize: 'var(--fs-lg)' }}>📝</span> 블로그
      </Link>

      <Link href="/guide" style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        textDecoration: 'none', fontSize: 'var(--fs-sm)',
        color: 'var(--text-secondary)', background: 'transparent',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
        <span>📖</span> 가이드북
      </Link>

      <div style={{ padding: '0 8px', marginTop: 4 }}>
        <PushSubscribeButton />
      </div>

      {!user && (
        <Link href="/login" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '11px 14px', borderRadius: 10, marginTop: 8,
          textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700,
          color: 'var(--kakao-text, #191919)', background: 'var(--kakao-bg, #FEE500)',
        }}>
          카카오로 3초 가입
        </Link>
      )}
    </aside>
  );
}

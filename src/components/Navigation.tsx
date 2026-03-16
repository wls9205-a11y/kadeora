'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import ThemeToggle from '@/components/ThemeToggle';
import type { User } from '@supabase/supabase-js';

const NAV_ITEMS = [
  { href: '/feed',          label: '피드',   icon: '🏠' },
  { href: '/stock',         label: '주식',   icon: '📈' },
  { href: '/apt',           label: '부동산', icon: '🏘' },
  { href: '/discuss',       label: '토론',   icon: '💬' },
  { href: '/shop/megaphone',label: '상점',   icon: '🛒' },
];

const MonkeyLogo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
    <rect width="64" height="64" rx="14" fill="#FF4500"/>
    <circle cx="11" cy="32" r="8.5" fill="#CC3700"/>
    <circle cx="53" cy="32" r="8.5" fill="#CC3700"/>
    <circle cx="11" cy="32" r="5.5" fill="#FF7A50"/>
    <circle cx="53" cy="32" r="5.5" fill="#FF7A50"/>
    <ellipse cx="32" cy="29" rx="19" ry="18" fill="#FF4500"/>
    <ellipse cx="32" cy="32" rx="15" ry="14" fill="#FF7A50"/>
    <circle cx="25" cy="27" r="6" fill="#fff"/>
    <circle cx="39" cy="27" r="6" fill="#fff"/>
    <circle cx="25.5" cy="27.5" r="4" fill="#1A0800"/>
    <circle cx="39.5" cy="27.5" r="4" fill="#1A0800"/>
    <circle cx="27" cy="26" r="1.6" fill="#fff"/>
    <circle cx="41" cy="26" r="1.6" fill="#fff"/>
    <ellipse cx="32" cy="36" rx="5.5" ry="4" fill="#CC3700"/>
    <path d="M27 40.5 Q32 44.5 37 40.5" stroke="#CC3700" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        const [profRes, notifRes] = await Promise.all([
          sb.from('profiles').select('nickname').eq('id', u.id).single(),
          sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', u.id).eq('is_read', false),
        ]);
        setNickname(profRes.data?.nickname ?? null);
        setUnreadCount(notifRes.count ?? 0);
      }
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const sb2 = createSupabaseBrowser();
        sb2.from('profiles').select('nickname').eq('id', session.user.id).single()
          .then(({ data: p }) => setNickname(p?.nickname ?? null));
      } else { setNickname(null); setUnreadCount(0); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const sb = createSupabaseBrowser();
    await sb.auth.signOut();
    router.push('/login');
    setMenuOpen(false);
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--kd-nav-bg, #1A1A1B)',
        borderBottom: '1px solid var(--kd-nav-border, #343536)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 16px',
          height: 48, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* 로고 */}
          <Link href="/feed" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', flexShrink: 0, marginRight: 4 }}>
            <MonkeyLogo size={30} />
            <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--kd-text, #fff)', letterSpacing: -0.5 }} className="hidden md:inline">kadeora</span>
          </Link>

          {/* 검색 */}
          <Link href="/search" className="hidden md:flex" style={{
            flex: 1, maxWidth: 440, height: 32,
            background: 'var(--kd-surface-2, #272729)',
            border: '1px solid var(--kd-border, #343536)', borderRadius: 16,
            alignItems: 'center', padding: '0 12px', gap: 7, textDecoration: 'none',
          }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" stroke="var(--kd-text-muted,#818384)" strokeWidth="2"/>
              <path d="M16.5 16.5L21 21" stroke="var(--kd-text-muted,#818384)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 13, color: 'var(--kd-text-muted, #818384)' }}>카더라 검색...</span>
          </Link>

          {/* 데스크탑 네비 */}
          <nav className="hidden md:flex" style={{ gap: 0 }}>
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                style={{
                  padding: '0 10px', height: 48, display: 'flex', alignItems: 'center',
                  fontSize: 14, fontWeight: 700,
                  color: isActive(item.href) ? '#FF4500' : 'var(--kd-text, #D7DADC)',
                  textDecoration: 'none',
                  borderBottom: isActive(item.href) ? '2px solid #FF4500' : '2px solid transparent',
                  transition: 'color 0.1s',
                }}
              >{item.label}</Link>
            ))}
          </nav>

          {/* 우측 */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ThemeToggle />

            {user ? (
              <>
                <Link href="/write" style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 12px', borderRadius: 20,
                  background: '#FF4500', color: '#fff',
                  textDecoration: 'none', fontSize: 13, fontWeight: 700,
                }}>
                  <span className="hidden md:inline">+ 글쓰기</span>
                  <span className="md:hidden">✏</span>
                </Link>

                <Link href="/notifications" style={{ position: 'relative', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 20, background: 'var(--kd-surface-2, #272729)', border: '1px solid var(--kd-border, #343536)', color: 'var(--kd-text, #D7DADC)', textDecoration: 'none', fontSize: 15 }}>
                  🔔
                  {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, borderRadius: '50%', background: '#FF4500', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                <div style={{ position: 'relative' }}>
                  <button onClick={() => setMenuOpen(!menuOpen)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 8px', borderRadius: 20,
                    background: 'var(--kd-surface-2, #272729)', border: '1px solid var(--kd-border, #343536)',
                    color: 'var(--kd-text, #D7DADC)', fontSize: 13, cursor: 'pointer',
                  }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#FF4500', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                      {(nickname ?? user.email ?? 'U')[0].toUpperCase()}
                    </span>
                    <span className="hidden md:inline" style={{ fontSize: 13, fontWeight: 600, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nickname ?? '유저'}
                    </span>
                    <span style={{ fontSize: 9 }}>▼</span>
                  </button>
                  {menuOpen && (
                    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--kd-surface, #1A1A1B)', border: '1px solid var(--kd-border, #343536)', borderRadius: 4, overflow: 'hidden', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 200 }}>
                      {[
                        { href: `/profile/${user.id}`, label: '👤 내 프로필' },
                        { href: '/write', label: '✏️ 글쓰기' },
                        { href: '/notifications', label: `🔔 알림${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
                      ].map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                          style={{ display: 'block', padding: '10px 14px', color: 'var(--kd-text, #D7DADC)', fontSize: 14, textDecoration: 'none', borderBottom: '1px solid var(--kd-border, #343536)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--kd-surface-2, #272729)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >{item.label}</Link>
                      ))}
                      <button onClick={handleLogout} style={{ display: 'block', width: '100%', padding: '10px 14px', color: '#FF585B', fontSize: 14, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--kd-surface-2, #272729)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >🚪 로그아웃</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid var(--kd-border, #343536)', color: 'var(--kd-text, #D7DADC)', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>로그인</Link>
                <Link href="/login" className="hidden md:block" style={{ padding: '5px 14px', borderRadius: 20, background: '#FF4500', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>회원가입</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 모바일 하단 탭바 */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--kd-nav-bg, #1A1A1B)',
        borderTop: '1px solid var(--kd-nav-border, #343536)',
        display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
        padding: 'clamp(4px,1vw,8px) 0 max(clamp(4px,1vw,8px), env(safe-area-inset-bottom))',
      }} className="md:hidden">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '4px 0', textDecoration: 'none',
                color: active ? '#FF4500' : 'var(--kd-text-muted, #818384)',
              }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />}
    </>
  );
}
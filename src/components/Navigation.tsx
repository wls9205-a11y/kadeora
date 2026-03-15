'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';

const NAV_ITEMS = [
  { href: '/feed', label: '피드', icon: '🏠' },
  { href: '/stock', label: '주식', icon: '📈' },
  { href: '/apt', label: '부동산', icon: '🏢' },
  { href: '/discuss', label: '토론', icon: '💬' },
  { href: '/shop/megaphone', label: '상점', icon: '🛒' },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        sb.from('profiles').select('nickname').eq('id', data.session.user.id).single()
          .then(({ data: p }) => setNickname(p?.nickname ?? null));
      }
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        sb.from('profiles').select('nickname').eq('id', session.user.id).single()
          .then(({ data: p }) => setNickname(p?.nickname ?? null));
      } else {
        setNickname(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const sb = createSupabaseBrowser();
    await sb.auth.signOut();
    router.refresh();
    setMenuOpen(false);
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* 데스크톱 상단 네비 */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(var(--kd-bg-rgb, 10,14,23),0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--kd-border)',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 20px',
          height: 60, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* 로고 */}
          <Link href="/feed" style={{
            fontWeight: 900, fontSize: 20, color: 'var(--kd-primary)',
            letterSpacing: '-0.5px', marginRight: 12,
            textDecoration: 'none', fontFamily: 'monospace',
          }}>
            KADEORA
          </Link>

          {/* 데스크톱 메뉴 */}
          <nav className="hidden md:flex" style={{ gap: 2, flex: 1 }}>
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  fontSize: 14, fontWeight: 500,
                  color: isActive(item.href) ? 'var(--kd-primary)' : '#94A3B8',
                  background: isActive(item.href) ? 'rgba(59,130,246,0.12)' : 'transparent',
                  textDecoration: 'none', transition: 'all 0.15s',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* 우측 액션 */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/search" style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, color: '#94A3B8', textDecoration: 'none', fontSize: 16,
            }} aria-label="검색">🔍</Link>

            {user ? (
              <>
                <Link href="/notifications" style={{
                  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, color: '#94A3B8', textDecoration: 'none', fontSize: 16,
                }} aria-label="알림">🔔</Link>

                <Link href="/write" style={{
                  padding: '6px 14px', borderRadius: 8,
                  background: 'var(--kd-primary)', color: 'white',
                  textDecoration: 'none', fontSize: 13, fontWeight: 600,
                }}>✏️ 글쓰기</Link>

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 8,
                      background: 'transparent', border: '1px solid var(--kd-border)',
                      color: 'var(--kd-text)', fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'var(--kd-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: 'white',
                    }}>
                      {(nickname ?? user.email ?? 'U')[0].toUpperCase()}
                    </span>
                    <span className="hidden md:inline">{nickname ?? '나'}</span>
                    <span style={{ fontSize: 10 }}>▾</span>
                  </button>

                  {menuOpen && (
                    <div style={{
                      position: 'absolute', right: 0, top: '100%', marginTop: 4,
                      background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
                      borderRadius: 10, overflow: 'hidden', minWidth: 140,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 200,
                    }}>
                      <Link
                        href={`/profile/${user.id}`}
                        onClick={() => setMenuOpen(false)}
                        style={{
                          display: 'block', padding: '10px 14px',
                          color: 'var(--kd-text)', fontSize: 14,
                          textDecoration: 'none', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >👤 내 프로필</Link>
                      <button
                        onClick={handleLogout}
                        style={{
                          display: 'block', width: '100%', padding: '10px 14px',
                          color: 'var(--kd-danger)', fontSize: 14,
                          background: 'transparent', border: 'none',
                          cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >🚪 로그아웃</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href="/login" style={{
                padding: '6px 16px', borderRadius: 8,
                background: 'var(--kd-primary)', color: 'white',
                textDecoration: 'none', fontSize: 13, fontWeight: 600,
              }}>로그인</Link>
            )}
          </div>
        </div>
      </header>

      {/* 모바일 하단 네비 */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(var(--kd-bg-rgb, 10,14,23),0.96)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--kd-border)',
        display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
        padding: '6px 0 max(6px,env(safe-area-inset-bottom))',
      }} className="md:hidden">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '4px 0', textDecoration: 'none',
              color: active ? 'var(--kd-primary)' : '#64748B',
            }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
      )}
    </>
  );
}
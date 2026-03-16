'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { User } from '@supabase/supabase-js';

const NAV_ITEMS = [
  { href: '/feed',           label: '피드',   icon: '🏠' },
  { href: '/stock',          label: '주식',   icon: '📈' },
  { href: '/apt',            label: '부동산', icon: '🏘' },
  { href: '/discuss',        label: '토론',   icon: '💬' },
  { href: '/shop/megaphone', label: '상점',   icon: '🛒' },
  { href: '/grades',         label: '등급 안내', icon: '🏆' },
];

const MonkeyLogo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink:0, display:'block' }}>
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
  const pathname  = usePathname();
  const router    = useRouter();
  const [user, setUser]         = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [unread, setUnread]     = useState(0);

  useEffect(() => {
    const sb = createSupabaseBrowser();
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        const [pr, nr] = await Promise.all([
          sb.from('profiles').select('nickname').eq('id', u.id).single(),
          sb.from('notifications').select('id', { count:'exact', head:true }).eq('user_id', u.id).eq('is_read', false),
        ]);
        setNickname(pr.data?.nickname ?? null);
        setUnread(nr.count ?? 0);
      }
    });
    const { data:{ subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const s = createSupabaseBrowser();
        s.from('profiles').select('nickname').eq('id', session.user.id).single()
          .then(({ data:p }) => setNickname(p?.nickname ?? null));
      } else { setNickname(null); setUnread(0); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await createSupabaseBrowser().auth.signOut();
    router.push('/login'); setMenuOpen(false);
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  /* 공통 스타일 헬퍼 */
  const navItemStyle = (active: boolean) => ({
    padding: '0 10px',
    height: 48,
    display: 'flex' as const,
    alignItems: 'center' as const,
    fontSize: 14,
    fontWeight: 700,
    color: active ? 'var(--brand)' : 'var(--nav-text)',
    textDecoration: 'none' as const,
    borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
    transition: 'color 0.1s',
  });

  return (
    <>
      {/* ── 헤더 ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'var(--nav-bg)',
        borderBottom: '2px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 16px',
          height: 48, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* 로고 */}
          <Link href="/feed" style={{ display:'flex', alignItems:'center', gap:7, textDecoration:'none', flexShrink:0, marginRight:4 }}>
            <MonkeyLogo size={30} />
            <span style={{ fontWeight:800, fontSize:17, color:'var(--brand)', letterSpacing:-0.5 }} className="hidden md:inline">
              kadeora
            </span>
            <span className="hidden lg:inline" style={{ fontSize:11, fontWeight:600, color:'var(--text-tertiary)', background:'var(--bg-hover)', padding:'2px 8px', borderRadius:999, marginLeft:4 }}>
              소리소문 정보
            </span>
          </Link>

          {/* 검색바 (데스크탑) */}
          <Link href="/search" className="hidden md:flex" style={{
            flex:1, maxWidth:420, height:34,
            background:'var(--bg-hover)',
            border:'1px solid var(--border)',
            borderRadius:17, alignItems:'center', padding:'0 12px', gap:7,
            textDecoration:'none', transition:'border-color 0.15s',
          }}
            onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-strong)')}
            onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" stroke="var(--text-tertiary)" strokeWidth="2"/>
              <path d="M16.5 16.5L21 21" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize:13, color:'var(--text-tertiary)' }}>카더라 검색...</span>
          </Link>

          {/* 데스크탑 네비 */}
          <nav className="hidden md:flex" style={{ gap:0, marginLeft:4 }}>
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                style={navItemStyle(isActive(item.href))}
                onMouseEnter={e=>{ if(!isActive(item.href)) (e.currentTarget as HTMLElement).style.color='var(--text-primary)'; }}
                onMouseLeave={e=>{ if(!isActive(item.href)) (e.currentTarget as HTMLElement).style.color='var(--nav-text)'; }}
              >{item.label}</Link>
            ))}
          </nav>

          {/* 우측 액션 */}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
            <ThemeToggle />

            {/* 모바일 검색 */}
            <Link href="/search" className="md:hidden" aria-label="검색" style={{
              width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center',
              borderRadius:'50%', color:'var(--text-secondary)', textDecoration:'none', fontSize:18,
              background:'var(--bg-hover)', border:'1px solid var(--border)',
            }}>🔍</Link>

            {user ? (
              <>
                {/* 글쓰기 */}
                <Link href="/write" style={{
                  display:'flex', alignItems:'center', gap:4,
                  height:34, padding:'0 14px', borderRadius:17,
                  background:'var(--brand)', color:'var(--text-inverse, #fff)',
                  textDecoration:'none', fontSize:13, fontWeight:700,
                  whiteSpace:'nowrap',
                }}>
                  <span className="hidden md:inline">+ 글쓰기</span>
                  <span className="md:hidden" style={{fontSize:16}}>✏️</span>
                </Link>

                {/* 알림 */}
                <Link href="/notifications" aria-label="알림" style={{
                  position:'relative', width:40, height:40,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:'50%',
                  background:'var(--bg-hover)', border:'1px solid var(--border)',
                  color:'var(--text-primary)', textDecoration:'none', fontSize:16,
                  transition:'border-color 0.12s',
                }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-strong)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}
                >
                  🔔
                  {unread > 0 && (
                    <span style={{
                      position:'absolute', top:-2, right:-2,
                      width:17, height:17, borderRadius:'50%',
                      background:'var(--brand)', color:'var(--text-inverse)',
                      fontSize:9, fontWeight:800,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      border:'2px solid var(--nav-bg)',
                    }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>

                {/* 유저 메뉴 */}
                <div style={{ position:'relative' }}>
                  <button onClick={() => setMenuOpen(!menuOpen)} aria-label="사용자 메뉴" style={{
                    display:'flex', alignItems:'center', gap:5,
                    height:34, padding:'0 10px', borderRadius:17,
                    background:'var(--bg-hover)', border:'1px solid var(--border)',
                    color:'var(--text-primary)', fontSize:13, cursor:'pointer',
                    transition:'border-color 0.12s',
                  }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-strong)')}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}
                  >
                    <span style={{
                      width:22, height:22, borderRadius:'50%', background:'var(--brand)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, fontWeight:800, color:'#fff', flexShrink:0,
                    }}>
                      {(nickname ?? user.email ?? 'U')[0].toUpperCase()}
                    </span>
                    <span className="hidden md:inline" style={{ fontWeight:600, maxWidth:72, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {nickname ?? '유저'}
                    </span>
                    <span style={{ fontSize:8, color:'var(--text-tertiary)' }}>▼</span>
                  </button>

                  {menuOpen && (
                    <div style={{
                      position:'absolute', right:0, top:'calc(100% + 6px)',
                      background:'var(--bg-surface)', border:'1px solid var(--border)',
                      borderRadius:8, overflow:'hidden', minWidth:168,
                      boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:300,
                    }}>
                      {[
                        { href:`/profile/${user.id}`, label:'👤 내 프로필' },
                        { href:'/write',              label:'✏️ 글쓰기' },
                        { href:'/notifications',      label:`🔔 알림${unread>0?` (${unread})`:''}` },
                      ].map(item => (
                        <Link key={item.href} href={item.href} onClick={()=>setMenuOpen(false)} style={{
                          display:'block', padding:'11px 16px',
                          color:'var(--text-primary)', fontSize:14, textDecoration:'none',
                          borderBottom:'1px solid var(--border)',
                          transition:'background 0.1s',
                        }}
                          onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-hover)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                        >{item.label}</Link>
                      ))}
                      <button onClick={handleLogout} style={{
                        display:'block', width:'100%', padding:'11px 16px',
                        color:'var(--error)', fontSize:14,
                        background:'transparent', border:'none',
                        cursor:'pointer', textAlign:'left', transition:'background 0.1s',
                      }}
                        onMouseEnter={e=>(e.currentTarget.style.background='var(--error-bg)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                      >🚪 로그아웃</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" style={{
                  height:34, padding:'0 14px', borderRadius:17,
                  border:'1px solid var(--brand)',
                  color:'var(--brand)', background:'transparent',
                  display:'flex', alignItems:'center',
                  textDecoration:'none', fontSize:13, fontWeight:700,
                  transition:'border-color 0.12s',
                }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-strong)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}
                >로그인</Link>
                <Link href="/login" className="hidden md:flex" style={{
                  height:34, padding:'0 14px', borderRadius:17,
                  background:'var(--brand)', color:'var(--text-inverse, #fff)',
                  alignItems:'center', textDecoration:'none', fontSize:13, fontWeight:700,
                }}>회원가입</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── 모바일 하단 탭바 ── */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:200,
        background:'var(--nav-bg)',
        borderTop:'1px solid var(--nav-border)',
        display:'grid', gridTemplateColumns:`repeat(${NAV_ITEMS.length},1fr)`,
        paddingBottom:'max(8px, env(safe-area-inset-bottom))',
        paddingTop:6,
        boxShadow:'0 -2px 8px rgba(0,0,0,0.08)',
      }} className="md:hidden">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}
              aria-current={active ? 'page' : undefined}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                padding:'6px 4px', textDecoration:'none',
                color: active ? 'var(--brand)' : 'var(--text-tertiary)',
                minHeight:44,
              }}>
              <span style={{ fontSize:20, lineHeight:1 }}>{item.icon}</span>
              <span style={{ fontSize:10, fontWeight: active ? 700 : 500, lineHeight:1.2 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {menuOpen && <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={()=>setMenuOpen(false)} />}
    </>
  );
}
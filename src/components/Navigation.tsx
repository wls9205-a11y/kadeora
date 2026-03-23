'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Home, TrendingUp, Building2, Flame, MessageCircle, Search, Bell, User as UserIcon, PenSquare, BookOpen, LogOut, FileText } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { haptic } from '@/lib/haptic';
import type { User } from '@supabase/supabase-js';

const NAV_ITEMS = [
  { href: '/feed',    label: '피드',   Icon: Home },
  { href: '/stock',   label: '주식',   Icon: TrendingUp },
  { href: '/apt',     label: '부동산', Icon: Building2 },
  { href: '/blog',    label: '블로그', Icon: FileText },
  { href: '/discuss', label: '토론',   Icon: MessageCircle },
  { href: '/hot',     label: 'HOT',    Icon: Flame },
];

const MOBILE_TABS = [
  { href: '/feed',    label: '피드',   Icon: Home },
  { href: '/stock',   label: '주식',   Icon: TrendingUp },
  { href: '/apt',     label: '부동산', Icon: Building2 },
  { href: '/blog',    label: '블로그', Icon: FileText },
];

const MORE_ITEMS = [
  { href: '/discuss',       emoji: '💬', label: '라운지 토론' },
  { href: '/hot',           emoji: '🔥', label: '이번주 HOT' },
  { href: '/shop',          emoji: '🛒', label: '포인트 상점' },
  { href: '/guide',         emoji: '📖', label: '가이드북' },
  { href: '/grades',        emoji: '🏅', label: '등급 안내' },
];

const KadeoraLogo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" style={{ flexShrink:0, display:'block' }}>
    <defs>
      <linearGradient id="navyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E40AF"/>
        <stop offset="100%" stopColor="#3B82F6"/>
      </linearGradient>
    </defs>
    <rect width="72" height="72" rx="18" fill="url(#navyGrad)"/>
    <circle cx="18" cy="36" r="7" fill="white"/>
    <circle cx="36" cy="36" r="7" fill="white"/>
    <circle cx="54" cy="36" r="7" fill="white"/>
  </svg>
);

export function Navigation() {
  const pathname  = usePathname();
  const router    = useRouter();
  const [user, setUser]         = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [unread, setUnread]     = useState(0);
  const [fontSize, setFontSize] = useState('medium');

  const applyFontClass = (val: string) => {
    const el = document.documentElement;
    el.classList.remove('font-small', 'font-medium', 'font-large');
    el.classList.add(`font-${val}`);
  };

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('kd_font_size') : null;
    if (saved && ['small','medium','large'].includes(saved)) {
      setFontSize(saved);
      applyFontClass(saved);
    }
  }, []);

  const handleFontSize = (val: string) => {
    setFontSize(val);
    localStorage.setItem('kd_font_size', val);
    applyFontClass(val);
    if (user) {
      const sb = createSupabaseBrowser();
      sb.from('profiles').update({ font_size_preference: val }).eq('id', user.id).then(() => {});
    }
  };

  useEffect(() => {
    const sb = createSupabaseBrowser();
    const syncFontSize = (fontPref: string | null) => {
      if (fontPref && ['small','medium','large'].includes(fontPref)) {
        const current = localStorage.getItem('kd_font_size');
        if (!current || current !== fontPref) {
          localStorage.setItem('kd_font_size', fontPref);
          setFontSize(fontPref);
          applyFontClass(fontPref);
        }
      }
    };
    sb.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        const [pr, nr] = await Promise.all([
          sb.from('profiles').select('nickname, font_size_preference').eq('id', u.id).single(),
          sb.from('notifications').select('id', { count:'exact', head:true }).eq('user_id', u.id).eq('is_read', false),
        ]);
        setNickname(pr.data?.nickname ?? null);
        setUnread(nr.count ?? 0);
        syncFontSize(pr.data?.font_size_preference ?? null);
      }
    });
    const { data:{ subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const s = createSupabaseBrowser();
        s.from('profiles').select('nickname, font_size_preference').eq('id', session.user.id).single()
          .then(({ data:p }) => {
            setNickname(p?.nickname ?? null);
            syncFontSize(p?.font_size_preference ?? null);
          });
      } else { setNickname(null); setUnread(0); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // 알림 뱃지 30초 폴링 (탭 활성 시만)
  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const sb = createSupabaseBrowser();
        const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
        setUnread(count ?? 0);
      } catch {}
    };
    const id = setInterval(poll, 30000);
    document.addEventListener('visibilitychange', poll);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', poll); };
  }, [user]);

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
    fontSize: 'var(--fs-base)',
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
          maxWidth: 1340, margin: '0 auto', padding: '0 16px',
          height: 48, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* 로고 */}
          <Link href="/feed" style={{ display:'flex', alignItems:'center', gap:7, textDecoration:'none', flexShrink:0, marginRight:4 }}>
            <KadeoraLogo size={30} />
            <span style={{ fontWeight:800, fontSize:17, color:'var(--brand)', letterSpacing:-0.5 }}>
              카더라
            </span>
          </Link>

          {/* 검색바 (데스크탑) */}
          <Link href="/search" className="hidden md:flex" style={{
            flex:1, maxWidth:360, minWidth:160, height:34,
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
                style={{ ...navItemStyle(isActive(item.href)), gap: 5 }}
                onMouseEnter={e=>{ if(!isActive(item.href)) (e.currentTarget as HTMLElement).style.color='var(--text-primary)'; }}
                onMouseLeave={e=>{ if(!isActive(item.href)) (e.currentTarget as HTMLElement).style.color='var(--nav-text)'; }}
              ><item.Icon size={16} />{item.label}</Link>
            ))}
          </nav>

          {/* 우측 액션 */}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>

            {/* 더보기 (모바일 헤더) */}
            <button
              className="md:hidden"
              onClick={(e) => { e.stopPropagation(); setMoreOpen(!moreOpen); setMenuOpen(false); }}
              aria-label="더보기"
              style={{
                width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
                borderRadius:'50%', background:'var(--bg-hover)', border:'1px solid var(--border)',
                color: moreOpen ? 'var(--brand)' : 'var(--text-secondary)',
                cursor:'pointer', transition:'border-color 0.12s',
              }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-strong)')}
              onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>

            {user ? (
              <>
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
                  <Bell size={18} />
                  {unread > 0 && (
                    <span style={{
                      position:'absolute', top:-2, right:-2,
                      width:17, height:17, borderRadius:'50%',
                      background:'var(--brand)', color:'var(--text-inverse)',
                      fontSize:10, fontWeight:800,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      border:'2px solid var(--nav-bg)',
                    }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>

                {/* 유저 메뉴 */}
                <div style={{ position:'relative' }}>
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); setMoreOpen(false); }} aria-label="사용자 메뉴" style={{
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
                      fontSize:10, fontWeight:800, color:'var(--text-inverse)', flexShrink:0,
                    }}>
                      {(nickname ?? user.email ?? 'U')[0].toUpperCase()}
                    </span>
                    <span className="hidden md:inline" style={{ fontWeight:600, maxWidth:72, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {nickname ?? '유저'}
                    </span>
                    <span style={{ fontSize:10, color:'var(--text-tertiary)' }}>▼</span>
                  </button>

                  {menuOpen && (
                    <div style={{
                      position:'absolute', right:0, top:'calc(100% + 6px)',
                      background:'var(--bg-surface)', border:'1px solid var(--border)',
                      borderRadius:8, overflow:'hidden', minWidth:168,
                      boxShadow:'0 8px 24px rgba(0,0,0,0.15)', zIndex:300,
                    }}>
                      {[
                        { href:'/search',             label:'검색', LIcon: Search },
                        { href:`/profile/${user.id}`, label:'내 프로필', LIcon: UserIcon },
                        { href:'/write',              label:'글쓰기', LIcon: PenSquare },
                        { href:'/notifications',      label:`알림${unread>0?` (${unread})`:''}`, LIcon: Bell },
                        { href:'/hot',                label:'이번주 HOT', LIcon: Flame },
                        { href:'/guide',              label:'가이드북', LIcon: BookOpen },
                      ].map(item => (
                        <Link key={item.href} href={item.href} onClick={()=>setMenuOpen(false)} style={{
                          display:'flex', alignItems:'center', gap:8, padding:'11px 16px',
                          color:'var(--text-primary)', fontSize:'var(--fs-sm)', textDecoration:'none',
                          borderBottom:'1px solid var(--border)',
                          transition:'background 0.1s',
                        }}
                          onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-hover)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                        ><item.LIcon size={16} style={{ color:'var(--text-tertiary)' }} />{item.label}</Link>
                      ))}
                      {/* 글씨 크기 */}
                      <div style={{ padding:'9px 16px', borderBottom:'1px solid var(--border)' }}>
                        <div style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:6, fontWeight:600 }}>글씨 크기</div>
                        <div style={{ display:'flex', gap:4 }}>
                          {([['small','작게'],['medium','보통'],['large','크게']] as const).map(([val, label]) => (
                            <button key={val} onClick={() => handleFontSize(val)} aria-label={`글씨 크기 ${label}`} aria-pressed={fontSize === val} style={{
                              flex:1, padding:'4px 0', borderRadius:6, fontSize: val === 'small' ? 11 : val === 'large' ? 15 : 13,
                              fontWeight: fontSize === val ? 700 : 400, border:'none', cursor:'pointer',
                              background: fontSize === val ? 'var(--brand)' : 'var(--bg-hover)',
                              color: fontSize === val ? 'var(--text-inverse)' : 'var(--text-secondary)',
                            }}>{label}</button>
                          ))}
                        </div>
                      </div>
                      <button onClick={handleLogout} aria-label="로그아웃" style={{
                        display:'block', width:'100%', padding:'11px 16px',
                        color:'var(--error)', fontSize:14,
                        background:'transparent', border:'none',
                        cursor:'pointer', textAlign:'left', transition:'background 0.1s',
                      }}
                        onMouseEnter={e=>(e.currentTarget.style.background='var(--error-bg)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                      ><span style={{ display:'flex', alignItems:'center', gap:8 }}><LogOut size={16} /> 로그아웃</span></button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* 모바일 검색 (비로그인) */}
                <Link href="/search" className="md:hidden" aria-label="검색" style={{
                  width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:'50%', color:'var(--text-secondary)', textDecoration:'none', fontSize:16,
                  background:'var(--bg-hover)', border:'1px solid var(--border)',
                }}><Search size={18} /></Link>
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
        display:'flex', alignItems:'flex-end', justifyContent:'space-around',
        paddingBottom:'max(8px, env(safe-area-inset-bottom))',
        paddingTop:0,
        boxShadow:'0 -2px 8px rgba(0,0,0,0.08)',
      }} className="md:hidden">
        {MOBILE_TABS.slice(0, 2).map(item => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              padding:'10px 4px', textDecoration:'none', minHeight:56,
              justifyContent:'center', flex:1,
              color: active ? 'var(--brand)' : 'var(--text-tertiary)',
            }}>
              <item.Icon size={20} />
              <span style={{ fontSize:'var(--fs-xs)', fontWeight: active ? 700 : 500, lineHeight:1.2 }}>{item.label}</span>
            </Link>
          );
        })}
        {/* 글쓰기 */}
        <Link key="write" href="/write" aria-label="글쓰기" onClick={() => haptic('medium')} style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          width:48, height:48, borderRadius:14,
          background:'var(--brand)', color:'var(--text-inverse)',
          marginTop:-10, flexShrink:0, textDecoration:'none',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </Link>
        {MOBILE_TABS.slice(2).map(item => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              padding:'10px 4px', textDecoration:'none', minHeight:56,
              justifyContent:'center', flex:1,
              color: active ? 'var(--brand)' : 'var(--text-tertiary)',
            }}>
              <item.Icon size={20} />
              <span style={{ fontSize:'var(--fs-xs)', fontWeight: active ? 700 : 500, lineHeight:1.2 }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 더보기 시트 (모바일) */}
      {moreOpen && (
        <div className="md:hidden" style={{ position:'fixed', inset:0, zIndex:201 }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)' }} onClick={() => setMoreOpen(false)} />
          <div style={{
            position:'absolute', bottom:72, left:12, right:12,
            background:'var(--bg-surface)', border:'1px solid var(--border)',
            borderRadius:16, padding:16, boxShadow:'0 -8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
              {MORE_ITEMS.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                  padding:'12px 0', borderRadius:12, textDecoration:'none',
                  color:'var(--text-primary)',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize:24 }}>{item.emoji}</span>
                  <span style={{ fontSize:'var(--fs-xs)', fontWeight:600 }}>{item.label}</span>
                </Link>
              ))}
            </div>
            {user && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
                <Link href={`/profile/${user.id}`} onClick={() => setMoreOpen(false)} style={{
                  flex:1, textAlign:'center', padding:'10px 0', borderRadius:10,
                  background:'var(--bg-hover)', color:'var(--text-primary)',
                  fontSize:13, fontWeight:600, textDecoration:'none',
                }}>내 프로필</Link>
                <Link href="/notifications" onClick={() => setMoreOpen(false)} style={{
                  flex:1, textAlign:'center', padding:'10px 0', borderRadius:10,
                  background:'var(--bg-hover)', color:'var(--text-primary)',
                  fontSize:13, fontWeight:600, textDecoration:'none',
                }}>알림{unread > 0 ? ` (${unread})` : ''}</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {menuOpen && <div className="hidden md:block" style={{ position:'fixed', inset:0, zIndex:199 }} onClick={()=>setMenuOpen(false)} />}
    </>
  );
}
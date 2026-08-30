'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Home, TrendingUp, Building2, Bell, PenSquare, LogOut, FileText, MoreHorizontal, Settings,
  BarChart3, Flame, Library, Calculator, BellRing, LayoutGrid, MapPin, Lightbulb, CalendarCheck } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { haptic } from '@/lib/haptic';
import { isTossMode } from '@/lib/toss-mode';
import { isAptSiteDetailPath } from '@/lib/apt/is-site-detail';
import LiveActivityIndicator from '@/components/LiveActivityIndicator';
import UniversalSearchBar from '@/components/search/UniversalSearchBar';

const NAV_ITEMS = [
  { href: '/',        label: '홈',     Icon: Home },
  // §I-4 순서만 교체 — 아이콘·라우트·활성 판정은 그대로.
  { href: '/stock',   label: '주식',   Icon: TrendingUp },
  { href: '/apt',     label: '부동산', Icon: Building2 },
  { href: '/blog',    label: '블로그', Icon: FileText },
];

const MOBILE_TABS = [
  { href: '/',        label: '홈',     Icon: Home },
  // §I-4 하단 탭. 데스크톱 NAV_ITEMS 와 순서를 맞춘다 — 한쪽만 바꾸면 화면마다 달라진다.
  { href: '/stock',   label: '주식',   Icon: TrendingUp },
  { href: '/apt',     label: '부동산', Icon: Building2 },
  { href: '/blog',    label: '블로그', Icon: FileText },
];

type MoreItem = { href: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; sub?: string };

const MORE_ITEMS: MoreItem[] = [
  // ⛔ A4 — '/feed'(→/apt 302)·'/discuss'(접음) 항목을 뺐다. 라우트는 살아 있다.
  { href: '/daily',                  Icon: BarChart3,      label: '데일리 리포트', sub: '매일 시장 요약' },
  // ⛔ H6-5 — 「인기」는 순위를 주장하는 라벨이다. 그 순위를 만들 신호가 없다.
  { href: '/hot',                    Icon: Flame,          label: '많이 본',       sub: '조회 많은 글' },
  { href: '/blog/series',            Icon: Library,        label: '시리즈',        sub: '주제별 연재' },
  { href: '/calc',                   Icon: Calculator,     label: '계산기',        sub: '부동산·세금' },
  { href: '/notifications/settings', Icon: BellRing,       label: '알림 설정',     sub: '푸시·이메일' },
  { href: '/more',                   Icon: LayoutGrid,     label: '전체 메뉴',     sub: '모든 페이지' },
];

const KadeoraLogo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" style={{ flexShrink:0, display:'block' }}>
    <defs>
      <linearGradient id="navyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0F1B3E"/>
        <stop offset="100%" stopColor="#2563EB"/>
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
  /** H3-4 — 홈에서만 감출 것들의 판정. 홈은 hero 검색창이 그 역할을 대신한다. */
  const isHome = pathname === '/';
  const router    = useRouter();
  const { userId, profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [unread, setUnread]     = useState(0);
  const [fontSize, setFontSize] = useState('medium');
  const [tossMode, setTossModeState] = useState(false);
  /* ⛔ H6-5(2026-08-27) — 헤더 플레이스홀더의 「인기 · {키워드}」를 걷어냈다.
   *
   * H3-3 에서 trending_keywords 를 «신호가 아니다» 라고 판정하고 홈에서 끊었는데
   *   (상위 12건이 전부 heat_score 100 · `2026`·`아파트` 혼입 · 경기·서울 혼입),
   * 헤더에는 그대로 남아 전 페이지에서 「인기 · 창원」을 계속 말하고 있었다.
   * 조회(`/api/search/trending`)도 같이 없앤다 — 안 쓰는 값을 매 페이지에서 받지 않는다.
   * 라우트는 남아 있다. 계측이 붙어 실측이 되면 그때 되살린다.
   */

  // 초기화: 토스 모드 + 폰트 사이즈 (1회)
  useEffect(() => {
    // 토스 모드 감지
    if (isTossMode()) {
      setTossModeState(true);
      document.documentElement.classList.add('toss-mode');
    }
    // 폰트 사이즈 복원
    const saved = localStorage.getItem('kd_font_size');
    if (saved && ['small','medium','large'].includes(saved)) {
      setFontSize(saved);
      applyFontClass(saved);
    }
  }, []);

  const applyFontClass = (val: string) => {
    const el = document.documentElement;
    el.classList.remove('font-small', 'font-medium', 'font-large');
    el.classList.add(`font-${val}`);
  };

  const handleFontSize = (val: string) => {
    setFontSize(val);
    localStorage.setItem('kd_font_size', val);
    applyFontClass(val);
    if (userId) {
      const sb = createSupabaseBrowser();
      sb.from('profiles').update({ font_size_preference: val }).eq('id', userId).then(() => {});
    }
  };

  // 프로필 fontSizePref 동기화
  useEffect(() => {
    if (profile?.fontSizePref && ['small','medium','large'].includes(profile.fontSizePref)) {
      const current = localStorage.getItem('kd_font_size');
      if (!current || current !== profile.fontSizePref) {
        localStorage.setItem('kd_font_size', profile.fontSizePref);
        setFontSize(profile.fontSizePref);
        applyFontClass(profile.fontSizePref);
      }
    }
  }, [profile?.fontSizePref]);

  // 알림 뱃지 초기 로드
  useEffect(() => {
    if (!userId) { setUnread(0); return; }
    const sb = createSupabaseBrowser();
    sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [userId]);

  // 알림 뱃지 30초 폴링 (탭 활성 시만)
  useEffect(() => {
    if (!userId) return;
    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const sb = createSupabaseBrowser();
        const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
        setUnread(count ?? 0);
      } catch {}
    };
    const id = setInterval(poll, 30000);
    document.addEventListener('visibilitychange', poll);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', poll); };
  }, [userId]);

  // '/' 키보드 단축키 → 검색 페이지 이동
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        router.push('/search');
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [router]);

  const handleLogout = async () => {
    await createSupabaseBrowser().auth.signOut();
    router.push(`/login?redirect=${encodeURIComponent(pathname)}`); setMenuOpen(false);
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  /* 공통 스타일 헬퍼 */
  const navItemStyle = (active: boolean) => ({
    padding: '0 12px',
    height: 44,
    display: 'flex' as const,
    alignItems: 'center' as const,
    fontSize: 'var(--fs-base)',
    fontWeight: active ? 600 : 500,
    color: active ? 'var(--brand)' : 'var(--nav-text)',
    textDecoration: 'none' as const,
    borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
    transition: 'color var(--transition-fast), border-color var(--transition-fast)',
    letterSpacing: '-0.2px',
  });

  // 토스 미니앱 모드: 네비게이션 전체 숨김 (토스 네이티브 내비바가 대체)
  if (tossMode) return null;

  return (
    <>
      {/* ── 헤더 ── */}
      <header style={{
        /* 결함 2호 — 헤더는 «띠 아래» 에 멈춘다. 값은 크롬 스택에서 파생된다
           (--kd-header-top = --kd-banner-h). 띠가 없는 라우트에서는 0 이라 종전과 같다.
           ⛔ 여기에 숫자를 다시 박지 말 것 — 띠 유무가 라우트마다 다르다. */
        position: 'sticky', top: 'var(--kd-header-top)', zIndex: 100,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          maxWidth: 1340, margin: '0 auto', padding: '0 14px',
          height: 44, display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)',
        }}>
          {/* 로고 */}
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:6, textDecoration:'none', flexShrink:0, marginRight:2 }}>
            <KadeoraLogo size={26} />
            <span style={{ fontWeight:600, fontSize:'var(--fs-sm)', color:'var(--brand)', letterSpacing:-0.5 }}>
              카더라
            </span>
          </Link>

          {/* s260: UniversalSearchBar — typeahead + ⌘K 모달. 옛 fake-Link 박스(L232-255) 교체. */}
          <div className="hidden md:flex" style={{ flex:1, maxWidth:360, minWidth:160 }}>
            <UniversalSearchBar
              placeholder="단지명 · 지역 · 종목 검색"
              hotkey
            />
          </div>

          {/* 데스크탑 네비 */}
          <nav className="hidden md:flex" style={{ gap:0, marginLeft:4 }}>
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href} prefetch={true}
                aria-current={isActive(item.href) ? 'page' : undefined}
                style={{ ...navItemStyle(isActive(item.href)), gap: 6 }}
                onMouseEnter={e=>{ if(!isActive(item.href)) (e.currentTarget as HTMLElement).style.color='var(--text-primary)'; }}
                onMouseLeave={e=>{ if(!isActive(item.href)) (e.currentTarget as HTMLElement).style.color='var(--nav-text)'; }}
              ><item.Icon size={16} />{item.label}</Link>
            ))}
          </nav>

          {/* 우측 액션 */}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>

            {/* H3-4: 홈에서는 감춘다. 첫 화면에서 검색창 위 공간을 먹는데
                방문자에게 주는 정보가 없다. 다른 화면에서는 그대로 둔다. */}
            {!isHome && <LiveActivityIndicator />}
            {/* 더보기 (데스크탑 전용 — 모바일은 하단 탭바에 있음) */}
            <button
              onClick={(e) => { e.stopPropagation(); setMoreOpen(!moreOpen); setMenuOpen(false); }}
              aria-label="더보기"
              className="hidden md:flex"
              style={{
                width:36, height:36, alignItems:'center', justifyContent:'center',
                borderRadius:'50%', background:'var(--bg-hover)', border:'1px solid var(--border)',
                color: moreOpen ? 'var(--brand)' : 'var(--text-secondary)',
                cursor:'pointer', transition:'border-color 0.12s', position:'relative',
              }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-strong)')}
              onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
              {(unread > 0) && <span style={{ position:'absolute', top:0, right:0, width:8, height:8, borderRadius:'50%', background:'var(--accent-red)', border:'2px solid var(--nav-bg)' }} />}
            </button>

            {/* v4-C2: 모바일 검색 — 로그인/비로그인 분기에 같은 링크가 두 벌 있던 것을
                여기 한 벌로 합쳤다. /search 로 페이지 이동하던 동작을 데스크탑과 같은
                UniversalSearchBar 모달로 바꾼다 (같은 아이콘이 기기마다 다르게 동작했다).
                ⌘K 리스너는 데스크탑 인스턴스가 소유한다 — hotkey={false}.
                /search·/apt/search·/stock/search 라우트는 그대로 유지 (직접 진입·색인 대상). */}
            {/* H3-4: 홈에는 바로 아래 hero 검색창이 있어 중복이다 — 무엇을 눌러야 할지 헷갈린다.
                ⚠️ 다른 페이지에서는 «유일한» 검색 진입점이므로 반드시 남긴다. */}
            {/* H5-1 — 홈에서도 «마운트한다». 예전엔 홈 히어로에 검색창이 있어서 뺐는데,
                이제 히어로가 스크롤로 숨는다. 그대로 두면 모바일 홈에서 스크롤 뒤
                «검색 진입점이 0개» 가 된다.
                ⚠️ 다만 히어로가 보이는 동안에는 CSS 로 감춘다(kd-nav-search--home).
                   둘이 동시에 뜨면 Tab 순서가 두 벌이 된다. display:none 이라
                   포커스에서도 빠진다. */}
            <UniversalSearchBar
              className={['md:hidden', isHome ? 'kd-nav-search--home' : ''].filter(Boolean).join(' ')}
              variant="icon"
              hotkey={false}
            />

            {userId ? (
              <>
                {/* 알림 (데스크탑 전용 — 모바일은 더보기 시트 + 아바타 뱃지) */}
                <Link href="/notifications" aria-label="알림" className="hidden md:flex" style={{
                  position:'relative', width:40, height:40,
                  alignItems:'center', justifyContent:'center',
                  borderRadius:'50%',
                  background:'var(--bg-hover)', border:'1px solid var(--border)',
                  color:'var(--text-primary)', textDecoration:'none', fontSize: 16,
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
                      fontSize: 'var(--fs-xs)', fontWeight:500,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      border:'2px solid var(--nav-bg)',
                    }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>

                {/* 유저 메뉴 */}
                <div style={{ position:'relative' }}>
                  <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); setMoreOpen(false); }} aria-label="사용자 메뉴" className="touch-target" style={{
                    display:'flex', alignItems:'center', gap: 6,
                    height:34, padding:'0 10px', borderRadius: 'var(--radius-pill)',
                    background:'var(--bg-hover)', border:'1px solid var(--border)',
                    color:'var(--text-primary)', fontSize: 13, cursor:'pointer',
                    transition:'border-color 0.12s', position:'relative',
                  }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-strong)')}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}
                  >
                    {profile?.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <span style={{
                        width: 24, height: 24, borderRadius:'50%', background:'var(--brand)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize: 'var(--fs-xs)', fontWeight:500, color:'var(--text-inverse)', flexShrink:0,
                      }}>
                        {(profile?.nickname ?? 'U')[0].toUpperCase()}
                      </span>
                    )}
                    <span className="hidden md:inline" style={{ fontWeight:600, maxWidth:72, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {profile?.nickname ?? '유저'}
                    </span>
                    {profile?.isPremium && <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#000', fontWeight: 500, lineHeight: 1.2 }}>P</span>}
                    <span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)' }}>▼</span>
                    {/* 모바일 알림 뱃지 (아바타에 통합) */}
                    {unread > 0 && (
                      <span className="md:hidden" style={{
                        position:'absolute', top:-4, right:-4,
                        minWidth:16, height:16, borderRadius: 'var(--radius-sm)',
                        background:'var(--accent-red)', color:'#fff',
                        fontSize: 10, fontWeight:500,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        padding:'0 4px', border:'2px solid var(--nav-bg)',
                      }}>
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>

                  {menuOpen && (
                    <div style={{
                      position:'absolute', right:0, top:'calc(100% + 6px)',
                      background:'var(--bg-surface)', border:'1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', overflow:'hidden', minWidth:180,
                      boxShadow:'0 8px 24px rgba(0,0,0,0.25)', zIndex: 9999,
                    }}>
                      {/* 프로필 헤더 — 가장 눈에 띄게 */}
                      <Link href={`/profile/${userId}`} onClick={()=>setMenuOpen(false)} style={{
                        display:'flex', alignItems:'center', gap: 10, padding:'12px 16px',
                        color:'var(--text-primary)', textDecoration:'none',
                        borderBottom:'1px solid var(--border)',
                        background:'rgba(59,123,246,0.04)',
                      }}
                        onMouseEnter={e=>(e.currentTarget.style.background='rgba(59,123,246,0.08)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='rgba(59,123,246,0.04)')}
                      >
                        {profile?.avatarUrl ? (
                          <img src={profile.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <span style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 14, fontWeight:500, color:'var(--text-inverse)', flexShrink:0 }}>
                            {(profile?.nickname ?? 'U')[0].toUpperCase()}
                          </span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.nickname ?? '내 프로필'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>프로필 보기</div>
                        </div>
                      </Link>
                      {[
                        { href:'/write',              label:'글쓰기', LIcon: PenSquare },
                        { href:'/notifications',      label:`알림${unread>0?` (${unread})`:''}`, LIcon: Bell },
                        { href:'/notifications/settings', label:'알림 설정', LIcon: Settings },
                        // r4-P4: 더보기 서랍의 '설정' 그룹에서 승계
                        { href:'/settings/region',    label:'우리동네 설정', LIcon: MapPin },
                        { href:'/settings/interests', label:'관심사 설정',   LIcon: Lightbulb },
                        { href:'/attendance',         label:'출석 체크',     LIcon: CalendarCheck },
                      ].map(item => (
                        <Link key={item.href} href={item.href} onClick={()=>setMenuOpen(false)} style={{
                          display:'flex', alignItems:'center', gap: 'var(--sp-sm)', padding:'11px 16px',
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
                        <div style={{ fontSize: 12, color:'var(--text-tertiary)', marginBottom:6, fontWeight:600 }}>글씨 크기</div>
                        <div style={{ display:'flex', gap: 'var(--sp-xs)' }}>
                          {([['small','작게'],['medium','보통'],['large','크게']] as const).map(([val, label]) => (
                            <button key={val} onClick={() => handleFontSize(val)} aria-label={`글씨 크기 ${label}`} aria-pressed={fontSize === val} style={{
                              flex:1, padding:'4px 0', borderRadius: 'var(--radius-xs)', fontSize: val === 'small' ? 12 : val === 'large' ? 16 : 14,
                              fontWeight: fontSize === val ? 600 : 400, border:'none', cursor:'pointer',
                              background: fontSize === val ? 'var(--brand)' : 'var(--bg-hover)',
                              color: fontSize === val ? 'var(--text-inverse)' : 'var(--text-secondary)',
                            }}>{label}</button>
                          ))}
                        </div>
                      </div>
                      <button onClick={handleLogout} aria-label="로그아웃" style={{
                        display:'block', width:'100%', padding:'11px 16px',
                        color:'var(--error)', fontSize: 14,
                        background:'transparent', border:'none',
                        cursor:'pointer', textAlign:'left', transition:'background 0.1s',
                      }}
                        onMouseEnter={e=>(e.currentTarget.style.background='var(--error-bg)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                      ><span style={{ display:'flex', alignItems:'center', gap: 'var(--sp-sm)' }}><LogOut size={16} /> 로그아웃</span></button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href={`/login?redirect=${encodeURIComponent(pathname)}&source=nav`}
                  onClick={() => {
                    try {
                      const body = JSON.stringify({
                        event_type: 'cta_click',
                        cta_name: 'nav_login_button',
                        category: 'signup',
                        page_path: window.location.pathname,
                      });
                      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                        navigator.sendBeacon('/api/events/cta', new Blob([body], { type: 'application/json' }));
                      } else {
                        fetch('/api/events/cta', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body,
                          keepalive: true,
                        }).catch(() => {});
                      }
                    } catch {}
                  }}
                  className="touch-target"
                  style={{
                    height:34, padding:'0 16px', borderRadius: 'var(--radius-pill)',
                    background:'var(--brand)', color:'var(--text-inverse)',
                    display:'flex', alignItems:'center',
                    textDecoration:'none', fontSize:'var(--fs-sm)', fontWeight:500,
                    letterSpacing:'-0.2px',
                    boxShadow:'0 2px 8px rgba(59,123,246,0.24)',
                    transition:'opacity 0.12s, transform 0.12s',
                  }}
                  onMouseEnter={e=>(e.currentTarget.style.opacity='0.92')}
                  onMouseLeave={e=>(e.currentTarget.style.opacity='1')}
                >로그인</Link>
                <Link
                  href={`/login?redirect=${encodeURIComponent(pathname)}&source=nav_signup`}
                  className="hidden md:flex touch-target"
                  style={{
                    height:34, padding:'0 14px', borderRadius: 'var(--radius-pill)',
                    border:'1px solid var(--brand)', color:'var(--brand)', background:'transparent',
                    alignItems:'center', textDecoration:'none', fontSize:'var(--fs-xs)', fontWeight:500,
                    transition:'background 0.12s',
                  }}
                  onMouseEnter={e=>(e.currentTarget.style.background='rgba(59,123,246,0.08)')}
                  onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                >회원가입</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── 모바일 하단 탭바 ── */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
        borderTop:'1px solid var(--nav-border)',
        display:'flex', alignItems:'flex-end', justifyContent:'space-around',
        paddingBottom:'max(6px, env(safe-area-inset-bottom))',
        paddingTop:0,
      }} className="md:hidden">
        {MOBILE_TABS.map(item => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} aria-label={item.label} aria-current={active ? 'page' : undefined} style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              padding:'10px 8px 6px', textDecoration:'none', minHeight:56,
              justifyContent:'center', flex:1, position:'relative',
              color: active ? 'var(--brand)' : 'var(--text-tertiary)',
              transition:'color var(--transition-fast) ease',
            }}>
              {active && <span style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:24, height:2.5, borderRadius: 4, background:'var(--brand)' }} />}
              <item.Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 500, lineHeight:1.2 }}>{item.label}</span>
            </Link>
          );
        })}
        {/* 더보기 탭 */}
        <button
          aria-label="더보기"
          onClick={(e) => { e.stopPropagation(); setMoreOpen(!moreOpen); setMenuOpen(false); haptic('light'); }}
          style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:2,
            padding:'10px 8px 6px', minHeight:56,
            justifyContent:'center', flex:1, position:'relative',
            color: moreOpen ? 'var(--brand)' : 'var(--text-tertiary)',
            transition:'color var(--transition-fast) ease',
            background:'none', border:'none', cursor:'pointer',
          }}
        >
          {moreOpen && <span style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:24, height:2.5, borderRadius: 4, background:'var(--brand)' }} />}
          <MoreHorizontal size={18} strokeWidth={moreOpen ? 2.5 : 1.8} />
          <span style={{ fontSize: 10, fontWeight: moreOpen ? 600 : 500, lineHeight:1.2 }}>더보기</span>
        </button>
      </nav>

      {/* FAB 글쓰기 버튼 — 모바일 전용.
           ⚠️ B8-1: 현장 상세에서는 렌더하지 «않는다». 그 자리를 SiteFloatingActions
              (공유 · 현장 댓글)가 쓴다. 컴포넌트를 지우는 게 아니라 그 한 화면에서만 끊는 것 —
              ClientShell 이 홈에서 NoticeBanner 를 끊는 것과 같은 방식이다.
           ⚠️ CSS 로 감추지 않는 이유: display:none 은 앵커를 DOM 에 남긴다.
              /write 는 정리 예정 라우트라(H7-6) 보이지 않는 링크로 남기면 안 된다. */}
      {!isAptSiteDetailPath(pathname ?? '') && (
      <Link href="/write" aria-label="글쓰기" onClick={() => haptic('medium')} className="md:hidden" style={{
        position:'fixed', bottom: 'calc(68px + env(safe-area-inset-bottom))', right: 16,
        zIndex: 99, width: 52, height: 52, borderRadius: '50%',
        background: 'var(--brand)', color: '#fff',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow: '0 4px 16px rgba(59,123,246,0.4)',
        textDecoration: 'none',
        transition: 'transform 0.15s ease, box-shadow 0.2s ease',
      }}>
        <PenSquare size={22} strokeWidth={2.2} />
      </Link>
      )}
      {moreOpen && (
        <div style={{ position:'fixed', inset:0, zIndex: 9999 }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)' }} onClick={() => setMoreOpen(false)} />
          {/* 모바일: 바텀 시트 — r4-P4: 5그룹 27건에서 평평한 8건으로 */}
          <div className="md:hidden" style={{
            position:'absolute', bottom:60, left:8, right:8,
            maxWidth: 400, marginLeft: 'auto', marginRight: 'auto',
            background:'var(--bg-surface)', border:'1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding:'16px 14px 12px', boxShadow:'0 -8px 32px rgba(0,0,0,0.3)',
            maxHeight:'72vh', overflowY:'auto',
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.3px' }}>더보기</span>
              <button onClick={() => setMoreOpen(false)} aria-label="더보기 닫기" style={{
                width: 32, height: 32, borderRadius:'50%', background:'var(--bg-hover)', border:'none',
                color:'var(--text-tertiary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 4 }}>
                {MORE_ITEMS.map(item => (
                  <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap: 6,
                    padding:'14px 6px 12px', borderRadius: 'var(--radius-card)', textDecoration:'none',
                    color:'var(--text-primary)', background:'var(--bg-hover)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  >
                    <item.Icon size={16} style={{ color:'var(--text-tertiary)' }} />
                    <span style={{ fontSize: 12, fontWeight:600, textAlign:'center', lineHeight: 1.25, color:'var(--text-secondary)', wordBreak:'keep-all' }}>{item.label}</span>
                    {item.sub && <span style={{ fontSize: 10, color:'var(--text-tertiary)', textAlign:'center', lineHeight:1.2, marginTop: -2 }}>{item.sub}</span>}
                  </Link>
                ))}
            </div>
            <div style={{ paddingTop: 12, display:'flex', gap: 6 }}>
              {userId && (
                <>
                  <Link href={`/profile/${userId}`} onClick={() => setMoreOpen(false)} style={{
                    flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                    background:'var(--bg-hover)', color:'var(--text-primary)',
                    fontSize: 12, fontWeight:600, textDecoration:'none', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>내 프로필</Link>
                  <Link href="/notifications" onClick={() => setMoreOpen(false)} style={{
                    flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                    background: unread > 0 ? 'var(--brand)' : 'var(--bg-hover)',
                    color: unread > 0 ? '#fff' : 'var(--text-primary)',
                    fontSize: 12, fontWeight:600, textDecoration:'none', border: unread > 0 ? 'none' : '1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>알림{unread > 0 ? ` ${unread}` : ''}</Link>
                </>
              )}
            </div>
          </div>
          {/* 데스크탑: 상단 드롭다운 */}
          <div className="hidden md:block" style={{
            position:'absolute', top:52, right:16,
            width: 420,
            background:'var(--bg-surface)', border:'1px solid var(--border)',
            borderRadius: 'var(--radius-card)', padding:'16px 14px', boxShadow:'0 8px 32px rgba(0,0,0,0.25)',
            maxHeight:'75vh', overflowY:'auto',
          }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 4 }}>
                {MORE_ITEMS.map(item => (
                  <Link key={item.href + '-d'} href={item.href} onClick={() => setMoreOpen(false)} style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap: 6,
                    padding:'14px 6px 12px', borderRadius: 'var(--radius-card)', textDecoration:'none',
                    color:'var(--text-primary)', background:'var(--bg-hover)',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  >
                    <item.Icon size={16} style={{ color:'var(--text-tertiary)' }} />
                    <span style={{ fontSize: 12, fontWeight:600, textAlign:'center', lineHeight: 1.25, color:'var(--text-secondary)', wordBreak:'keep-all' }}>{item.label}</span>
                  </Link>
                ))}
            </div>
            <div style={{ paddingTop: 12, display:'flex', gap: 6 }}>
              {userId && (
                <>
                  <Link href={`/profile/${userId}`} onClick={() => setMoreOpen(false)} style={{
                    flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                    background:'var(--bg-hover)', color:'var(--text-primary)',
                    fontSize: 12, fontWeight:600, textDecoration:'none', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>내 프로필</Link>
                  <Link href="/write" onClick={() => setMoreOpen(false)} style={{
                    flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                    background:'var(--bg-hover)', color:'var(--text-primary)',
                    fontSize: 12, fontWeight:600, textDecoration:'none', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>글쓰기</Link>
                  <Link href="/notifications" onClick={() => setMoreOpen(false)} style={{
                    flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                    background: unread > 0 ? 'var(--brand)' : 'var(--bg-hover)',
                    color: unread > 0 ? '#fff' : 'var(--text-primary)',
                    fontSize: 12, fontWeight:600, textDecoration:'none', border: unread > 0 ? 'none' : '1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>알림{unread > 0 ? ` ${unread}` : ''}</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {menuOpen && <div className="hidden md:block" style={{ position:'fixed', inset:0, zIndex: 99 }} onClick={()=>setMenuOpen(false)} />}
    </>
  );
}
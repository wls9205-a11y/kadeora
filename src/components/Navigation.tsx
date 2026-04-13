'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Home, TrendingUp, Building2, Search, Bell, User as UserIcon, PenSquare, LogOut, FileText, MoreHorizontal, Settings, Sun, Moon, Download } from 'lucide-react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
import { haptic } from '@/lib/haptic';
import { isTossMode } from '@/lib/toss-mode';
import { useTheme } from '@/components/ThemeProvider';

const NAV_ITEMS = [
  { href: '/feed',    label: '피드',   Icon: Home },
  { href: '/stock',   label: '주식',   Icon: TrendingUp },
  { href: '/apt',     label: '부동산', Icon: Building2 },
  { href: '/blog',    label: '블로그', Icon: FileText },
];

const MOBILE_TABS = [
  { href: '/feed',    label: '피드',   Icon: Home },
  { href: '/stock',   label: '주식',   Icon: TrendingUp },
  { href: '/apt',     label: '부동산', Icon: Building2 },
  { href: '/blog',    label: '블로그', Icon: FileText },
];

const MORE_ITEMS: { href: string; emoji: string; label: string; sub?: string; group: string }[] = [
  // 투자 정보
  { href: '/daily',            emoji: '📊', label: '데일리 리포트', sub: '매일 시장 요약', group: '투자 정보' },
  { href: '/hot',             emoji: '🔥', label: '이번주 HOT', sub: '인기 글 모아보기', group: '투자 정보' },
  { href: '/blog',            emoji: '📰', label: '블로그', sub: '7,600+ 분석 글', group: '투자 정보' },
  { href: '/blog/series',     emoji: '📚', label: '시리즈', sub: '주제별 연재 모음', group: '투자 정보' },
  { href: '/discuss',         emoji: '💬', label: '라운지 토론', sub: 'A vs B 투표·토론', group: '투자 정보' },
  // 주식
  { href: '/stock/compare',   emoji: '⚖️', label: '종목 비교', sub: '핵심 지표 비교', group: '주식' },
  { href: '/stock/search',    emoji: '🔍', label: '종목 검색', sub: '1,800+종목 필터', group: '주식' },
  { href: '/stock/dividend',  emoji: '💎', label: '배당주 TOP', sub: '고배당 종목 순위', group: '주식' },
  { href: '/stock/movers',    emoji: '📈', label: '급등락', sub: '실시간 등락률', group: '주식' },
  { href: '/stock/themes',    emoji: '🎯', label: '테마주', sub: '섹터별 관련주', group: '주식' },
  { href: '/stock/data',      emoji: '📥', label: '주식 통계', sub: '시장 데이터', group: '주식' },
  // 부동산
  { href: '/apt/complex',     emoji: '🏢', label: '단지백과', sub: '34,500+ 단지 시세', group: '부동산' },
  { href: '/apt/search',      emoji: '🔍', label: '실거래 검색', sub: '전국 실거래가', group: '부동산' },
  { href: '/apt/map',         emoji: '🗺️', label: '부동산 지도', sub: '지도로 한눈에', group: '부동산' },
  { href: '/apt/diagnose',    emoji: '🎯', label: '가점 진단', sub: '청약 가점 계산', group: '부동산' },
  { href: '/apt/data',        emoji: '📥', label: '부동산 통계', sub: '공공 데이터', group: '부동산' },
  // 도구
  { href: '/calc',            emoji: '🧮', label: '계산기', sub: '부동산·세금 계산', group: '도구' },
  // 설정
  { href: '/notifications/settings', emoji: '🔔', label: '알림 설정', sub: '푸시·관심 설정', group: '설정' },
  { href: '/settings/region',       emoji: '📍', label: '우리동네 설정', sub: '지역 설정·변경', group: '설정' },
  { href: '/settings/interests',    emoji: '💡', label: '관심사 설정', sub: '맞춤 피드 설정', group: '설정' },
  { href: '/attendance',     emoji: '🌱', label: '출석 체크', sub: '매일 포인트 적립', group: '설정' },
  { href: '/guide',           emoji: '📖', label: '가이드북', sub: '이용 방법 안내', group: '설정' },
  { href: '/grades',          emoji: '🏅', label: '등급 안내', sub: '등급별 혜택', group: '설정' },
  { href: '/about',           emoji: 'ℹ️', label: '서비스 소개', sub: '카더라 소개', group: '설정' },
  { href: '/faq',             emoji: '❓', label: 'FAQ', sub: '자주 묻는 질문', group: '설정' },
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
  const router    = useRouter();
  const { userId, profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [unread, setUnread]     = useState(0);
  const [fontSize, setFontSize] = useState('medium');
  const [tossMode, setTossModeState] = useState(false);
  const [trendingKw, setTrendingKw] = useState('');

  // 인기검색어 — 헤더 검색바에 통합 표시
  useEffect(() => {
    let kws: string[] = [];
    let idx = 0;
    let timer: ReturnType<typeof setInterval>;
    fetch('/api/search/trending').then(r => r.json()).then(d => {
      const arr = d?.keywords || d || [];
      kws = Array.isArray(arr) ? arr.slice(0, 8).map((k: { keyword?: string } | string) => typeof k === 'string' ? k : k.keyword || '') : [];
      if (kws.length) setTrendingKw(kws[0]);
      if (kws.length > 1) {
        timer = setInterval(() => { idx = (idx + 1) % kws.length; setTrendingKw(kws[idx]); }, 3500);
      }
    }).catch(() => {});
    return () => clearInterval(timer);
  }, []);
  const { theme, toggleTheme } = useTheme();

  // 초기화: 토스 모드 + 폰트 사이즈 (1회)
  useEffect(() => {
    // 토스 모드 감지
    if (isTossMode()) {
      setTossModeState(true);
      document.documentElement.setAttribute('data-theme', 'light');
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
    fontWeight: active ? 800 : 600,
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
        position: 'sticky', top: 0, zIndex: 100,
        background: theme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(13,23,48,0.88)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          maxWidth: 1340, margin: '0 auto', padding: '0 14px',
          height: 44, display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)',
        }}>
          {/* 로고 */}
          <Link href="/feed" style={{ display:'flex', alignItems:'center', gap:6, textDecoration:'none', flexShrink:0, marginRight:2 }}>
            <KadeoraLogo size={26} />
            <span style={{ fontWeight:800, fontSize:'var(--fs-sm)', color:'var(--brand)', letterSpacing:-0.5 }}>
              카더라
            </span>
          </Link>



          {/* 검색바 (데스크탑) — 인기검색어 통합 */}
          <Link href="/search" className="hidden md:flex" style={{
            flex:1, maxWidth:360, minWidth:160, height:34,
            background:'var(--bg-hover)',
            border:'1px solid var(--border)',
            borderRadius: 'var(--radius-pill)', alignItems:'center', padding:'0 14px', gap: 'var(--sp-sm)',
            textDecoration:'none', transition:'border-color var(--transition-fast)',
            justifyContent:'space-between',
          }}
            onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-strong)')}
            onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}
          >
            <div style={{ display:'flex', alignItems:'center', gap:6, overflow:'hidden', flex:1 }}>
              <Search size={13} color="var(--text-tertiary)" style={{ flexShrink:0 }} />
              {trendingKw ? (
                <span style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize: 10, fontWeight:700, color:'var(--brand)', padding:'0px 4px', borderRadius: 4, border:'1px solid var(--brand)', lineHeight:'14px', flexShrink:0 }}>인기</span>
                  {trendingKw}
                </span>
              ) : (
                <span style={{ fontSize:12, color:'var(--text-tertiary)' }}>종목, 청약, 블로그 검색...</span>
              )}
            </div>
            <kbd style={{ fontSize:10, fontWeight:600, color:'var(--text-tertiary)', background:'var(--bg-base)', padding:'1px 5px', borderRadius:4, border:'1px solid var(--border)', fontFamily:'monospace', lineHeight:1.5 }}>/</kbd>
          </Link>

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

            {userId ? (
              <>
                {/* 모바일 검색 (로그인) */}
                <Link href="/search" className="md:hidden" aria-label="검색" style={{
                  width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:'50%', color:'var(--text-secondary)', textDecoration:'none', fontSize:16,
                  background:'var(--bg-hover)', border:'1px solid var(--border)',
                }}><Search size={18} /></Link>

                {/* 알림 (데스크탑 전용 — 모바일은 더보기 시트 + 아바타 뱃지) */}
                <Link href="/notifications" aria-label="알림" className="hidden md:flex" style={{
                  position:'relative', width:40, height:40,
                  alignItems:'center', justifyContent:'center',
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
                      fontSize: 'var(--fs-xs)', fontWeight:800,
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
                    display:'flex', alignItems:'center', gap: 6,
                    height:34, padding:'0 10px', borderRadius: 'var(--radius-pill)',
                    background:'var(--bg-hover)', border:'1px solid var(--border)',
                    color:'var(--text-primary)', fontSize:13, cursor:'pointer',
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
                        fontSize: 'var(--fs-xs)', fontWeight:800, color:'var(--text-inverse)', flexShrink:0,
                      }}>
                        {(profile?.nickname ?? 'U')[0].toUpperCase()}
                      </span>
                    )}
                    <span className="hidden md:inline" style={{ fontWeight:600, maxWidth:72, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {profile?.nickname ?? '유저'}
                    </span>
                    {profile?.isPremium && <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#000', fontWeight: 800, lineHeight: 1.2 }}>P</span>}
                    <span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)' }}>▼</span>
                    {/* 모바일 알림 뱃지 (아바타에 통합) */}
                    {unread > 0 && (
                      <span className="md:hidden" style={{
                        position:'absolute', top:-4, right:-4,
                        minWidth:16, height:16, borderRadius: 'var(--radius-sm)',
                        background:'var(--accent-red)', color:'#fff',
                        fontSize:10, fontWeight:800,
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
                          <span style={{ width:32, height:32, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 14, fontWeight:800, color:'var(--text-inverse)', flexShrink:0 }}>
                            {(profile?.nickname ?? 'U')[0].toUpperCase()}
                          </span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.nickname ?? '내 프로필'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>프로필 보기</div>
                        </div>
                      </Link>
                      {[
                        { href:'/write',              label:'글쓰기', LIcon: PenSquare },
                        { href:'/notifications',      label:`알림${unread>0?` (${unread})`:''}`, LIcon: Bell },
                        { href:'/notifications/settings', label:'알림 설정', LIcon: Settings },
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
                        <div style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:6, fontWeight:600 }}>글씨 크기</div>
                        <div style={{ display:'flex', gap: 'var(--sp-xs)' }}>
                          {([['small','작게'],['medium','보통'],['large','크게']] as const).map(([val, label]) => (
                            <button key={val} onClick={() => handleFontSize(val)} aria-label={`글씨 크기 ${label}`} aria-pressed={fontSize === val} style={{
                              flex:1, padding:'4px 0', borderRadius: 'var(--radius-xs)', fontSize: val === 'small' ? 12 : val === 'large' ? 16 : 14,
                              fontWeight: fontSize === val ? 700 : 400, border:'none', cursor:'pointer',
                              background: fontSize === val ? 'var(--brand)' : 'var(--bg-hover)',
                              color: fontSize === val ? 'var(--text-inverse)' : 'var(--text-secondary)',
                            }}>{label}</button>
                          ))}
                        </div>
                      </div>
                      {/* 테마 전환 */}
                      <div style={{ padding:'9px 16px', borderBottom:'1px solid var(--border)' }}>
                        <div style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:6, fontWeight:600 }}>화면 테마</div>
                        <div style={{ display:'flex', gap: 'var(--sp-xs)' }}>
                          {([['dark','다크 모드', Moon],['light','라이트 모드', Sun]] as const).map(([val, label, Icon]) => (
                            <button key={val} onClick={theme !== val ? toggleTheme : undefined} style={{
                              flex:1, padding:'5px 0', borderRadius: 'var(--radius-xs)',
                              fontWeight: theme === val ? 700 : 400, border:'none', cursor:'pointer',
                              background: theme === val ? 'var(--brand)' : 'var(--bg-hover)',
                              color: theme === val ? 'var(--text-inverse)' : 'var(--text-secondary)',
                              display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontSize:12,
                            }}>
                              <Icon size={13} />{label}
                            </button>
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
                      ><span style={{ display:'flex', alignItems:'center', gap: 'var(--sp-sm)' }}><LogOut size={16} /> 로그아웃</span></button>
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
                <Link href={`/login?redirect=${encodeURIComponent(pathname)}&source=nav`} style={{
                  height:34, padding:'0 14px', borderRadius: 'var(--radius-pill)',
                  border:'1px solid var(--brand)',
                  color:'var(--brand)', background:'transparent',
                  display:'flex', alignItems:'center',
                  textDecoration:'none', fontSize:'var(--fs-xs)', fontWeight:700,
                  transition:'border-color 0.12s',
                }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--border-strong)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}
                >로그인</Link>
                <Link href={`/login?redirect=${encodeURIComponent(pathname)}&source=nav`} className="hidden md:flex" style={{
                  height:34, padding:'0 14px', borderRadius: 'var(--radius-pill)',
                  background:'var(--brand)', color:'var(--text-inverse, #fff)',
                  alignItems:'center', textDecoration:'none', fontSize:'var(--fs-xs)', fontWeight:700,
                }}>회원가입</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── 모바일 하단 탭바 ── */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex: 100,
        background: theme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(13,23,48,0.92)',
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
              <span style={{ fontSize:10, fontWeight: active ? 700 : 500, lineHeight:1.2 }}>{item.label}</span>
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
          <span style={{ fontSize:10, fontWeight: moreOpen ? 700 : 500, lineHeight:1.2 }}>더보기</span>
        </button>
      </nav>

      {/* FAB 글쓰기 버튼 — 모바일 전용 */}
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
      {moreOpen && (
        <div style={{ position:'fixed', inset:0, zIndex: 9999 }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)' }} onClick={() => setMoreOpen(false)} />
          {/* 모바일: 바텀 시트 — 리디자인 */}
          <div className="md:hidden" style={{
            position:'absolute', bottom:60, left:8, right:8,
            maxWidth: 400, marginLeft: 'auto', marginRight: 'auto',
            background:'var(--bg-surface)', border:'1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding:'16px 14px 12px', boxShadow:'0 -8px 32px rgba(0,0,0,0.3)',
            maxHeight:'72vh', overflowY:'auto',
          }}>
            {/* 헤더 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 16 }}>
              <span style={{ fontSize:15, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-0.3px' }}>더보기</span>
              <button onClick={() => setMoreOpen(false)} style={{
                width: 32, height: 32, borderRadius:'50%', background:'var(--bg-hover)', border:'none',
                color:'var(--text-tertiary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {(['투자 정보','주식','부동산','도구','설정'] as const).map((group, gi) => {
              const items = MORE_ITEMS.filter(i => i.group === group);
              return (
                <div key={group} style={{ marginBottom: gi < 3 ? 12 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, paddingLeft: 2 }}>{group}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 4 }}>
                    {items.map(item => (
                      <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} style={{
                        display:'flex', flexDirection:'column', alignItems:'center', gap: 6,
                        padding:'14px 6px 12px', borderRadius: 'var(--radius-card)', textDecoration:'none',
                        color:'var(--text-primary)', position:'relative', background:'var(--bg-hover)',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      >
                        <span style={{ fontSize: 22, lineHeight:1 }}>{item.emoji}</span>
                        <span style={{ fontSize: 12, fontWeight:600, textAlign:'center', lineHeight: 1.25, color:'var(--text-secondary)', wordBreak:'keep-all' }}>{item.label}</span>
                        {item.sub && <span style={{ fontSize: 10, color:'var(--text-tertiary)', textAlign:'center', lineHeight:1.2, marginTop: -2 }}>{item.sub}</span>}
                        {item.emoji === '🔔' && unread > 0 && (
                          <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 'var(--radius-md)', background: 'var(--accent-red)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unread > 9 ? '9+' : unread}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                  {gi < 3 && <div style={{ height:1, background:'var(--border)', margin:'12px 0 0', opacity:0.5 }} />}
                </div>
              );
            })}
            {/* 하단 액션 바 */}
            <div style={{ paddingTop: 12, display:'flex', gap: 6 }}>
              <button onClick={toggleTheme} style={{
                flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                background:'var(--bg-hover)', color:'var(--text-primary)',
                fontSize:12, fontWeight:600, border:'1px solid var(--border)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap: 6,
              }}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? '라이트' : '다크'}
              </button>
              {userId && (
                <>
                  <Link href={`/profile/${userId}`} onClick={() => setMoreOpen(false)} style={{
                    flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                    background:'var(--bg-hover)', color:'var(--text-primary)',
                    fontSize:12, fontWeight:600, textDecoration:'none', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>내 프로필</Link>
                  <Link href="/notifications" onClick={() => setMoreOpen(false)} style={{
                    flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                    background: unread > 0 ? 'var(--brand)' : 'var(--bg-hover)',
                    color: unread > 0 ? '#fff' : 'var(--text-primary)',
                    fontSize:12, fontWeight:600, textDecoration:'none', border: unread > 0 ? 'none' : '1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>알림{unread > 0 ? ` ${unread}` : ''}</Link>
                </>
              )}
            </div>
          </div>
          {/* 데스크탑: 상단 드롭다운 — 리디자인 */}
          <div className="hidden md:block" style={{
            position:'absolute', top:52, right:16,
            width: 420,
            background:'var(--bg-surface)', border:'1px solid var(--border)',
            borderRadius: 'var(--radius-card)', padding:'16px 14px', boxShadow:'0 8px 32px rgba(0,0,0,0.25)',
            maxHeight:'75vh', overflowY:'auto',
          }}>
            {(['투자 정보','주식','부동산','도구','설정'] as const).map((group, gi) => {
              const items = MORE_ITEMS.filter(i => i.group === group);
              return (
                <div key={group} style={{ marginBottom: gi < 3 ? 12 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, paddingLeft: 2 }}>{group}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 4 }}>
                    {items.map(item => (
                      <Link key={item.href + '-d'} href={item.href} onClick={() => setMoreOpen(false)} style={{
                        display:'flex', flexDirection:'column', alignItems:'center', gap: 6,
                        padding:'14px 6px 12px', borderRadius: 'var(--radius-card)', textDecoration:'none',
                        color:'var(--text-primary)', position:'relative', background:'var(--bg-hover)',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      >
                        <span style={{ fontSize: 22, lineHeight:1 }}>{item.emoji}</span>
                        <span style={{ fontSize: 12, fontWeight:600, textAlign:'center', lineHeight: 1.25, color:'var(--text-secondary)' }}>{item.label}</span>
                        {item.emoji === '🔔' && unread > 0 && (
                          <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 'var(--radius-md)', background: 'var(--accent-red)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unread > 9 ? '9+' : unread}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                  {gi < 3 && <div style={{ height:1, background:'var(--border)', margin:'12px 0 0', opacity:0.5 }} />}
                </div>
              );
            })}
            <div style={{ paddingTop: 12, display:'flex', gap: 6 }}>
              <button onClick={toggleTheme} style={{
                flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                background:'var(--bg-hover)', color:'var(--text-primary)',
                fontSize:12, fontWeight:600, border:'1px solid var(--border)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap: 6,
              }}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? '라이트' : '다크'}
              </button>
              {userId && (
                <>
                  <Link href={`/profile/${userId}`} onClick={() => setMoreOpen(false)} style={{
                    flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                    background:'var(--bg-hover)', color:'var(--text-primary)',
                    fontSize:12, fontWeight:600, textDecoration:'none', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>내 프로필</Link>
                  <Link href="/write" onClick={() => setMoreOpen(false)} style={{
                    flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                    background:'var(--bg-hover)', color:'var(--text-primary)',
                    fontSize:12, fontWeight:600, textDecoration:'none', border:'1px solid var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>글쓰기</Link>
                  <Link href="/notifications" onClick={() => setMoreOpen(false)} style={{
                    flex:1, padding:'10px 0', borderRadius: 'var(--radius-md)',
                    background: unread > 0 ? 'var(--brand)' : 'var(--bg-hover)',
                    color: unread > 0 ? '#fff' : 'var(--text-primary)',
                    fontSize:12, fontWeight:600, textDecoration:'none', border: unread > 0 ? 'none' : '1px solid var(--border)',
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
'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import CategoryGrid, { type CategoryGridItem } from '@/components/ui/CategoryGrid';

const MENU = [
  { href: '/feed', icon: '📋', label: '피드' },
  { href: '/stock', icon: '📊', label: '주식' },
  { href: '/apt', icon: '🏢', label: '부동산' },
  { href: '/discuss', icon: '💬', label: '라운지' },
  { href: '/hot', icon: '🔥', label: '이번주 HOT' },
];

// Phase 9b-1: page-aware 카테고리 (정적 데이터 — 카운트는 사전 검증된 값)
function getPageGrid(pathname: string, search: string): { title: string; items: CategoryGridItem[] } | null {
  if (pathname.startsWith('/apt')) {
    return {
      title: '부동산 분류',
      items: [
        { icon: '🏗️', label: '분양 진행', href: '/apt?tab=subscription', active: search === 'tab=subscription' },
        { icon: '⏰', label: '분양 임박 D-7', href: '/apt?tab=imminent', active: search === 'tab=imminent' },
        { icon: '🏠', label: '모델하우스', href: '/apt?tab=model', active: search === 'tab=model' },
        { icon: '⚠️', label: '미분양·줍줍', href: '/apt?tab=unsold', active: search === 'tab=unsold' },
        { icon: '🏗️', label: '재건축·재개발', href: '/apt?tab=redev', active: search === 'tab=redev' },
        { icon: '📊', label: '실거래·시세', href: '/apt?tab=trade', active: search === 'tab=trade' },
      ],
    };
  }
  if (pathname.startsWith('/stock')) {
    return {
      title: '시장',
      items: [
        { icon: '🇰🇷', label: 'KOSPI', href: '/stock?market=kospi', active: search === 'market=kospi' },
        { icon: '🇰🇷', label: 'KOSDAQ', href: '/stock?market=kosdaq', active: search === 'market=kosdaq' },
        { icon: '🇺🇸', label: 'NYSE', href: '/stock?market=nyse', active: search === 'market=nyse' },
        { icon: '🇺🇸', label: 'NASDAQ', href: '/stock?market=nasdaq', active: search === 'market=nasdaq' },
      ],
    };
  }
  if (pathname.startsWith('/blog')) {
    return {
      title: '블로그 카테고리',
      items: [
        { icon: '📈', label: '종목·투자', count: 2805, href: '/blog?cat=stock-invest', active: search.includes('cat=stock-invest') },
        { icon: '🏠', label: '청약·분양', count: 1816, href: '/blog?cat=cheongak', active: search.includes('cat=cheongak') },
        { icon: '📊', label: '실거래·시세', count: 1056, href: '/blog?cat=trade', active: search.includes('cat=trade') },
        { icon: '🏗️', label: '재개발·재건축', count: 361, href: '/blog?cat=redev', active: search.includes('cat=redev') },
        { icon: '🔥', label: '테마·섹터', count: 16, href: '/blog?cat=theme', active: search.includes('cat=theme') },
        { icon: '📝', label: '기타', count: 1322, href: '/blog?cat=etc', active: search.includes('cat=etc') },
      ],
    };
  }
  if (pathname.startsWith('/feed')) {
    return {
      title: '피드 카테고리',
      items: [
        { icon: '🏠', label: '청약', href: '/feed?category=apt', active: search.includes('category=apt') },
        { icon: '📈', label: '주식', href: '/feed?category=stock', active: search.includes('category=stock') },
        { icon: '💬', label: '토론', href: '/feed?category=discuss', active: search.includes('category=discuss') },
        { icon: '📝', label: '자유', href: '/feed?category=free', active: search.includes('category=free') },
      ],
    };
  }
  if (pathname.startsWith('/write')) {
    return {
      title: '발행 위치',
      items: [
        { icon: '📋', label: '피드', href: '/write?to=feed' },
        { icon: '📝', label: '블로그', href: '/write?to=blog' },
      ],
    };
  }
  return null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams ? searchParams.toString() : '';
  const pageGrid = getPageGrid(pathname, search);
  const { userId } = useAuth();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      position: 'sticky', top: 72, height: 'fit-content',
      display: 'flex', flexDirection: 'column', gap: 'var(--sp-xs)',
      paddingTop: 8,
    }}>
      {MENU.map(item => {
        const active = isActive(item.href);
        return (
          <Link key={item.href} href={item.href} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)',
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

      {userId && (
        <>
          <Link href={`/profile/${userId}?tab=bookmarks`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)',
            textDecoration: 'none', fontSize: 'var(--fs-base)',
            color: 'var(--text-primary)', background: 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
            <span style={{ fontSize: 'var(--fs-lg)' }}>🔖</span> 내 북마크
          </Link>
          <Link href={`/profile/${userId}`} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)',
            textDecoration: 'none', fontSize: 'var(--fs-base)',
            color: isActive('/profile') ? 'var(--brand)' : 'var(--text-primary)',
            background: isActive('/profile') ? 'var(--bg-hover)' : 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
          onMouseLeave={e => { if (!isActive('/profile')) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <span style={{ fontSize: 'var(--fs-lg)' }}>👤</span> 내 프로필
          </Link>
          <Link href="/write" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-sm)',
            padding: '11px 14px', borderRadius: 'var(--radius-md)', marginTop: 'var(--sp-xs)',
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
        padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)',
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
        padding: 'var(--sp-md) var(--card-p)', borderRadius: 'var(--radius-md)',
        textDecoration: 'none', fontSize: 'var(--fs-sm)',
        color: 'var(--text-secondary)', background: 'transparent',
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
        <span>📖</span> 가이드북
      </Link>

      {/* Phase 9b-1: page-aware CategoryGrid */}
      {pageGrid && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0 8px' }} />
          <CategoryGrid title={pageGrid.title} items={pageGrid.items} />
        </>
      )}

      <div style={{ padding: '0 8px', marginTop: 'var(--sp-xs)' }}>
        
      </div>

      {!userId && (
        <Link href={`/login?redirect=${encodeURIComponent(pathname)}&source=sidebar`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '11px 14px', borderRadius: 'var(--radius-md)', marginTop: 'var(--sp-sm)',
          textDecoration: 'none', fontSize: 'var(--fs-sm)', fontWeight: 700,
          color: 'var(--kakao-text, #191919)', background: 'var(--kakao-bg, #FEE500)',
        }}>
          카카오로 3초 가입
        </Link>
      )}
    </aside>
  );
}

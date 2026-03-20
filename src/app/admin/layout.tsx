'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuGroups = [
  { section: '개요', items: [{ href: '/admin', icon: '📊', label: '대시보드' }] },
  { section: '콘텐츠', items: [
    { href: '/admin/content', icon: '📝', label: '게시글' },
    { href: '/admin/comments', icon: '💬', label: '댓글' },
    { href: '/admin/reports', icon: '🚨', label: '신고' },
  ]},
  { section: '사용자', items: [{ href: '/admin/users', icon: '👥', label: '회원' }] },
  { section: '운영', items: [
    { href: '/admin/notifications', icon: '📢', label: '공지/전광판' },
    { href: '/admin/system', icon: '🔧', label: '시스템' },
    { href: '/admin/payments', icon: '💰', label: '결제' },
  ]},
];

const mobileItems = menuGroups.flatMap(g => g.items);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex"
        style={{
          width: 240,
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          flexDirection: 'column',
          background: '#0f172a',
          zIndex: 50,
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ff5b36' }}>카더라</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>관리자 콘솔</div>
        </div>

        {/* Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', padding: '0 8px', flex: 1 }}>
          {menuGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', padding: '8px 12px 4px', textTransform: 'uppercase', letterSpacing: 1 }}>{group.section}</div>
              {group.items.map(item => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                      background: active ? 'rgba(255,91,54,0.15)' : 'transparent',
                      color: active ? 'white' : 'rgba(255,255,255,0.6)',
                      borderLeft: active ? '3px solid #ff5b36' : '3px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom link */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Link href="/feed" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            ← 사이트로
          </Link>
        </div>
      </aside>

      {/* Mobile Top Tabs */}
      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          overflowX: 'auto',
          padding: '0 8px',
          gap: 0,
        }}
      >
        {mobileItems.map(m => {
          const active = isActive(m.href);
          return (
            <Link
              key={m.href}
              href={m.href}
              style={{
                padding: '12px 10px 10px',
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                color: active ? '#ff5b36' : 'var(--text-secondary)',
                borderBottom: active ? '2px solid #ff5b36' : '2px solid transparent',
              }}
            >
              {m.icon} {m.label}
            </Link>
          );
        })}
      </div>

      {/* Main Content */}
      <main
        className="md:ml-[240px]"
        style={{ padding: 24, minHeight: '100vh' }}
      >
        <div className="pt-12 md:pt-0" style={{ maxWidth: 1100 }}>
          {children}
        </div>
      </main>
    </div>
  );
}

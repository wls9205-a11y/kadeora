'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { icon: '📊', label: '대시보드', href: '/admin' },
  { icon: '👥', label: '회원관리', href: '/admin/users' },
  { icon: '📝', label: '게시글관리', href: '/admin/content' },
  { icon: '💬', label: '댓글관리', href: '/admin/comments' },
  { icon: '🚨', label: '신고관리', href: '/admin/reports' },
  { icon: '📢', label: '공지/전광판', href: '/admin/notifications' },
  { icon: '💰', label: '결제내역', href: '/admin/payments' },
  { icon: '🔧', label: '시스템', href: '/admin/system' },
];

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
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px', flex: 1 }}>
          {menuItems.map(m => {
            const active = isActive(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: active ? 'rgba(255,91,54,0.2)' : 'transparent',
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  borderLeft: active ? '3px solid #ff5b36' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 16 }}>{m.icon}</span>
                <span>{m.label}</span>
              </Link>
            );
          })}
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
        {menuItems.map(m => {
          const active = isActive(m.href);
          return (
            <Link
              key={m.href}
              href={m.href}
              style={{
                padding: '12px 12px 10px',
                fontSize: 12,
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

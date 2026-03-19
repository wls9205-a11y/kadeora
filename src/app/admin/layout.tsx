'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuGroups = [
  {
    items: [
      { label: '📊 대시보드', href: '/admin' },
    ],
  },
  {
    items: [
      { label: '👥 유저관리', href: '/admin/users' },
    ],
  },
  {
    items: [
      { label: '📢 알림·공지', href: '/admin/notifications' },
    ],
  },
  {
    items: [
      { label: '🏠 부동산', href: '/admin/realestate' },
    ],
  },
  {
    items: [
      { label: '⚙️ 시스템', href: '/admin/system' },
    ],
  },
  {
    items: [
      { label: '📝 콘텐츠 관리', href: '/admin/content' },
      { label: '🚨 신고 관리', href: '/admin/reports' },
      { label: '💳 결제 내역', href: '/admin/payments' },
    ],
  },
];

const allMenus = menuGroups.flatMap(g => g.items);

const mobileMenus = allMenus.map(m => {
  const shortLabels: Record<string, string> = {
    '📊 대시보드': '📊 홈',
    '📢 알림·공지': '📢 알림',
    '📝 콘텐츠 관리': '📝 콘텐츠',
  };
  return { ...m, label: shortLabels[m.label] || m.label };
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex" style={{
        width: 210, flexShrink: 0, flexDirection: 'column',
        background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }}>
        <div style={{ padding: '20px 16px 12px', fontWeight: 800, fontSize: 16, color: 'var(--brand)' }}>
          카더라 어드민
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '0 8px' }}>
          {menuGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && (
                <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />
              )}
              {group.items.map(m => {
                const active = isActive(m.href);
                return (
                  <Link key={m.href} href={m.href} style={{
                    display: 'block', padding: '10px 12px', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    background: active ? 'var(--bg-hover)' : 'transparent',
                    color: active ? 'var(--brand)' : 'var(--text-secondary)',
                    transition: 'all 0.1s',
                  }}>{m.label}</Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <Link href="/feed" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>
            ← 서비스로 돌아가기
          </Link>
        </div>
      </aside>

      {/* Mobile Top Tabs */}
      <div className="md:hidden" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', overflowX: 'auto', padding: '8px 8px', gap: 4,
      }}>
        {mobileMenus.map(m => {
          const active = isActive(m.href);
          return (
            <Link key={m.href} href={m.href} style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              background: active ? 'var(--bg-hover)' : 'transparent',
              color: active ? 'var(--brand)' : 'var(--text-secondary)',
            }}>{m.label}</Link>
          );
        })}
      </div>

      {/* Main Content */}
      <main className="pt-16 md:pt-0" style={{ flex: 1, padding: 24, maxWidth: 1100 }}>
        {children}
      </main>
    </div>
  );
}

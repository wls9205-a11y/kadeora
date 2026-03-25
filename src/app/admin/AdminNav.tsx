'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin', label: '⚡ 컨트롤 타워', exact: true },
  { href: '/admin/system', label: '⚙️ 시스템' },
  { href: '/admin/blog', label: '📰 블로그' },
  { href: '/admin/realestate', label: '🏢 부동산' },
  { href: '/admin/content', label: '📝 콘텐츠' },
  { href: '/admin/users', label: '👥 유저' },
  { href: '/admin/notifications', label: '🔔 알림' },
  { href: '/admin/comments', label: '💬 댓글' },
  { href: '/admin/reports', label: '🚨 신고' },
  { href: '/admin/payments', label: '💳 결제' },
  { href: '/admin/infra', label: '🖥️ 인프라' },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none',
      padding: '8px 0', marginBottom: 16, borderBottom: '1px solid var(--border)',
    }}>
      {NAV.map(n => {
        const active = n.exact ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 'var(--fs-xs)',
            fontWeight: active ? 700 : 500, flexShrink: 0, textDecoration: 'none',
            background: active ? 'var(--brand)' : 'transparent',
            color: active ? '#fff' : 'var(--text-secondary)',
            border: active ? 'none' : '1px solid var(--border)',
          }}>
            {n.label}
          </Link>
        );
      })}
      <Link href="/feed" style={{
        padding: '6px 12px', borderRadius: 8, fontSize: 'var(--fs-xs)',
        fontWeight: 500, flexShrink: 0, textDecoration: 'none',
        background: 'transparent', color: 'var(--text-tertiary)',
        border: '1px solid var(--border)', marginLeft: 'auto',
      }}>
        ← 사이트로
      </Link>
    </nav>
  );
}

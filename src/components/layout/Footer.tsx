import Link from 'next/link';
import { BIZ_INFO_LINE, BIZ_ADDRESS_LINE, BIZ_CONTACT_LINE } from '@/lib/constants';

const LINKS: { href: string; label: string }[] = [
  { href: '/stock', label: '주식' },
  { href: '/stock/dividend', label: '배당주' },
  { href: '/stock/themes', label: '테마주' },
  { href: '/apt', label: '부동산' },
  { href: '/apt/complex', label: '단지백과' },
  { href: '/apt/redev', label: '재개발' },
  { href: '/blog', label: '블로그' },
  { href: '/calc', label: '계산기' },
  { href: '/daily/전국', label: '데일리' },
  { href: '/hot', label: '인기글' },
  { href: '/feed', label: '커뮤니티' },
  { href: '/discuss', label: '토론' },
  { href: '/premium', label: '프리미엄' },
  { href: '/press', label: '보도자료' },
  { href: '/about', label: '소개' },
  { href: '/terms', label: '이용약관' },
  { href: '/privacy', label: '개인정보처리방침' },
];

export default function Footer() {
  return (
    <footer
      className="hidden md:block"
      style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 40px' }}
    >
      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 16,
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          lineHeight: 1.9,
        }}
      >
        <nav
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 12,
            fontSize: 11,
          }}
        >
          {LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
          사업자 정보
        </p>
        <p>{BIZ_INFO_LINE}</p>
        <p>대표자: 노영진</p>
        <p>{BIZ_ADDRESS_LINE}</p>
        <p>{BIZ_CONTACT_LINE}</p>
        <p style={{ marginTop: 4 }}>
          © 2026{' '}
          <Link
            href="/about"
            style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}
          >
            카더라
          </Link>
          . All rights reserved.
        </p>
      </div>
    </footer>
  );
}

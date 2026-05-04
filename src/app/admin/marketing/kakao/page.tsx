import Link from 'next/link';
import KakaoMarketingClient from './_components/KakaoMarketingClient';
import SendHistory from './_components/SendHistory';

export const dynamic = 'force-dynamic';
export const metadata = { title: '카카오 마케팅 — 어드민' };

export default function KakaoMarketingPage() {
  return (
    <div
      style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: 'clamp(12px, 3vw, 24px)',
        color: 'var(--text-primary, #fff)',
        background: 'var(--bg-base, #0d0e14)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md, 10px)',
          background: 'var(--bg-elevated, #1f2028)',
          border: '1px solid var(--border, #2a2b35)',
        }}
      >
        <Link
          href="/admin"
          style={{ fontSize: 12, color: 'var(--text-tertiary, #888)', textDecoration: 'none' }}
        >
          ← 어드민
        </Link>
        <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>📨 카카오 마케팅 허브</h1>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>
          세그먼트 빌더 · 발송 · 동의 만료 알림
        </span>
      </header>

      <KakaoMarketingClient />

      {/* Server Component — initial fetch */}
      <SendHistory />
    </div>
  );
}

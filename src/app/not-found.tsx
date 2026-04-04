import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-primary)', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
      <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 8 }}>페이지를 찾을 수 없습니다</h1>
      <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', marginBottom: 24 }}>요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
      <Link href="/feed" style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontSize: 'var(--fs-base)', fontWeight: 700 }}>홈으로 돌아가기</Link>
    </div>
  );
}

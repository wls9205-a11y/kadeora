import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  // s212 P0-B: template 가 '| 카더라' 자동 추가
  title: '준비 중',
  robots: { index: false, follow: false },
};

export default function ConsultantPage() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>서비스 준비 중</h1>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 24, lineHeight: 1.6 }}>분양 상담사 등록 서비스는 현재 준비 중입니다. 빠른 시일 내에 만나뵐게요.</p>
      <Link href="/apt" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 'var(--radius-md)', background: 'var(--brand)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>청약 정보 보러가기</Link>
    </div>
  );
}

'use client';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function CalcSignupCTA({ calcSlug, category }: { calcSlug: string; category: string }) {
  const { userId } = useAuth();
  if (userId) return null;

  return (
    <div data-nudge="context-cta" style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '20px 20px 18px', marginTop: 20, marginBottom: 16, textAlign: 'center',
    }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
        카더라에서 더 많은 기능을 이용해보세요
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
        142종 무료 계산기 · 부동산 청약·분양 알림 · 주식 시세 · 커뮤니티
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <Link href={`/login?redirect=/calc/${category}/${calcSlug}&source=calc_cta`} style={{
          padding: '10px 24px', borderRadius: 8, background: 'var(--brand)', color: '#fff',
          fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>
          카카오로 3초 가입
        </Link>
        <Link href="/calc" style={{
          padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--bg-hover)', color: 'var(--text-secondary)',
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}>
          계산기 전체보기
        </Link>
      </div>
    </div>
  );
}

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
        계산 결과를 저장하고 알림을 받아보세요
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
        청약 마감 알림 · 관심 종목 급등/급락 알림 · 주간 시세 리포트 — 모두 무료
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <Link href={`/login?redirect=/calc/${category}/${calcSlug}&source=calc_cta`} style={{
          padding: '10px 24px', borderRadius: 'var(--radius-md)', background: 'var(--brand)', color: '#fff',
          fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>
          무료 알림 설정하기
        </Link>
        <Link href="/calc" style={{
          padding: '10px 24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
          background: 'var(--bg-hover)', color: 'var(--text-secondary)',
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}>
          계산기 전체보기
        </Link>
      </div>
    </div>
  );
}

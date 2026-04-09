'use client';
import { useAuth } from '@/components/AuthProvider';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function SignupCTA() {
  const { userId, loading } = useAuth();
  const pathname = usePathname();

  if (loading || userId) return null;

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      marginBottom: 'var(--sp-md)',
    }}>
      {/* 상단 */}
      <div style={{ padding: '24px 20px 20px', textAlign: 'center' }}>
        {/* 로고 */}
        <div style={{ marginBottom: 10 }}>
          <svg width="32" height="32" viewBox="0 0 72 72" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
            <defs><linearGradient id="ctaLg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#0F1B3E" /><stop offset="100%" stopColor="#2563EB" /></linearGradient></defs>
            <rect width="72" height="72" rx="18" fill="url(#ctaLg)" />
            <circle cx="18" cy="36" r="7" fill="white" /><circle cx="36" cy="36" r="7" fill="white" /><circle cx="54" cy="36" r="7" fill="white" />
          </svg>
        </div>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3 }}>
          카더라에서 더 많은 정보를 확인하세요
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          무료 가입하면 모든 기능을 이용할 수 있어요
        </div>

        {/* 혜택 필 태그 */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', margin: '14px 0 18px' }}>
          {['청약 마감 알림', '관심 종목 등락 알림', '실거래가 분석', 'AI 투자 요약'].map(t => (
            <span key={t} style={{
              fontSize: 'var(--fs-xs)', padding: '4px 12px', borderRadius: 'var(--radius-xl)',
              background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)',
              border: '1px solid rgba(59,123,246,0.15)', fontWeight: 600,
            }}>{t}</span>
          ))}
        </div>

        {/* 카카오 가입 버튼 */}
        <Link
          href={`/login?redirect=${encodeURIComponent(pathname)&source=signup_cta}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: 15, border: 'none', borderRadius: 'var(--radius-card)',
            fontSize: 'var(--fs-base)', fontWeight: 700, textDecoration: 'none',
            background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
            boxShadow: '0 4px 20px rgba(254,229,0,0.25)',
            marginBottom: 'var(--sp-sm)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 512 512" fill="#191919">
            <path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z"/>
          </svg>
          카카오로 3초 가입
        </Link>

        {/* 둘러보기 */}
        <Link
          href="/feed"
          style={{
            display: 'block', width: '100%', padding: 11, borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)',
            textDecoration: 'none', textAlign: 'center',
          }}
        >
          먼저 둘러볼게요
        </Link>
      </div>

      {/* 하단 통계 */}
      <div style={{
        background: 'var(--bg-elevated, var(--bg-base))',
        padding: '14px 20px',
        display: 'flex', justifyContent: 'center', gap: 24,
        borderTop: '1px solid var(--border)',
      }}>
        {[
          { num: '20,000+', label: '블로그 글' },
          { num: '5,500+', label: '분양 현장' },
          { num: '700+', label: '주식 종목' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)' }}>{s.num}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

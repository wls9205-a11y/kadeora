'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

/**
 * ContentLock — 고부가가치 콘텐츠 잠금
 * - SSR: children 전체 렌더 (봇 SEO 보호)
 * - 클라이언트 비로그인: 블러 처리 + 가입 CTA
 * - 클라이언트 로그인: children 전체 표시
 */
export default function ContentLock({
  children,
  title = '더 자세한 분석 보기',
  description = '가입하면 무료로 열람할 수 있어요',
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const { userId } = useAuth();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // SSR 또는 로그인 → 전체 표시
  if (!mounted || userId) return <>{children}</>;

  return (
    <div style={{ position: 'relative' }} data-gate="content">
      {/* 블러 처리된 콘텐츠 (높이 유지) */}
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none', maxHeight: 200, overflow: 'hidden' }}>
        {children}
      </div>
      {/* 오버레이 CTA */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(transparent 0%, var(--bg-base) 60%)',
      }}>
        <div style={{ textAlign: 'center', padding: '16px 20px' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🔓</div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>{description}</div>
          <Link href={`/login?redirect=${encodeURIComponent(pathname)&source=content_lock}`} style={{
            display: 'inline-block', padding: '8px 24px', borderRadius: 'var(--radius-pill)',
            background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
            fontWeight: 700, fontSize: 'var(--fs-sm)', textDecoration: 'none',
          }}>무료 가입하고 보기</Link>
        </div>
      </div>
    </div>
  );
}

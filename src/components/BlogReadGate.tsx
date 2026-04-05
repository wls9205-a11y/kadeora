'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

/**
 * 블로그 읽기 제한 게이트 v2
 * - 비로그인: 항상 본문 60% 잘림 + 가입 CTA
 * - 로그인: 무제한
 * - SSR(봇): 전체 본문 렌더 (SEO 보호)
 */
export default function BlogReadGate({
  htmlFull,
  htmlTruncated,
  slug,
  category,
}: {
  htmlFull: string;
  htmlTruncated: string;
  slug: string;
  category: string;
}) {
  const { userId } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // SSR: 전체 보여주기 (봇 SEO 보호)
  if (!mounted) {
    return <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlFull }} />;
  }

  // 로그인 → 전체 본문
  if (userId) {
    return <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlFull }} />;
  }

  // 비로그인 → 항상 잘린 본문 + 게이트
  const ctaTexts: Record<string, string> = {
    stock: '종목 분석 리포트',
    apt: '청약·분양 분석',
    unsold: '미분양 분석',
    finance: '재테크 정보',
  };
  const ctaLabel = ctaTexts[category] || '투자 분석';

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="blog-content"
        itemProp="articleBody"
        style={{ maxHeight: 'clamp(350px, 55vh, 700px)', overflow: 'hidden' }}
        dangerouslySetInnerHTML={{ __html: htmlTruncated }}
      />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 140,
        background: 'linear-gradient(transparent, var(--bg-base))',
      }} />
      <div style={{
        textAlign: 'center', padding: '28px 20px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', marginTop: -12, position: 'relative',
      }} data-gate="content">
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
          계속 읽으려면 무료 가입하세요
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          가입하면 {ctaLabel}을 무제한으로 볼 수 있어요<br />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
            ✓ 완전 무료 ✓ 카카오 3초 가입 ✓ 매일 AI 분석 리포트
          </span>
        </div>
        <Link href={`/login?redirect=/blog/${slug}`} style={{
          display: 'inline-block', padding: '12px 36px', borderRadius: 'var(--radius-pill)',
          background: '#FEE500', color: '#191919',
          fontWeight: 700, fontSize: 'var(--fs-md)', textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(254,229,0,0.3)',
        }}>
          카카오로 무료 가입
        </Link>
      </div>
    </div>
  );
}

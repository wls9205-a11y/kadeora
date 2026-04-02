'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

const MAX_FREE_READS = 3;
const STORAGE_KEY = 'kd_blog_reads';

/**
 * 블로그 읽기 제한 게이트
 * - 비로그인 시 3편까지 전체, 4편째부터 본문 잘림
 * - 로그인 시 무제한
 * - 봇은 서버에서 이미 전체 본문 받음 (이 컴포넌트 안 탐)
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
  const [isGated, setIsGated] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (userId) return; // 로그인 → 제한 없음

    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const today = new Date().toISOString().slice(0, 10);

      // 일별 리셋 (하루 3편)
      if (stored.date !== today) {
        stored.date = today;
        stored.slugs = [];
      }

      const slugs: string[] = stored.slugs || [];

      // 이미 본 글이면 카운트 안 늘림
      if (!slugs.includes(slug)) {
        slugs.push(slug);
        stored.slugs = slugs;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      }

      setReadCount(slugs.length);
      setIsGated(slugs.length > MAX_FREE_READS);
    } catch {
      // localStorage 오류 시 제한 없음
    }
  }, [userId, slug]);

  // SSR/첫 렌더: 전체 보여주기 (hydration mismatch 방지 + SEO)
  if (!mounted) {
    return <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlFull }} />;
  }

  // 로그인 또는 3편 이내 → 전체 본문
  if (userId || !isGated) {
    return <div className="blog-content" itemProp="articleBody" dangerouslySetInnerHTML={{ __html: htmlFull }} />;
  }

  // 4편째부터 → 잘린 본문 + 게이트
  const ctaTexts: Record<string, string> = {
    stock: '종목 분석',
    apt: '청약 정보',
    unsold: '미분양 분석',
    finance: '재테크 정보',
  };
  const ctaLabel = ctaTexts[category] || '투자 정보';

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="blog-content"
        itemProp="articleBody"
        style={{ maxHeight: 'clamp(300px, 50vh, 600px)', overflow: 'hidden' }}
        dangerouslySetInnerHTML={{ __html: htmlTruncated }}
      />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
        background: 'linear-gradient(transparent, var(--bg-base))',
      }} />
      <div style={{
        textAlign: 'center', padding: '28px 20px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', marginTop: -12, position: 'relative',
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
          오늘 무료 {MAX_FREE_READS}편을 모두 읽었어요
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
          가입하면 모든 {ctaLabel}을 무제한으로 볼 수 있어요<br />
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
        <div style={{ marginTop: 12, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
          오늘 {readCount}편 읽음 · 내일 다시 {MAX_FREE_READS}편 무료
        </div>
      </div>
    </div>
  );
}

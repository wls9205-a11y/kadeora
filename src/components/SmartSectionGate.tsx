'use client';
/**
 * SmartSectionGate — 핵심 1개 섹션만 블러 처리
 *
 * 글 100% 공개하되, "향후 전망" / "투자 의견" 등 핵심 섹션만 블러
 * SSR: 전체 렌더 (봇 SEO 보호)
 * 클라이언트 비로그인: 해당 섹션만 블러 + CTA
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackConversion } from '@/lib/track-conversion';

const GATE_HEADINGS = [
  '향후 시세 전망', '향후 전망', '시세 전망', '투자 전망',
  '가점 커트라인', '커트라인 예측', '투자 의견', '목표가',
  'AI 분석', 'AI 투자 의견', '종합 평가', '투자 포인트',
];

interface SmartSectionGateProps {
  htmlContent: string;
  slug: string;
  category?: string;
}

export default function SmartSectionGate({ htmlContent, slug, category }: SmartSectionGateProps) {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // SSR 또는 로그인 → 전체 표시
  if (!mounted || loading || userId) {
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  }

  // 블러 대상 헤딩 찾기
  const headingPattern = GATE_HEADINGS.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(<h[23][^>]*>\\s*(?:[^<]*(?:${headingPattern})[^<]*)\\s*<\\/h[23]>)`, 'i');
  const match = htmlContent.match(regex);

  if (!match || !match.index) {
    // 블러 대상 섹션이 없으면 전체 그대로 표시
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  }

  const splitIndex = match.index;
  const beforeGate = htmlContent.slice(0, splitIndex);
  const gatedSection = htmlContent.slice(splitIndex);

  const ctaText = category === 'stock'
    ? '이 종목의 AI 분석과 목표가를 확인하세요'
    : category === 'apt' || category === 'unsold'
    ? '이 단지의 향후 시세 전망을 확인하세요'
    : '전문가 분석과 전망을 확인하세요';

  const ctaBenefits = category === 'stock'
    ? '1,846개 종목 AI 분석 · 실시간 토론 · 매일 브리핑'
    : category === 'apt' || category === 'unsold'
    ? '5,768개 현장 분석 · 입주비용 계산 · 가격 알림'
    : '투자 정보 · AI 분석 · 가입 즉시 100P';

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: beforeGate }} />
      <div style={{ position: 'relative', marginTop: 8 }}>
        <div style={{
          filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none',
          maxHeight: 180, overflow: 'hidden',
        }} dangerouslySetInnerHTML={{ __html: gatedSection }} />
        <div data-gate="content" style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 0%, var(--bg-base) 70%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
          paddingBottom: 20,
        }}>
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)',
            marginBottom: 4, textAlign: 'center',
          }}>{ctaText}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>{ctaBenefits}</div>
          <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{
            display: 'inline-block', padding: '10px 28px', borderRadius: 'var(--radius-pill)',
            background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
            fontWeight: 700, fontSize: 'var(--fs-sm)', textDecoration: 'none',
          }} onClick={() => trackConversion('cta_click', 'smart_gate', { category })}>카카오로 3초 가입 (무료)</Link>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
            스팸 없음 · 41명의 투자자가 함께하고 있어요
          </div>
        </div>
      </div>
    </>
  );
}

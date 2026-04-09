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
  '핵심 요약', '결론', '투자 전략', '매매 전략', '체크리스트',
  '비교 분석', '수익률 시뮬레이션', '실전 적용', '입주 전략',
  '절세 전략', '리스크 분석', '매수 타이밍', '적정 가격', '최종 판단',
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

  const VALUE_PROPS = category === 'stock'
    ? [
        { emoji: '🤖', title: 'AI 종목 분석', desc: '728개 종목 목표가·투자의견' },
        { emoji: '🔔', title: '실시간 알림', desc: '관심 종목 급등락 즉시 알림' },
        { emoji: '📊', title: '포트폴리오 시뮬레이터', desc: '나만의 포트폴리오 수익률 테스트' },
      ]
    : category === 'apt' || category === 'unsold'
    ? [
        { emoji: '🎯', title: '청약 가점 계산기', desc: '당첨 확률 자동 계산' },
        { emoji: '📈', title: '시세 전망 리포트', desc: '5,768개 현장 AI 분석' },
        { emoji: '🏠', title: '입주비용 계산', desc: '취득세·중도금·잔금 한번에' },
      ]
    : [
        { emoji: '🤖', title: 'AI 투자 분석', desc: '주식·부동산 맞춤 인사이트' },
        { emoji: '💰', title: '가입 즉시 100P', desc: '활동할수록 등급 UP' },
        { emoji: '📬', title: '주간 리포트', desc: '핵심 시장 동향 이메일 요약' },
      ];

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
          background: 'linear-gradient(to bottom, transparent 0%, var(--bg-base) 60%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
          paddingBottom: 16,
        }}>
          <div style={{
            fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--text-primary)',
            marginBottom: 4, textAlign: 'center',
          }}>{ctaText}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>가입하면 이 모든 기능을 무료로 이용할 수 있어요</div>

          {/* 가치 제안 카드 3개 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, width: '100%', maxWidth: 420, padding: '0 8px' }}>
            {VALUE_PROPS.map((vp, i) => (
              <div key={i} style={{
                flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{vp.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{vp.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{vp.desc}</div>
              </div>
            ))}
          </div>

          <Link href={`/login?redirect=${encodeURIComponent(pathname)}&source=smart_gate`} style={{
            display: 'inline-block', padding: '12px 36px', borderRadius: 'var(--radius-pill)',
            background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
            fontWeight: 800, fontSize: 'var(--fs-sm)', textDecoration: 'none',
          }} onClick={() => trackConversion('cta_click', 'smart_gate', { category })}>카카오로 3초 가입 (무료)</Link>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
            스팸 없음 · 광고 없음 · 가입 즉시 전체 열람
          </div>

          {/* 뉴스레터 대안 경로 */}
          <div style={{
            marginTop: 14, padding: '10px 16px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-hover)', width: '100%', maxWidth: 360, textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
              가입은 나중에 하고 싶다면?
            </div>
            <Link href="#newsletter" style={{
              fontSize: 12, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none',
            }} onClick={(e) => {
              e.preventDefault();
              const el = document.querySelector('[data-newsletter]');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
              trackConversion('cta_click', 'gate_newsletter_link', { category });
            }}>📩 주간 리포트만 이메일로 받기 →</Link>
          </div>
        </div>
      </div>
    </>
  );
}

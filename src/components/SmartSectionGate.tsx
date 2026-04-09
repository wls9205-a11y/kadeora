'use client';
/**
 * SmartSectionGate v2 — 콘텐츠 게이트 (SEO 안전)
 *
 * 1순위: "향후 전망" 등 핵심 헤딩 매칭 → 해당 섹션부터 블러
 * 2순위: 매칭 실패 시 글자수 기반 70% 지점에서 끊기
 * SSR: 전체 렌더 (봇 SEO 보호)
 * 클라이언트 비로그인: 블러 + CTA
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackCTA } from '@/lib/analytics';

const GATE_HEADINGS = [
  '향후 시세 전망', '향후 전망', '시세 전망', '투자 전망',
  '가점 커트라인', '커트라인 예측', '투자 의견', '목표가',
  'AI 분석', 'AI 투자 의견', '종합 평가', '투자 포인트',
  '핵심 요약', '결론', '투자 전략', '매매 전략', '체크리스트',
  '비교 분석', '수익률 시뮬레이션', '실전 적용', '입주 전략',
  '절세 전략', '리스크 분석', '매수 타이밍', '적정 가격', '최종 판단',
];

const CUT_RATIO: Record<string, number> = { stock: 0.65, apt: 0.70, unsold: 0.75, finance: 0.80 };

const VALUE_PROPS: Record<string, { emoji: string; title: string; desc: string }[]> = {
  stock: [
    { emoji: '🤖', title: 'AI 종목 분석', desc: '728개 종목 투자의견' },
    { emoji: '🔔', title: '실시간 알림', desc: '급등락 즉시 알림' },
    { emoji: '📊', title: '포트폴리오', desc: '수익률 시뮬레이터' },
  ],
  apt: [
    { emoji: '🎯', title: '가점 계산기', desc: '당첨 확률 자동 계산' },
    { emoji: '📈', title: '시세 전망', desc: 'AI 분석 리포트' },
    { emoji: '🏠', title: '입주비용 계산', desc: '취득세·중도금 한번에' },
  ],
  default: [
    { emoji: '🤖', title: 'AI 분석', desc: '맞춤 투자 인사이트' },
    { emoji: '💰', title: '가입 즉시 100P', desc: '활동할수록 등급 UP' },
    { emoji: '📬', title: '무제한 열람', desc: '18,000+ 분석 무료' },
  ],
};

interface Props {
  htmlContent: string;
  slug: string;
  category?: string;
}

export default function SmartSectionGate({ htmlContent, slug, category }: Props) {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // SSR 또는 로그인 → 전체 표시
  if (!mounted || loading || userId) {
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  }

  // 1순위: 핵심 헤딩 매칭
  const headingPattern = GATE_HEADINGS.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(<h[23][^>]*>\\s*(?:[^<]*(?:${headingPattern})[^<]*)\\s*<\\/h[23]>)`, 'i');
  const match = htmlContent.match(regex);

  let beforeGate: string;
  let gatedSection: string;

  if (match?.index) {
    beforeGate = htmlContent.slice(0, match.index);
    gatedSection = htmlContent.slice(match.index);
  } else {
    // 2순위: 글자수 기반 끊기
    const ratio = CUT_RATIO[category || ''] ?? 0.70;
    const cutPoint = Math.floor(htmlContent.length * ratio);
    const nearestBreak = htmlContent.lastIndexOf('<h', cutPoint);
    const splitAt = nearestBreak > cutPoint * 0.5 ? nearestBreak : cutPoint;

    if (splitAt < 800 || htmlContent.length < 1500) {
      return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    }
    beforeGate = htmlContent.slice(0, splitAt);
    gatedSection = htmlContent.slice(splitAt);
  }

  const ctaText = category === 'stock'
    ? '이 종목의 AI 분석과 목표가를 확인하세요'
    : category === 'apt' || category === 'unsold'
    ? '이 단지의 향후 시세 전망을 확인하세요'
    : '전문가 분석과 전망을 확인하세요';

  const vp = VALUE_PROPS[category === 'unsold' ? 'apt' : category || ''] || VALUE_PROPS.default;
  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=content_gate`;

  // 게이트 노출 추적 (1회만)
  useEffect(() => { trackCTA('view', 'content_gate', { category }); }, [category]);

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: beforeGate }} />
      <div style={{ position: 'relative', marginTop: 8 }}>
        <div style={{
          filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none',
          maxHeight: 200, overflow: 'hidden',
        }} dangerouslySetInnerHTML={{ __html: gatedSection }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 0%, var(--bg-base) 50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
          paddingBottom: 16,
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, textAlign: 'center' }}>
            🔒 {ctaText}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            카카오 가입하면 전체 분석을 무료로 볼 수 있어요
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, width: '100%', maxWidth: 380, padding: '0 8px' }}>
            {vp.map((v, i) => (
              <div key={i} style={{
                flex: 1, padding: '10px 6px', borderRadius: 10,
                background: 'var(--bg-surface)', border: '1px solid var(--border)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, marginBottom: 3 }}>{v.emoji}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 1 }}>{v.title}</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{v.desc}</div>
              </div>
            ))}
          </div>
          <Link href={loginUrl}
            onClick={() => trackCTA('click', 'content_gate', { category })}
            style={{
              display: 'inline-block', padding: '12px 36px', borderRadius: 30,
              background: '#FEE500', color: '#191919', fontWeight: 800, fontSize: 14, textDecoration: 'none',
            }}>카카오로 3초 만에 열기</Link>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
            가입 즉시 전체 열람 · 스팸 없음
          </div>
        </div>
      </div>
    </>
  );
}

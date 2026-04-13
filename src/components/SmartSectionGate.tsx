'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { trackCTA } from '@/lib/analytics';

interface Props {
  htmlContent: string;
  slug: string;
  category: string;
  userCount?: number;
  todaySignups?: number;
  aptName?: string;
}

/* 카테고리별 혜택 메시지 — 구체적 행동 가치 중심 */
const CATEGORY_BENEFITS: Record<string, { headline: string; bullets: string[]; btnText: string }> = {
  apt: {
    headline: '이 글의 나머지 분석 + 가격 변동 알림을',
    bullets: ['실거래가 변동 알림 (무료)', '청약 마감 D-1 알림', '전체 분석 이어 읽기'],
    btnText: '카카오로 무료 가입',
  },
  unsold: {
    headline: '미분양 현황 전체 데이터 + 알림을',
    bullets: ['미분양 해소 알림 (무료)', '단지 가격 변동 추적', '전체 분석 이어 읽기'],
    btnText: '카카오로 무료 가입',
  },
  stock: {
    headline: '종목 AI 분석 전체 + 가격 알림을',
    bullets: ['목표가 도달 알림 (무료)', '급등/급락 알림 설정', 'AI 분석 전체 보기'],
    btnText: '카카오로 무료 가입',
  },
  finance: {
    headline: '절세 전략 전체 + 주간 리포트를',
    bullets: ['세법 변경 알림 (무료)', '맞춤 절세 팁 뉴스레터', '핵심 전략 이어 읽기'],
    btnText: '카카오로 무료 가입',
  },
};

const DEFAULT_BENEFIT = {
  headline: '전체 분석 + 맞춤 알림을',
  bullets: ['청약·시세 변동 알림 (무료)', '주간 시황 리포트', '전체 내용 이어 읽기'],
  btnText: '카카오로 무료 가입',
};

export default function SmartSectionGate({
  htmlContent, slug, category, userCount = 80, todaySignups = 0
}: Props) {
  const pathname = usePathname();
  const [shouldGate, setShouldGate] = useState(false);

  useEffect(() => { setShouldGate(true); }, [slug]);
  useEffect(() => { if (shouldGate) trackCTA('view', 'content_gate'); }, [shouldGate, category]);

  if (!shouldGate) return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;

  /* cut point — 68%로 늦춤 (더 많이 읽히게, 이미 충분히 engagement된 후 gate) */
  const cutPoint = Math.floor(htmlContent.length * 0.68);
  const headingAfterCut = htmlContent.slice(cutPoint).match(/<h[23][^>]*>/i);
  const actualCut = headingAfterCut?.index ? cutPoint + headingAfterCut.index : cutPoint;
  const visibleSection = htmlContent.slice(0, actualCut);

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=apt_alert_cta`;
  const benefit = CATEGORY_BENEFITS[category] || DEFAULT_BENEFIT;

  /* 소셜프루프 텍스트 */
  const socialText = todaySignups > 0
    ? `오늘 ${todaySignups}명 가입 · 총 ${userCount.toLocaleString()}명 이용 중`
    : `${userCount.toLocaleString()}명이 무료로 이용 중`;

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: visibleSection }} />

      {/* 페이드아웃 */}
      <div style={{
        height: 100, pointerEvents: 'none', marginTop: -40,
        background: 'linear-gradient(to bottom, rgba(5,10,24,0) 0%, rgba(5,10,24,1) 100%)',
      }} />

      {/* 게이트 카드 */}
      <div style={{ background: 'var(--bg-base, #050A18)', padding: '0 16px 32px' }}>
        <div style={{
          maxWidth: 400, width: '100%', margin: '0 auto',
          padding: '22px 20px', borderRadius: 16, boxSizing: 'border-box' as const,
          border: '1px solid rgba(254,229,0,0.2)',
          background: 'rgba(12,21,40,0.97)',
        }}>
          {/* 헤드라인 */}
          <p style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.5, margin: '0 0 12px', textAlign: 'center' }}>
            {benefit.headline}<br />
            <span style={{ color: '#FEE500' }}>무료로 받을 수 있어요</span>
          </p>

          {/* 혜택 3줄 */}
          <div style={{ marginBottom: 16 }}>
            {benefit.bullets.map((b, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: 'rgba(224,232,240,0.75)',
                padding: '4px 0',
              }}>
                <span style={{ color: '#22c55e', fontSize: 13 }}>✓</span>
                {b}
              </div>
            ))}
          </div>

          {/* 메인 CTA 버튼 */}
          <a
            href={loginUrl}
            onClick={() => trackCTA('click', 'content_gate')}
            style={{
              display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#FEE500', color: '#191919', borderRadius: 8,
              padding: '13px 0', fontSize: 15, fontWeight: 800, textDecoration: 'none',
              boxSizing: 'border-box' as const,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 512 512" fill="#191919">
              <path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z" />
            </svg>
            {benefit.btnText}
          </a>

          {/* 소셜프루프 + 이메일 대안 */}
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(224,232,240,0.3)', marginBottom: 4 }}>
              {socialText}
            </div>
            <a
              href={`/login?redirect=${encodeURIComponent(pathname)}&source=content_gate_email`}
              style={{ fontSize: 11, color: 'rgba(224,232,240,0.35)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
            >
              이메일로 가입
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { trackConversion } from '@/lib/track-conversion';

/**
 * InlineCTA — 콘텐츠 하단 인라인 가입 유도
 * 
 * 1PV에서 즉시 보임 (GuestNudge와 달리 PV 제한 없음)
 * 페이지 타입별 맞춤 메시지 (blog/apt/stock)
 * trackConversion으로 노출/클릭 추적
 */
export default function InlineCTA({ category = 'general', contextName }: { category?: string; contextName?: string }) {
  const { userId } = useAuth();
  const tracked = useRef(false);

  useEffect(() => {
    if (userId || tracked.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !tracked.current) {
        tracked.current = true;
        trackConversion('cta_view', 'inline_cta', { category });
      }
    }, { threshold: 0.5 });
    const el = document.getElementById('kd-inline-cta');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [userId, category]);

  if (userId) return null;

  const messages: Record<string, { title: string; desc: string; benefits: string[] }> = {
    stock: {
      title: '이 분석이 도움이 되셨나요?',
      desc: '카더라에서 1,846개 종목의 AI 분석을 무료로 받아보세요.',
      benefits: ['실시간 종목 토론 참여', 'AI 투자 브리핑 매일 발송', '관심종목 가격 알림'],
    },
    apt: {
      title: '이 현장 정보가 유용했나요?',
      desc: '5,768개 현장의 분양가·입주비용 분석을 무료로 확인하세요.',
      benefits: ['실입주 비용 시뮬레이터', '청약 가점 계산기', '관심단지 변동 알림'],
    },
    general: {
      title: '카더라 커뮤니티에 참여하세요',
      desc: '41명의 투자자가 함께 정보를 나누고 있어요.',
      benefits: ['주식·부동산 실시간 토론', '매일 AI 시장 브리핑', '가입 즉시 100P 지급'],
    },
  };
  const m = messages[category] || messages.general;
  const redirect = typeof window !== 'undefined' ? window.location.pathname : '/';

  return (
    <div id="kd-inline-cta" style={{
      margin: '24px 0', padding: '20px', borderRadius: 'var(--radius-card)',
      background: 'var(--bg-surface)', border: '1px solid var(--brand, #3B7BF6)30',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
        {contextName ? `${contextName} — ${m.title}` : m.title}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>{m.desc}</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {m.benefits.map(b => (
          <span key={b} style={{ fontSize: 12, color: 'var(--accent-green, #2EE8A5)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            {b}
          </span>
        ))}
      </div>
      <Link
        href={`/login?redirect=${encodeURIComponent(redirect)}`}
        onClick={() => trackConversion('cta_click', 'inline_cta', { category })}
        style={{
          display: 'inline-block', padding: '10px 32px', borderRadius: 'var(--radius-card)',
          background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
          fontWeight: 700, fontSize: 'var(--fs-base)', textDecoration: 'none',
        }}
      >
        카카오로 3초 가입
      </Link>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
        스팸 없음 · 가입 즉시 100P 지급 · 41명의 투자자가 함께하고 있어요
      </div>
    </div>
  );
}

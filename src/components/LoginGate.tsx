'use client';
/**
 * LoginGate — 로그인 전용 콘텐츠 블러 + CTA
 * 
 * SEO 안전: SSR(!mounted) → children 전체 렌더 (봇이 읽음)
 * 클라이언트: 로그인 → 전체, 비로그인 → 블러 + CTA 오버레이
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useRef, useState, ReactNode } from 'react';
import { trackConversion } from '@/lib/track-conversion';

interface LoginGateProps {
  children: ReactNode;
  feature: string;
  title?: string;
  description?: string;
  blurHeight?: number;
}

const DEFAULTS: Record<string, { title: string; desc: string }> = {
  ai_analysis: { title: 'AI 투자 분석', desc: '이 종목의 AI 전망과 투자 의견을 확인하세요' },
  comparison: { title: '맞춤 비교 분석', desc: '관심 종목/단지와 비슷한 항목을 한눈에 비교' },
  price_alert: { title: '가격 변동 알림', desc: '급등/급락, 청약 마감 등 놓치고 싶지 않은 알림' },
  apt_analysis: { title: '단지 종합 분석', desc: '이 단지의 시세 전망과 투자 분석을 확인하세요' },
};

export default function LoginGate({ children, feature, title, description, blurHeight = 200 }: LoginGateProps) {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const tracked = useRef(false);
  const [mounted, setMounted] = useState(false);
  const d = DEFAULTS[feature] || DEFAULTS.ai_analysis;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!tracked.current && mounted && !userId && !loading) {
      tracked.current = true;
      trackConversion('cta_view', `login_gate_${feature}`, { pagePath: pathname });
    }
  }, [userId, loading, feature, pathname, mounted]);

  // SSR 또는 로딩 중 또는 로그인 → children 전체 표시
  if (!mounted || loading || userId) {
    return <>{children}</>;
  }

  // 클라이언트 비로그인 → 블러 + CTA
  const url = `/login?redirect=${encodeURIComponent(pathname)}&source=login_gate_${feature}`;

  return (
    <div style={{ position: 'relative', margin: '16px 0' }}>
      <div style={{
        maxHeight: blurHeight, overflow: 'hidden',
        filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.5,
      }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, transparent 0%, var(--bg-base) 75%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, textAlign: 'center' }}>
          🔒 {title || d.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>
          {description || d.desc}
        </div>
        <Link href={url}
          onClick={() => trackConversion('cta_click', `login_gate_${feature}`, { pagePath: pathname })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 24px', borderRadius: 20,
            background: '#FEE500', color: '#191919',
            fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#191919"><path d="M12 3C6.5 3 2 6.58 2 11c0 2.83 1.88 5.31 4.7 6.71l-.97 3.59c-.07.26.2.47.42.33L10.2 18.7c.58.08 1.19.13 1.8.13 5.5 0 10-3.58 10-8S17.5 3 12 3z"/></svg>
          카카오 3초 가입
        </Link>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
          스팸 없음 · 가입 즉시 전체 분석 열람
        </div>
      </div>
    </div>
  );
}

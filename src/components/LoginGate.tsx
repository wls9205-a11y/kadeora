'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useRef, ReactNode } from 'react';
import { trackConversion } from '@/lib/track-conversion';

interface LoginGateProps {
  children: ReactNode;
  feature: string; // 'ai_analysis' | 'comparison' | 'price_alert'
  title?: string;
  description?: string;
}

const DEFAULTS: Record<string, { title: string; desc: string }> = {
  ai_analysis: { title: 'AI 투자 분석', desc: '이 종목의 AI 전망과 투자 의견을 확인하세요' },
  comparison: { title: '맞춤 비교 분석', desc: '관심 종목/단지와 비슷한 항목을 한눈에 비교' },
  price_alert: { title: '가격 변동 알림', desc: '급등/급락, 청약 마감 등 놓치고 싶지 않은 알림' },
};

export default function LoginGate({ children, feature, title, description }: LoginGateProps) {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const tracked = useRef(false);
  const d = DEFAULTS[feature] || DEFAULTS.ai_analysis;

  useEffect(() => {
    if (!tracked.current && !userId && !loading) {
      tracked.current = true;
      trackConversion('cta_view', `login_gate_${feature}`, { pagePath: pathname });
    }
  }, [userId, loading, feature, pathname]);

  if (loading) return null;
  if (userId) return <>{children}</>;

  const url = `/login?redirect=${encodeURIComponent(pathname)}&source=login_gate_${feature}`;

  return (
    <div style={{ position: 'relative', margin: '16px 0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', opacity: 0.4, maxHeight: 200, overflow: 'hidden' }}>
        {children}
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(5,10,24,0.7)', backdropFilter: 'blur(4px)',
        borderRadius: 12, padding: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          🔒 {title || d.title}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 14, lineHeight: 1.5 }}>
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
      </div>
    </div>
  );
}
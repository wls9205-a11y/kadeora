'use client';
import { useAuth } from '@/components/AuthProvider';
import { trackCTA } from '@/lib/analytics';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function KakaoHeroCTA() {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [stats, setStats] = useState({ totalViews: 690000, dailyVisitors: 1300 });

  useEffect(() => {
    const cached = sessionStorage.getItem('kd_social_proof');
    if (cached) { try { setStats(JSON.parse(cached)); } catch {} return; }
    fetch('/api/stats/social-proof')
      .then(r => r.json())
      .then(d => { setStats(d); sessionStorage.setItem('kd_social_proof', JSON.stringify(d)); })
      .catch(() => {});
  }, []);

  // view 추적 — 비로그인 유저에게 노출 시
  useEffect(() => {
    if (!loading && !userId) {
      trackCTA('view', 'kakao_hero', { page_path: pathname });
    }
  }, [loading, userId, pathname]);

  if (loading || userId) return null;

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=kakao_hero`;

  return (
    <div style={{
      maxWidth: 440, width: '100%', margin: '0 auto', padding: '0 16px',
    }}>
      <div style={{
        background: '#050A18', borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        position: 'relative', padding: '28px 24px 24px',
      }}>
        {/* 글로우 */}
        <div style={{
          position: 'absolute', top: -50, left: '50%', transform: 'translateX(-50%)',
          width: 280, height: 180, pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(254,229,0,0.06) 0%, rgba(59,123,246,0.08) 40%, transparent 70%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* 라이브 배지 */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(52,211,153,0.12)', color: '#34D399',
            fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 'var(--radius-lg)',
            marginBottom: 14,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#34D399',
              animation: 'kdPulse 2s infinite',
            }} />
            누적 {Math.floor(stats.totalViews / 10000)}만+ 열람
          </div>

          {/* 타이틀 */}
          <h2 style={{
            fontSize: 22, fontWeight: 800, color: '#F0F4F8',
            lineHeight: 1.35, letterSpacing: '-0.03em', marginBottom: 8,
          }}>
            3초 가입으로<br />
            <span style={{ color: '#FEE500' }}>부동산·주식 인사이트</span><br />
            무료로 받아보세요
          </h2>

          {/* 설명 */}
          <p style={{
            fontSize: 13, color: 'rgba(224,232,240,0.45)', lineHeight: 1.6,
            marginBottom: 18,
          }}>
            매일 업데이트되는 청약 일정, 실거래가 분석, AI 종목 브리핑을
            카카오 계정 하나로 바로 시작하세요.
          </p>

          {/* 데이터 지표 */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            marginBottom: 18,
          }}>
            {[
              { n: '5,500+', l: '분양 데이터' },
              { n: '728', l: '종목 분석' },
              { n: '19,000+', l: '블로그 콘텐츠' },
            ].map(s => (
              <div key={s.l} style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)',
                padding: '10px 8px', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#F0F4F8', letterSpacing: '-0.02em' }}>{s.n}</div>
                <div style={{ fontSize: 10, color: 'rgba(224,232,240,0.3)', marginTop: 2, fontWeight: 500 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* 카카오 버튼 */}
          <a
            href={loginUrl}
            onClick={() => trackCTA('click', 'kakao_hero')}
            style={{
              display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: '#FEE500', color: '#191919', borderRadius: 'var(--radius-card)',
              padding: '14px 0', fontSize: 15, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 0 24px rgba(254,229,0,0.15)',
              transition: 'transform 0.15s',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 512 512" fill="#191919"><path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z" /></svg>
            카카오로 3초 만에 시작하기
          </a>

          {/* 이메일 대안 */}
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'rgba(224,232,240,0.2)' }}>
            또는 <a href={loginUrl} style={{ color: 'rgba(224,232,240,0.4)', textDecoration: 'underline', textUnderlineOffset: 2 }}>이메일로 가입</a>
          </div>

          {/* 신뢰 배지 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
            marginTop: 14, paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            fontSize: 10, color: 'rgba(224,232,240,0.22)',
          }}>
            <span>개인정보 안전</span>
            <span>가입 즉시 이용</span>
            <span>100% 무료</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes kdPulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

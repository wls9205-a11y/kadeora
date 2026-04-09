'use client';
/**
 * ActionBar — 페이지별 맞춤 행동 유도 하단 고정바
 * 
 * 기존 StickyBar("3초 가입") 대체.
 * "가입하세요"가 아니라 유저가 하고 싶은 행동을 제시.
 * 클릭 → 바텀시트에서 가입 유도.
 * 
 * SEO: 클라이언트 전용 (SSR에 영향 없음)
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackCTA } from '@/lib/analytics';

interface ActionConfig {
  icon: string;
  text: string;
  action: string;    // bookmark, alert, watchlist, comment
  loginMsg: string;   // 바텀시트 메시지
  benefits: string[];
}

function getAction(path: string): ActionConfig | null {
  if (path.startsWith('/blog/')) return {
    icon: '📌', text: '이 분석 저장하기', action: 'bookmark',
    loginMsg: '분석 글을 저장하고 나중에 다시 볼 수 있어요',
    benefits: ['18,000+ 분석 무제한 열람', 'AI 투자 의견 무료', '관심 종목/단지 알림'],
  };
  if (path.startsWith('/apt/') && path !== '/apt' && !path.includes('/diagnose') && !path.includes('/map') && !path.includes('/complex') && !path.includes('/search') && !path.includes('/data') && !path.includes('/region')) return {
    icon: '🔔', text: '이 단지 알림 받기', action: 'alert',
    loginMsg: '이 단지의 가격 변동·청약 소식을 알림으로 받아보세요',
    benefits: ['가격 변동 즉시 알림', '청약 일정 D-day 알림', 'AI 시세 전망 리포트'],
  };
  if (path.startsWith('/stock/') && path !== '/stock') return {
    icon: '⭐', text: '관심 종목 추가', action: 'watchlist',
    loginMsg: '관심 종목에 추가하고 시세 변동 알림을 받아보세요',
    benefits: ['실시간 급등락 알림', 'AI 종목 분석 무료', '포트폴리오 시뮬레이터'],
  };
  if (path.startsWith('/feed')) return {
    icon: '💬', text: '댓글 달기', action: 'comment',
    loginMsg: '토론에 참여하고 다른 투자자와 의견을 나눠보세요',
    benefits: ['실시간 토론 참여', '커뮤니티 포인트 적립', '전문가 의견 열람'],
  };
  return null;
}

const EXCLUDED = ['/', '/login', '/auth', '/onboarding', '/admin', '/terms', '/privacy', '/apt', '/stock', '/blog', '/calc', '/apt/map', '/apt/complex', '/apt/data', '/apt/diagnose', '/apt/search', '/discuss'];

export default function ActionBar() {
  const [visible, setVisible] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { userId, loading } = useAuth();
  const pathname = usePathname();

  // 페이지 변경 시 리셋 (다른 페이지에서는 다시 보여주기)
  useEffect(() => {
    setVisible(false);
    setDismissed(false);
    setShowSheet(false);
  }, [pathname]);

  useEffect(() => {
    if (loading || userId) return;
    if (EXCLUDED.includes(pathname)) return;
    const timer = setTimeout(() => {
      setVisible(true);
      const cfg = getAction(pathname);
      if (cfg) trackCTA('view', `action_bar_${cfg.action}`);
    }, 3000);
    return () => clearTimeout(timer);
  }, [pathname, userId, loading]);

  if (!visible || dismissed || loading || userId) return null;
  const cfg = getAction(pathname);
  if (!cfg) return null;

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=action_bar&action=${cfg.action}`;

  return (
    <>
      {/* 하단 고정바 */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        left: 0, right: 0, zIndex: 88,
        background: 'linear-gradient(135deg, rgba(12,21,40,0.97), rgba(5,10,24,0.98))',
        borderTop: '1px solid rgba(59,123,246,0.15)',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        animation: 'slideUp .3s ease-out',
        backdropFilter: 'blur(16px)',
      }}>
        <span style={{ fontSize: 18 }}>{cfg.icon}</span>
        <button onClick={() => { setShowSheet(true); trackCTA('click', `action_bar_${cfg.action}`); }}
          style={{
            flex: 1, padding: '8px 0', background: 'none', border: 'none',
            color: 'var(--text-primary)', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', textAlign: 'left',
          }}>
          {cfg.text}
        </button>
        <button onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 16, cursor: 'pointer', padding: 4 }}
          aria-label="닫기">×</button>
      </div>

      {/* 바텀시트 */}
      {showSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setShowSheet(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'var(--bg-surface, #0F1A2E)', borderRadius: '20px 20px 0 0',
            padding: '28px 24px calc(24px + env(safe-area-inset-bottom, 0px))',
            animation: 'slideUp .25s ease-out',
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', margin: '0 auto 20px' }} />
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>
              {cfg.icon} {cfg.text}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              {cfg.loginMsg}
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {cfg.benefits.map((b, i) => (
                <div key={i} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10,
                  background: 'rgba(59,123,246,0.06)', border: '1px solid rgba(59,123,246,0.1)',
                  textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4,
                }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{['✓', '✓', '✓'][i]}</div>
                  {b}
                </div>
              ))}
            </div>
            <Link href={loginUrl} style={{
              display: 'block', width: '100%', padding: '14px 0', borderRadius: 12,
              background: '#FEE500', color: '#191919', fontWeight: 800, fontSize: 15,
              textDecoration: 'none', textAlign: 'center',
            }}>카카오로 3초 만에 시작</Link>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 12 }}>
              가입 즉시 이용 가능 · 스팸 없음 · 언제든 탈퇴
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </>
  );
}

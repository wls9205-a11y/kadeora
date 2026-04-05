'use client';
/**
 * ReturnVisitorBanner — 재방문자 전용 CTA
 *
 * visitor_id의 page_view 이력이 있는 재방문자에게만 표시
 * 첫 방문자에게는 절대 표시 안 함
 * 좀 더 적극적인 가치 제안 가능 (이미 신뢰 형성)
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackConversion } from '@/lib/track-conversion';

export default function ReturnVisitorBanner() {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (loading || userId) return;

    // 재방문 감지: 이전 세션에서 방문한 적 있는지 확인
    const visitHistory = localStorage.getItem('kd_visit_sessions');
    const now = Date.now();

    if (!visitHistory) {
      // 첫 방문 → 현재 세션 기록만 하고 표시 안 함
      localStorage.setItem('kd_visit_sessions', JSON.stringify([now]));
      return;
    }

    const sessions: number[] = JSON.parse(visitHistory);
    const lastSession = sessions[sessions.length - 1];

    // 마지막 세션이 1시간 이상 전이면 재방문으로 판정
    if (now - lastSession > 60 * 60 * 1000) {
      sessions.push(now);
      localStorage.setItem('kd_visit_sessions', JSON.stringify(sessions.slice(-10)));

      // 재방문 배너 쿨다운 체크 (24시간)
      const dismissed = localStorage.getItem('kd_return_dismissed');
      if (dismissed && now - Number(dismissed) < 24 * 60 * 60 * 1000) return;

      // 2회차 이상 재방문 시 배너 표시
      if (sessions.length >= 2) {
        setTimeout(() => { setShow(true); trackConversion('cta_view', 'return_banner'); }, 3000); // 3초 후 표시
      }
    } else {
      // 같은 세션 → 기록 업데이트만
      sessions[sessions.length - 1] = now;
      localStorage.setItem('kd_visit_sessions', JSON.stringify(sessions));
    }
  }, [loading, userId]);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
      left: 12, right: 12, maxWidth: 500, margin: '0 auto', zIndex: 88,
      background: 'var(--bg-surface)', border: '1px solid var(--brand-border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 18px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      animation: 'slideUp 0.3s ease-out',
    }}>
      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        다시 오셨네요!
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
        자주 보시는 정보를 맞춤 알림으로 편하게 받아보세요
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} style={{
          flex: 1, textAlign: 'center', padding: '10px 0',
          borderRadius: 'var(--radius-card)',
          background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
          fontWeight: 700, fontSize: 13, textDecoration: 'none',
        }}>카카오로 무료 시작</Link>
        <button onClick={() => {
          setShow(false);
          localStorage.setItem('kd_return_dismissed', String(Date.now()));
        }} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-tertiary)', fontSize: 18, padding: 4, lineHeight: 1,
        }}>✕</button>
      </div>
    </div>
  );
}

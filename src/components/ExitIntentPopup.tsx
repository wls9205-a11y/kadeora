'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { trackConversion } from '@/lib/track-conversion';
import { useConversion } from '@/lib/conversion-orchestrator';

/**
 * Exit Intent 팝업 — 이탈 직전 마지막 전환 기회
 * - 데스크탑: 마우스가 브라우저 상단으로 이동 시
 * - 모바일: 뒤로가기(popstate) 시
 * - 세션당 1회, 닫으면 24시간 쿨다운
 * - ConversionOrchestrator 연동: 다른 CTA 2개 이미 표시 중이면 억제
 */
export default function ExitIntentPopup() {
  const [show, setShow] = useState(false);
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const { canShow, onDismiss } = useConversion('exit_intent', 2);

  useEffect(() => {
    if (typeof window === 'undefined' || loading || userId) return;

    // 쿨다운 체크
    const dismissed = localStorage.getItem('kd_exit_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 24 * 3600000) return;
    if (sessionStorage.getItem('kd_exit_shown')) return;

    // 제외 경로
    if (['/login', '/auth', '/onboarding', '/admin'].some(p => pathname.startsWith(p))) return;

    // 최소 10초 체류 후에만 트리거
    let ready = false;
    const readyTimer = setTimeout(() => { ready = true; }, 10000);

    // 데스크탑: mouseleave on document
    const handleMouseLeave = (e: MouseEvent) => {
      if (!ready || e.clientY > 10) return;
      sessionStorage.setItem('kd_exit_shown', '1');
      setShow(true);
    };

    // 모바일: history back 감지
    const handlePopState = () => {
      if (!ready) return;
      sessionStorage.setItem('kd_exit_shown', '1');
      setShow(true);
      // 뒤로가기 취소 (현재 페이지 유지)
      window.history.pushState(null, '', window.location.href);
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      clearTimeout(readyTimer);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pathname, userId, loading]);

  if (!show || !canShow) return null;

  const url = `/login?redirect=${encodeURIComponent(pathname)}`;
  const isApt = pathname.startsWith('/apt');
  const isStock = pathname.startsWith('/stock');
  const title = isApt ? '이 단지 청약 알림 받으시겠어요?' : isStock ? '이 종목 급등 알림 받으시겠어요?' : '이 정보를 저장하시겠어요?';
  const desc = isApt ? '가입하면 청약 마감 알림, 분양가 비교, 관심단지 추적을 무료로 이용할 수 있어요.' : isStock ? '가입하면 종목 알림, AI 분석, 실시간 토론을 무료로 이용할 수 있어요.' : '가입하면 관심 콘텐츠 저장, 알림, 댓글 기능을 무료로 이용할 수 있어요.';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 85, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', padding: '28px 24px', maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>{isApt ? '🏠' : isStock ? '📈' : '💾'}</div>
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 18 }}>{desc}</div>
        <Link href={url} onClick={() => { localStorage.setItem('kd_exit_dismissed', String(Date.now())); }} style={{ display: 'block', padding: '12px 0', borderRadius: 'var(--radius-card)', background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)', fontWeight: 700, fontSize: 'var(--fs-md)', textDecoration: 'none', marginBottom: 8 }}>카카오로 3초 가입</Link>
        <button onClick={() => { setShow(false); onDismiss(); localStorage.setItem('kd_exit_dismissed', String(Date.now())); }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', cursor: 'pointer', padding: '6px 0' }}>괜찮아요</button>
      </div>
    </div>
  );
}

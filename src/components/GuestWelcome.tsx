'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { isTossMode } from '@/lib/toss-mode';

/**
 * 비로그인 유저 통합 환영 배너
 * - 쿠키 동의 + 웹앱 설치 + 회원가입을 하나의 카드로
 * - "시작하기" 한 번이면: 쿠키 동의 + PWA 설치 프롬프트 + 로그인 페이지 이동
 * - 이미 로그인/동의/설치 완료된 상태면 안 보임
 */
export default function GuestWelcome() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [_isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 토스 미니앱 모드에서는 설치/가입 유도 금지
    if (isTossMode()) return;

    // 이미 PWA로 실행 중이면 안 보여줌
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // 이미 닫은 적 있으면 24시간 숨김
    const dismissed = localStorage.getItem('kd-welcome-dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 24 * 60 * 60 * 1000) return;

    // 쿠키 동의 이미 했으면 안 보여줌 (개별 배너들이 처리)
    const consent = localStorage.getItem('kd_cookie_consent');
    if (consent === 'accepted' || consent === 'declined') return;

    // 로그인 확인
    createSupabaseBrowser().auth.getUser().then(({ data }) => {
      if (data.user) return; // 로그인됨 → 안 보여줌

      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

      // 글로벌 캡처된 프롬프트 확인
      if ((window as any).__pwaPrompt) {
        setDeferredPrompt((window as any).__pwaPrompt);
      }

      // 새로 발생할 수도 있으므로 리스너도 등록
      const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
      window.addEventListener('beforeinstallprompt', handler);

      setTimeout(() => setShow(true), 2500);

      return () => window.removeEventListener('beforeinstallprompt', handler);
    });
  }, []);

  const handleStart = async () => {
    // 1. 쿠키 자동 동의
    localStorage.setItem('kd_cookie_consent', 'accepted');

    // 2. PWA 설치 시도 (Android/Chrome)
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
      } catch {}
    }

    // 3. 로그인 페이지로 이동
    window.location.href = '/login';
  };

  const handleDismiss = () => {
    // 쿠키 동의만 처리하고 닫기
    localStorage.setItem('kd_cookie_consent', 'accepted');
    localStorage.setItem('kd-welcome-dismissed', String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
      background: 'linear-gradient(to top, var(--bg-surface) 90%, transparent)',
      padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{
        maxWidth: 480, margin: '0 auto',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '24px 20px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
        animation: 'guestSlideUp 0.4s ease',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            카더라에 오신 걸 환영해요!
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            주식 · 부동산 · 청약 정보를 실시간으로
          </div>
        </div>

        {/* 혜택 3개 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
          {[
            { emoji: '🔔', text: '실시간 알림' },
            { emoji: '⚡', text: '앱처럼 빠름' },
            { emoji: '📊', text: '무료 데이터' },
          ].map(b => (
            <div key={b.text} style={{
              flex: 1, textAlign: 'center', padding: '10px 6px',
              background: 'var(--bg-hover)', borderRadius: 10,
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{b.emoji}</div>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>{b.text}</div>
            </div>
          ))}
        </div>

        {/* 메인 버튼 */}
        <button
          onClick={handleStart}
          style={{
            width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
            background: 'var(--brand)', color: 'white',
            fontSize: 'var(--fs-base)', fontWeight: 800, cursor: 'pointer',
            marginBottom: 10,
            boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
          }}
        >
          카카오로 3초 가입 →
        </button>

        {/* 둘러보기 */}
        <button
          onClick={handleDismiss}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
            background: 'transparent', color: 'var(--text-tertiary)',
            fontSize: 'var(--fs-sm)', cursor: 'pointer',
          }}
        >
          먼저 둘러볼게요
        </button>

        <div style={{
          marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)',
          textAlign: 'center', lineHeight: 1.5,
        }}>
          계속 이용 시 <Link href="/privacy" style={{ color: 'var(--brand)' }}>개인정보처리방침</Link> 및 쿠키 사용에 동의합니다
        </div>
      </div>

      <style>{`
        @keyframes guestSlideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

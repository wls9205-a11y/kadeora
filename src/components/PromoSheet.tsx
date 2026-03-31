'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isTossMode } from '@/lib/toss-mode';
import { useAuth } from '@/components/AuthProvider';

/**
 * 프로모 바텀시트 (전 페이지 공통)
 * 
 * V1: 비로그인 → 회원가입 유도 (카카오 3초 가입 + 혜택 3가지)
 * V2: 로그인+미설치 → PWA 홈화면 설치 유도
 * 
 * 우선순위: 비로그인→V1, 로그인+미설치→V2, 로그인+설치→없음
 * "오늘 하루 보지않기" / "다시 보지않기" localStorage 기반
 */
export default function PromoSheet() {
  const [variant, setVariant] = useState<'v1' | 'v2' | null>(null);
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { userId, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading) return;
    if (isTossMode()) return;

    // PWA standalone이면 설치 완료 → 안 보여줌
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // 제외 경로
    if (['/login', '/auth', '/onboarding', '/admin', '/terms', '/privacy'].some(p => pathname.startsWith(p))) return;

    // V1: 비로그인 유저
    if (!userId) {
      const dismissedV1 = localStorage.getItem('kd_promo_v1');
      if (dismissedV1) {
        // "오늘 하루 보지않기" 체크
        const dismissDate = new Date(Number(dismissedV1));
        const now = new Date();
        if (dismissDate.toDateString() === now.toDateString()) return;
        // 날짜 바뀌면 다시 표시
      }
      const timer = setTimeout(() => {
        setVariant('v1');
        setVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // V2: 로그인 + 미설치 유저
    const neverShow = localStorage.getItem('kd_promo_v2_never');
    if (neverShow) return;

    // 이미 설치 기록이 있으면 안 보여줌
    const installed = localStorage.getItem('kd_pwa_installed');
    if (installed) return;

    // beforeinstallprompt 이벤트 확인
    if ((window as any).__pwaPrompt) {
      setDeferredPrompt((window as any).__pwaPrompt);
    }
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);

    const timer = setTimeout(() => {
      setVariant('v2');
      setVisible(true);
    }, 5000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [loading, userId, pathname]);

  const [showGuide, setShowGuide] = useState(false);

  const handleSignup = () => {
    localStorage.setItem('kd_cookie_consent', 'accepted');
    window.location.href = `/login?redirect=${encodeURIComponent(pathname)}`;
  };

  const handleInstall = async () => {
    // 클릭 시점에 다시 확인 (다른 컴포넌트가 소비했을 수 있음)
    const prompt = deferredPrompt || (window as any).__pwaPrompt;
    if (prompt) {
      try {
        prompt.prompt();
        const result = await prompt.userChoice;
        if (result.outcome === 'accepted') {
          localStorage.setItem('kd_pwa_installed', '1');
        }
        setDeferredPrompt(null);
        (window as any).__pwaPrompt = null;
        setVisible(false);
      } catch { /* silent */ }
    } else {
      // prompt 미지원 → 인라인 가이드 표시 (닫지 않음)
      setShowGuide(true);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  const handleDismissToday = () => {
    if (variant === 'v1') {
      localStorage.setItem('kd_promo_v1', String(Date.now()));
    }
    setVisible(false);
  };

  const handleNeverShow = () => {
    if (variant === 'v2') {
      localStorage.setItem('kd_promo_v2_never', '1');
    }
    setVisible(false);
  };

  if (!visible || !variant) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90,
      animation: 'promoFadeIn 0.2s ease',
    }}>
      {/* Dim overlay */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }}
        onClick={handleDismiss}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: '#0b1628',
        borderRadius: '20px 20px 0 0',
        padding: '20px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
        color: '#fff',
        maxWidth: 520,
        marginLeft: 'auto', marginRight: 'auto',
        animation: 'promoSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />

        {variant === 'v1' ? <V1Content onSignup={handleSignup} onDismiss={handleDismissToday} /> : <V2Content onInstall={handleInstall} onDismiss={handleDismiss} deferredPrompt={deferredPrompt} showGuide={showGuide} />}

        {/* Dismiss row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <label
            onClick={variant === 'v1' ? handleDismissToday : handleNeverShow}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
          >
            <div style={{ width: 15, height: 15, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 3 }} />
            {variant === 'v1' ? '오늘 하루 보지않기' : '다시 보지않기'}
          </label>
          <span
            onClick={handleDismiss}
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
          >닫기</span>
        </div>
      </div>

      <style>{`
        @keyframes promoFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes promoSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

/* ═══════════ V1: 회원가입 유도 ═══════════ */
function V1Content({ onSignup, onDismiss }: { onSignup: () => void; onDismiss: () => void }) {
  return (
    <>
      {/* Logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--sp-lg)' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 'var(--radius-card)',
          background: 'linear-gradient(135deg, #0F1B3E, #2563EB)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="26" height="26" viewBox="0 0 72 72">
            <circle cx="18" cy="36" r="6" fill="#fff" />
            <circle cx="36" cy="36" r="6" fill="#fff" />
            <circle cx="54" cy="36" r="6" fill="#fff" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800 }}>카더라에 오신 걸 환영합니다</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>대한민국 소리소문 정보 커뮤니티</div>
        </div>
      </div>

      {/* Feature pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-lg)', flexWrap: 'wrap' }}>
        {[
          { label: '실시간 주식 시세', color: '#93c5fd', bg: 'rgba(96,165,250,0.12)' },
          { label: '청약 알림', color: '#6ee7b7', bg: 'rgba(52,211,153,0.12)' },
          { label: 'HOT 토론', color: '#fcd34d', bg: 'rgba(251,191,36,0.12)' },
        ].map(p => (
          <span key={p.label} style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 'var(--radius-xl)', fontWeight: 600,
            background: p.bg, color: p.color,
          }}>{p.label}</span>
        ))}
      </div>

      {/* Benefits */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)', marginBottom: 18 }}>
        {[
          { icon: '🔔', title: '맞춤 푸시 알림', desc: '관심 종목 급등락, 청약 마감 D-day 알림', bg: 'rgba(96,165,250,0.12)' },
          { icon: '💰', title: '매일 출석 포인트', desc: '출석만 해도 포인트 적립, 상점에서 사용', bg: 'rgba(52,211,153,0.12)' },
          { icon: '💬', title: '커뮤니티 참여', desc: '글쓰기, 토론, 주식 관심목록 저장', bg: 'rgba(251,191,36,0.12)' },
        ].map(b => (
          <div key={b.title} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 12px', borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
              background: b.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, flexShrink: 0,
            }}>{b.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{b.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{b.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button onClick={onSignup} style={{
        display: 'block', width: '100%', border: 'none', borderRadius: 'var(--radius-card)',
        padding: '15px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
        textAlign: 'center', color: '#fff', background: '#2563eb',
      }}>
        카카오로 3초 가입
      </button>

      {/* Sub CTA */}
      <button onClick={() => {
        localStorage.setItem('kd_cookie_consent', 'accepted');
        onDismiss();
      }} style={{
        display: 'block', width: '100%', border: 'none', borderRadius: 'var(--radius-md)',
        padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        textAlign: 'center', color: 'rgba(255,255,255,0.7)',
        background: 'rgba(255,255,255,0.06)', marginTop: 'var(--sp-sm)',
      }}>둘러보기</button>
    </>
  );
}

/* ═══════════ V2: PWA 설치 유도 ═══════════ */
function V2Content({ onInstall, onDismiss, deferredPrompt, showGuide }: { onInstall: () => void; onDismiss: () => void; deferredPrompt: any; showGuide: boolean }) {
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSamsung = typeof navigator !== 'undefined' && /SamsungBrowser/.test(navigator.userAgent);
  const hasPrompt = !!(deferredPrompt || (typeof window !== 'undefined' && (window as any).__pwaPrompt));

  return (
    <>
      {/* Center icon */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-xl)' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, #0F1B3E, #2563EB)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
        }}>
          <svg width="34" height="34" viewBox="0 0 72 72">
            <circle cx="18" cy="36" r="6" fill="#fff" />
            <circle cx="36" cy="36" r="6" fill="#fff" />
            <circle cx="54" cy="36" r="6" fill="#fff" />
          </svg>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 'var(--sp-xs)' }}>홈 화면에 카더라 추가</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>앱처럼 빠른 실행, 실시간 푸시 알림</div>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'flex', gap: 'var(--sp-sm)', marginBottom: 18 }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-card)', padding: '14px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-lg)', marginBottom: 6 }}>📱</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>앱 다운로드 불필요</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>설치 없이 바로 추가</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-card)', padding: '14px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--fs-lg)', marginBottom: 6 }}>🔔</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>실시간 푸시 알림</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>청약/주식 알림 즉시</div>
        </div>
      </div>

      {/* 가이드 표시 (prompt 없을 때 버튼 클릭 후 또는 iOS/Samsung) */}
      {(showGuide || isIOS || isSamsung) && (
        <div style={{
          background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)',
          borderRadius: 'var(--radius-md)', padding: 'var(--sp-md) var(--card-p)', marginBottom: 14,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', marginBottom: 10 }}>
            {isIOS ? 'iOS 설치 방법' : isSamsung ? '삼성 인터넷 설치 방법' : 'Chrome 설치 방법'}
          </div>
          {isIOS ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
              <Step n={1} text={'하단 공유 버튼 (↑) 탭'} />
              <Step n={2} text={'"홈 화면에 추가" 선택'} />
              <Step n={3} text={'"추가" 버튼 탭 — 완료!'} />
            </div>
          ) : isSamsung ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
              <Step n={1} text={'우측 하단 메뉴 (≡) 탭'} />
              <Step n={2} text={'"페이지를 다음에 추가" > "홈 화면"'} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
              <Step n={1} text={'주소창 오른쪽 설치 아이콘 (⊕) 클릭'} />
              <Step n={2} text={'"설치" 버튼 클릭 — 완료!'} />
            </div>
          )}
        </div>
      )}

      {/* CTA — prompt 있으면 직접 설치, 없으면 가이드 표시 */}
      {!showGuide && !isIOS && !isSamsung && (
        <button onClick={onInstall} style={{
          display: 'block', width: '100%', border: 'none', borderRadius: 'var(--radius-card)',
          padding: '15px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
          textAlign: 'center', color: '#fff', background: '#2563eb',
        }}>
          {hasPrompt ? '홈 화면에 추가하기' : '설치 방법 보기'}
        </button>
      )}

      {/* Sub CTA */}
      <button onClick={onDismiss} style={{
        display: 'block', width: '100%', border: 'none', borderRadius: 'var(--radius-md)',
        padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        textAlign: 'center', color: 'rgba(255,255,255,0.7)',
        background: 'rgba(255,255,255,0.06)', marginTop: 'var(--sp-sm)',
      }}>나중에 하기</button>
    </>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
      <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(96,165,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#60a5fa', fontWeight: 700, flexShrink: 0 }}>{n}</span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{text}</span>
    </div>
  );
}

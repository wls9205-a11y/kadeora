'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { isTossMode } from '@/lib/toss-mode';

/**
 * SignupNudge — 비로그인 가입 유도 팝업 2종
 *
 * 1. 웰컴 팝업: 첫 방문 시 즉시 표시 (24시간 쿨다운)
 * 2. 탐색 팝업: 서로 다른 URL 5개 이상 방문 시 (세션당 1회, 24시간 쿨다운)
 *
 * GuestNudge(일차 기반)와 병행 — 같은 세션에 중복 안 됨
 */

const LS = {
  welcomeDismissed: 'kd_signup_welcome',
  exploreDismissed: 'kd_signup_explore',
  visitedPages: 'kd_signup_visited',
  exploreShown: 'kd_signup_explore_shown',
} as const;

export default function SignupNudge() {
  const [popup, setPopup] = useState<'welcome' | 'explore' | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const { userId, loading } = useAuth();
  const pathname = usePathname();

  // 팝업 닫기
  const dismiss = useCallback((type: 'welcome' | 'explore') => {
    const key = type === 'welcome' ? LS.welcomeDismissed : LS.exploreDismissed;
    localStorage.setItem(key, String(Date.now() + 6 * 3600000));
    setPopup(null);
  }, []);

  // 페이지 방문 추적 + 팝업 트리거
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading) return;
    if (userId) return; // 로그인 유저 → 표시 안 함
    if (isTossMode()) return;

    // 제외 경로
    const excludes = ['/login', '/auth', '/onboarding', '/admin', '/terms', '/privacy', '/signup'];
    if (excludes.some(p => pathname.startsWith(p))) return;

    const now = Date.now();

    // 웰컴 팝업 — 첫 방문 체크
    const welcomeUntil = Number(localStorage.getItem(LS.welcomeDismissed) || '0');
    const visitedRaw = localStorage.getItem(LS.visitedPages);
    const visited: string[] = visitedRaw ? JSON.parse(visitedRaw) : [];

    if (visited.length === 0 && welcomeUntil < now) {
      // 첫 방문 → 1.5초 후 웰컴 팝업
      const basePath = pathname.split('?')[0];
      const updated = [basePath];
      localStorage.setItem(LS.visitedPages, JSON.stringify(updated));
      setPageCount(1);

      const timer = setTimeout(() => setPopup('welcome'), 1500);
      return () => clearTimeout(timer);
    }

    // 방문 페이지 기록
    const basePath = pathname.split('?')[0];
    if (!visited.includes(basePath)) {
      const updated = [...visited, basePath];
      localStorage.setItem(LS.visitedPages, JSON.stringify(updated));
      setPageCount(updated.length);

      // 5페이지 탐색 팝업 — 서로 다른 URL 5개 이상
      const exploreUntil = Number(localStorage.getItem(LS.exploreDismissed) || '0');
      const exploreShown = localStorage.getItem(LS.exploreShown);
      if (updated.length >= 5 && exploreUntil < now && !exploreShown) {
        localStorage.setItem(LS.exploreShown, 'true');
        const timer = setTimeout(() => setPopup('explore'), 800);
        return () => clearTimeout(timer);
      }
    } else {
      setPageCount(visited.length);
    }
  }, [pathname, userId, loading]);

  if (!popup) return null;

  if (popup === 'welcome') {
    return <WelcomePopup onClose={() => dismiss('welcome')} />;
  }

  return <ExplorePopup pageCount={pageCount} onClose={() => dismiss('explore')} />;
}

// ═══════════ 1. 첫 방문 웰컴 팝업 ═══════════
function WelcomePopup({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        {/* 상단 비주얼 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,123,246,0.08) 0%, rgba(139,92,246,0.06) 100%)',
          padding: '28px 24px 20px', textAlign: 'center',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏘</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: -0.5 }}>
            카더라에 오신 걸 환영해요!
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            주식 · 부동산 · 청약 정보를 한곳에서
          </div>
        </div>

        {/* 혜택 */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { icon: '📈', title: '실시간 주식 시세', desc: '주요 종목 시세 · 차트 · AI 분석' },
              { icon: '🏢', title: '청약·분양 알림', desc: '마감 D-day 알림 · 가점 계산기' },
              { icon: '📊', title: '매일 투자 리포트', desc: '데일리 브리핑 · 섹터 동향 · 환율' },
            ].map(item => (
              <div key={item.title} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 12,
                background: 'rgba(59,123,246,0.06)', border: '1px solid rgba(59,123,246,0.08)',
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} onClick={onClose} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
            background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
            fontSize: 16, fontWeight: 800, textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(254,229,0,0.25)',
          }}>
            💬 카카오로 3초 가입
          </Link>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, marginBottom: 4 }}>
            <button onClick={onClose} style={dismissBtn}>먼저 둘러볼게요</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════ 2. 5페이지 탐색 팝업 ═══════════
function ExplorePopup({ pageCount, onClose }: { pageCount: number; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        {/* 상단 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(59,123,246,0.05) 100%)',
          padding: '24px 24px 18px', textAlign: 'center',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 44, marginBottom: 6 }}>👀</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: -0.5 }}>
            벌써 {pageCount}페이지나 둘러보셨네요!
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            관심 있는 정보가 많으신가 봐요
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* KPI */}
          <div style={{
            display: 'flex', gap: 6, marginBottom: 16,
            padding: '12px 14px', borderRadius: 12,
            background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)',
          }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#10B981' }}>{pageCount}</div>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>둘러본 페이지</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#FBBF24' }}>FREE</div>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>가입비</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--brand)' }}>3초</div>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>가입 시간</div>
            </div>
          </div>

          {/* 추가 기능 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>가입하면 이런 것도 할 수 있어요</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 6, marginBottom: 18 }}>
            {[
              { icon: '🔔', label: '주가 알림 설정' },
              { icon: '💬', label: '커뮤니티 글쓰기' },
              { icon: '📌', label: '관심 종목 저장' },
              { icon: '💰', label: '포인트 적립' },
            ].map(f => (
              <div key={f.label} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 12px', borderRadius: 10,
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 16 }}>{f.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</span>
              </div>
            ))}
          </div>

          <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} onClick={onClose} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
            background: 'var(--kakao-bg, #FEE500)', color: 'var(--kakao-text, #191919)',
            fontSize: 16, fontWeight: 800, textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(254,229,0,0.25)',
          }}>
            💬 무료 회원가입
          </Link>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, marginBottom: 4 }}>
            <button onClick={onClose} style={dismissBtn}>오늘 하루 안 보기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 공통 스타일 ──
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9998,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.6)', padding: 16,
  animation: 'kd-fade-in 0.3s ease',
};

const modalBox: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderRadius: 20, maxWidth: 380, width: '100%',
  overflow: 'hidden',
  boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
  border: '1px solid var(--border)',
  animation: 'kd-slide-up 0.35s cubic-bezier(0.16,1,0.3,1)',
};

const dismissBtn: React.CSSProperties = {
  background: 'none', border: 'none',
  color: 'var(--text-tertiary)', fontSize: 12,
  cursor: 'pointer', padding: '4px 8px',
};

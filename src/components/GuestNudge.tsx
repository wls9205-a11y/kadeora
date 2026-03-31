'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { isTossMode } from '@/lib/toss-mode';

/**
 * 통합 GuestNudge — 단계적 회원가입 유도
 * 
 * 이전 4개 컴포넌트 통합: GuestGate + GuestCTA + PromoSheet v1
 * 
 * 방문 1~4회: 없음 (신뢰 구축)
 * 방문 5~7회: 토스트 (5초 자동 소멸)
 * 방문 8~10회: 하단 배너 (닫기 → 3일 쿨다운)
 * 방문 11회~: 소프트 모달 (닫기 → 24시간 쿨다운)
 * 
 * SEO 보호: 블로그/부동산/주식 상세 → 토스트만 허용
 * 크롤러: 서버사이드 렌더링이므로 이 컴포넌트 자체가 클라이언트 전용 → 영향 없음
 */

type NudgeType = 'none' | 'toast' | 'banner' | 'modal';

const STORAGE = {
  pageViews: 'kd_nudge_pv',
  bannerDismissed: 'kd_nudge_banner_d',
  modalDismissed: 'kd_nudge_modal_d',
  lifetimeModals: 'kd_nudge_modal_n',
} as const;

// SEO 보호 대상: 상세 페이지에서는 모달/배너 금지
function isDetailPage(path: string): boolean {
  return /^\/(blog|apt|stock)\/[^/]+/.test(path);
}

// 넛지 완전 제외 경로
function isExcludedPage(path: string): boolean {
  return ['/', '/login', '/auth', '/onboarding', '/terms', '/privacy', '/admin', '/signup'].some(p => 
    path === p || path.startsWith(p + '/')
  );
}

function getNudgeType(pageViews: number, isDetail: boolean): NudgeType {
  if (pageViews < 5) return 'none';
  if (pageViews <= 7) return 'toast';
  if (pageViews <= 10) return isDetail ? 'toast' : 'banner';
  return isDetail ? 'toast' : 'modal';
}

export default function GuestNudge() {
  const [nudge, setNudge] = useState<NudgeType>('none');
  const [visible, setVisible] = useState(false);
  const { userId, loading } = useAuth();
  const pathname = usePathname();

  const dismiss = useCallback((type: 'banner' | 'modal') => {
    setVisible(false);
    if (type === 'banner') {
      localStorage.setItem(STORAGE.bannerDismissed, String(Date.now()));
    } else {
      localStorage.setItem(STORAGE.modalDismissed, String(Date.now()));
      const n = parseInt(localStorage.getItem(STORAGE.lifetimeModals) || '0') + 1;
      localStorage.setItem(STORAGE.lifetimeModals, String(n));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading) return;
    if (userId) return; // 로그인 유저 → 넛지 없음
    if (isTossMode()) return; // 토스 모드 → 별도 퍼널

    const path = pathname;
    if (isExcludedPage(path)) return;

    // 방문 카운터 (페이지 전환마다 +1)
    const pv = parseInt(localStorage.getItem(STORAGE.pageViews) || '0') + 1;
    localStorage.setItem(STORAGE.pageViews, String(pv));

    const isDetail = isDetailPage(path);
    const type = getNudgeType(pv, isDetail);

    if (type === 'none') return;

    // 쿨다운 체크
    if (type === 'banner') {
      const d = localStorage.getItem(STORAGE.bannerDismissed);
      if (d && Date.now() - Number(d) < 3 * 24 * 3600000) return; // 3일
    }
    if (type === 'modal') {
      const d = localStorage.getItem(STORAGE.modalDismissed);
      if (d && Date.now() - Number(d) < 24 * 3600000) return; // 24시간
      // 평생 20회 캡
      const n = parseInt(localStorage.getItem(STORAGE.lifetimeModals) || '0');
      if (n >= 20) return;
    }

    // 토스트: 즉시 + 5초 자동 소멸
    if (type === 'toast') {
      const timer = setTimeout(() => {
        setNudge('toast');
        setVisible(true);
        setTimeout(() => setVisible(false), 5000);
      }, 2000); // 페이지 로드 2초 후
      return () => clearTimeout(timer);
    }

    // 배너/모달: 3초 후 표시
    const timer = setTimeout(() => {
      setNudge(type);
      setVisible(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [pathname, userId, loading]);

  if (!visible || nudge === 'none') return null;

  const redirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`;

  // ── 토스트 (5초 자동 소멸) ──
  if (nudge === 'toast') {
    return (
      <div style={{
        position: 'fixed', bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
        left: '50%', transform: 'translateX(-50%)', zIndex: 90,
        background: 'var(--bg-elevated, #1e293b)', color: 'var(--text-primary, #fff)',
        padding: '10px 20px', borderRadius: 'var(--radius-card)',
        fontSize: 'var(--fs-sm)', fontWeight: 600,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
        animation: 'fadeInUp .3s ease-out',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span>무료 가입하면 댓글·알림 OK</span>
        <Link href={redirectUrl} style={{
          background: 'var(--brand)', color: '#fff', padding: '4px 12px',
          borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 700,
          textDecoration: 'none',
        }}>가입</Link>
      </div>
    );
  }

  // ── 하단 배너 ──
  if (nudge === 'banner') {
    return (
      <div style={{
        position: 'fixed', bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        left: 0, right: 0, zIndex: 95, padding: '0 12px',
      }}>
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--brand-border, rgba(59,123,246,0.3))',
          borderRadius: 'var(--radius-card)', padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              1,700+ 종목 알림 · 청약 마감 알림
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              카카오로 3초 무료 가입
            </div>
          </div>
          <Link href={redirectUrl} style={{
            background: 'var(--brand)', color: '#fff', padding: '7px 16px',
            borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}>가입</Link>
          <button onClick={() => dismiss('banner')} style={{
            background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
            fontSize: 16, cursor: 'pointer', padding: 2, lineHeight: 1,
          }} aria-label="닫기">×</button>
        </div>
      </div>
    );
  }

  // ── 소프트 모달 (콘텐츠 뒤에 보임) ──
  if (nudge === 'modal') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 80,
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)',
          padding: '32px 28px', maxWidth: 380, width: '100%', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 'var(--sp-md)' }}>📊</div>
          <div style={{
            fontSize: 'var(--fs-lg)', fontWeight: 800,
            color: 'var(--text-primary)', marginBottom: 'var(--sp-sm)',
          }}>
            더 많은 투자 정보를 받아보세요
          </div>
          <div style={{
            fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
            lineHeight: 1.6, marginBottom: 'var(--sp-xl)',
          }}>
            주식 시세 알림 · 청약 마감 알림 · 실시간 토론<br />
            무료로 모든 기능을 이용할 수 있어요
          </div>
          <Link href={redirectUrl} style={{
            display: 'block', padding: '13px 0',
            borderRadius: 'var(--radius-card)',
            background: 'var(--kakao-bg, #FEE500)',
            color: 'var(--kakao-text, #191919)',
            fontWeight: 700, fontSize: 'var(--fs-md)',
            textDecoration: 'none', marginBottom: 10,
          }}>
            카카오로 3초 가입
          </Link>
          <button onClick={() => dismiss('modal')} style={{
            background: 'none', border: 'none',
            color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)',
            cursor: 'pointer', padding: '8px 0',
          }}>
            나중에 할게요
          </button>
        </div>
      </div>
    );
  }

  return null;
}

'use client';
import { isTossMode } from '@/lib/toss-mode';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function GuestCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isTossMode()) return; // 토스 미니앱에서 숨김
    // 이미 닫은 경우 24시간 숨김
    const exp = localStorage.getItem('kd_guest_cta');
    if (exp && Date.now() < parseInt(exp)) return;

    // GuestWelcome이 아직 닫히지 않았으면 대기
    const consent = localStorage.getItem('kd_cookie_consent');
    if (consent !== 'accepted' && consent !== 'declined') return;

    // GuestWelcome 닫은 직후면 30초 유예
    const welcomeDismissed = localStorage.getItem('kd-welcome-dismissed');
    if (welcomeDismissed && Date.now() - Number(welcomeDismissed) < 30000) {
      const delay = 30000 - (Date.now() - Number(welcomeDismissed));
      const timer = setTimeout(() => checkAndShow(), delay);
      return () => clearTimeout(timer);
    }

    checkAndShow();

    function checkAndShow() {
      // InstallBanner가 활성 상태면 양보
      const installDismissed = localStorage.getItem('kd_install_dismissed');
      const isPWA = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
      const installBannerGone = isPWA || (installDismissed && Date.now() - Number(installDismissed) < 7 * 24 * 60 * 60 * 1000);

      createSupabaseBrowser().auth.getUser().then(({ data }) => {
        if (!data.user) {
          if (!installBannerGone) {
            setTimeout(() => setShow(true), 8000);
          } else {
            setShow(true);
          }
        }
      });
    }
  }, []);

  if (!show) return null;
  return (
    <div style={{ position: 'fixed', bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, zIndex: 100, padding: '0 12px' }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--brand-border)', borderRadius: 12,
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>댓글·좋아요·알림 받기 <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>3초 가입</span></div>
        </div>
        <Link href="/login" style={{
          background: 'var(--brand)', color: '#fff', padding: '6px 14px', borderRadius: 8,
          fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
        }}>가입</Link>
        <button onClick={() => { setShow(false); localStorage.setItem('kd_guest_cta', String(Date.now() + 24 * 60 * 60 * 1000)); }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 16, cursor: 'pointer', padding: 2, lineHeight: 1 }} aria-label="닫기">×</button>
      </div>
    </div>
  );
}

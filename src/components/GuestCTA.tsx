'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

export default function GuestCTA() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 이미 닫은 경우 24시간 숨김
    const exp = localStorage.getItem('kd_guest_cta');
    if (exp && Date.now() < parseInt(exp)) return;
    // 쿠키 동의 아직 안 했으면 대기
    const consent = localStorage.getItem('kd_cookie_consent');
    if (consent !== 'accepted' && consent !== 'declined') return;
    // 설치 배너가 이미 표시 중이면 양보
    const installDismissed = localStorage.getItem('kd_install_dismissed');
    const isPWA = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
    const installBannerGone = isPWA || (installDismissed && Date.now() - Number(installDismissed) < 7 * 24 * 60 * 60 * 1000);

    createSupabaseBrowser().auth.getUser().then(({ data }) => {
      if (!data.user) {
        // InstallBanner가 아직 활성 상태면 3초 뒤에 표시 (InstallBanner가 먼저)
        if (!installBannerGone) {
          setTimeout(() => setShow(true), 5000);
        } else {
          setShow(true);
        }
      }
    });
  }, []);

  if (!show) return null;
  return (
    <div style={{ position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, zIndex: 100, padding: '0 16px' }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--brand)', borderRadius: 16,
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>댓글·좋아요·알림 받기</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>3초면 가입 완료!</div>
        </div>
        <Link href="/login" style={{
          background: 'var(--brand)', color: 'var(--text-inverse)', padding: '7px 14px', borderRadius: 10,
          fontSize: 'var(--fs-sm)', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
        }}>가입</Link>
        <button onClick={() => { setShow(false); localStorage.setItem('kd_guest_cta', String(Date.now() + 24 * 60 * 60 * 1000)); }}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 'var(--fs-base)', cursor: 'pointer', padding: 4 }} aria-label="닫기">×</button>
      </div>
    </div>
  );
}

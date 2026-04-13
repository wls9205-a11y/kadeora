'use client';
import { useState, useEffect } from 'react';

/**
 * WelcomeToast — 신규 가입 직후 ?welcome=1 파라미터 감지 → 토스트 표시
 * 3초 후 자동 사라짐. URL에서 welcome 파라미터 제거.
 */
export default function WelcomeToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') !== '1') return;

    setShow(true);

    // URL에서 welcome 파라미터 제거 (히스토리 교체)
    params.delete('welcome');
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);

    const timer = setTimeout(() => setShow(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 999, padding: '12px 20px', borderRadius: 12,
      background: 'rgba(16,185,129,0.95)', color: '#fff',
      fontSize: 14, fontWeight: 700, textAlign: 'center',
      boxShadow: '0 8px 32px rgba(16,185,129,0.3)',
      animation: 'kdToastIn .4s ease-out',
      maxWidth: 'calc(100vw - 32px)',
    }}>
      🎉 가입 완료! 전체 분석이 해제됐어요
      <style>{`@keyframes kdToastIn{from{transform:translateX(-50%) translateY(-20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}`}</style>
    </div>
  );
}

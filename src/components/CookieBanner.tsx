'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('kd_cookie_consent');
    if (consent !== 'accepted' && consent !== 'declined') {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleConsent = (value: 'accepted' | 'declined') => {
    localStorage.setItem('kd_cookie_consent', value);
    setVisible(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', margin: 0 }}>
        카더라는 서비스 개선을 위해 쿠키를 사용합니다.{' '}
        <Link href="/privacy" style={{ fontSize: 'var(--fs-sm)', color: 'var(--brand)' }}>
          개인정보처리방침
        </Link>
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => handleConsent('accepted')}
          style={{
            background: 'var(--brand)',
            color: 'var(--text-inverse)',
            padding: '6px 16px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 'var(--fs-sm)',
          }}
        >
          동의
        </button>
        <button
          onClick={() => handleConsent('declined')}
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontSize: 'var(--fs-sm)',
          }}
        >
          거부
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface GuestGateProps {
  children: React.ReactNode;
  isLoggedIn: boolean;
}

const COOKIE_NAME = 'kd_pv';
const MAX_FREE_VIEWS = 5;
const COOKIE_MAX_AGE = 7 * 86400; // 7 days in seconds

function isCrawler(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /googlebot|bingbot|yandex|baidu/i.test(navigator.userAgent)
  );
}

function readCookieCount(): number {
  const match = document.cookie
    .split(';')
    .find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
  if (!match) return 0;
  const val = parseInt(match.split('=')[1], 10);
  return isNaN(val) ? 0 : val;
}

function writeCookieCount(count: number): void {
  document.cookie = `${COOKIE_NAME}=${count};path=/;max-age=${COOKIE_MAX_AGE}`;
}

export function GuestGate({ children, isLoggedIn }: GuestGateProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showBlur, setShowBlur] = useState(false);

  // SSR guard
  useEffect(() => {
    setMounted(true);
  }, []);

  // Track page views on path change
  useEffect(() => {
    if (!mounted || isLoggedIn) return;
    if (isCrawler()) return;

    const count = readCookieCount();
    const next = count + 1;
    writeCookieCount(next);

    if (next > MAX_FREE_VIEWS) {
      setShowModal(true);
    }
  }, [pathname, mounted, isLoggedIn]);

  const handleClose = useCallback(() => {
    setShowModal(false);
    setShowBlur(true);
  }, []);

  // Logged-in users: no gate
  if (isLoggedIn) {
    return <>{children}</>;
  }

  // SSR: render children only
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* Blur overlay — stays after modal is dismissed, blocks interaction */}
      {showBlur && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              maxWidth: 400,
              width: '90%',
              margin: 'auto',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Logo */}
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: 'var(--brand)',
                textAlign: 'center',
              }}
            >
              카더라
            </div>

            {/* Message */}
            <p
              style={{
                fontSize: 16,
                color: 'var(--text-primary)',
                textAlign: 'center',
                lineHeight: 1.6,
                whiteSpace: 'pre-line',
                margin: 0,
              }}
            >
              {'카더라의 더 많은 정보를 보려면\n로그인이 필요합니다'}
            </p>

            {/* Login button */}
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname)}`}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px',
                borderRadius: 9999,
                backgroundColor: 'var(--brand)',
                color: 'var(--text-inverse)',
                fontWeight: 700,
                fontSize: 15,
                textAlign: 'center',
                textDecoration: 'none',
                border: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              로그인
            </Link>

            {/* Later button */}
            <button
              onClick={handleClose}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 9999,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              나중에
            </button>
          </div>
        </div>
      )}
    </>
  );
}

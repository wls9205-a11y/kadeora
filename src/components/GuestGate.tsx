'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface GuestGateProps {
  children: React.ReactNode;
  isLoggedIn: boolean;
}

const STORAGE_KEY = 'kd_guest_views';
const MAX_FREE_VIEWS = 5;

export function GuestGate({ children, isLoggedIn }: GuestGateProps) {
  const pathname = usePathname();
  const router = useRouter();
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

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const count = stored ? parseInt(stored, 10) : 0;
      const next = count + 1;
      localStorage.setItem(STORAGE_KEY, String(next));

      if (next > MAX_FREE_VIEWS) {
        setShowModal(true);
        setShowBlur(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, [pathname, mounted, isLoggedIn]);

  const handleClose = useCallback(() => {
    setShowModal(false);
    // blur overlay stays
  }, []);

  const handleLogin = useCallback(() => {
    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [router, pathname]);

  // Logged-in users: no gate at all
  if (isLoggedIn) {
    return <>{children}</>;
  }

  // SSR: render children only, no modal/blur
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <>
      {children}

      {/* Blur overlay — stays even after modal is closed */}
      {showBlur && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9998,
          }}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '40px 32px 32px',
              maxWidth: 380,
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              position: 'relative',
            }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              aria-label="닫기"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: 22,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ✕
            </button>

            {/* Logo */}
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: 'var(--brand)',
                marginBottom: 20,
                letterSpacing: '-0.02em',
              }}
            >
              카더라
            </div>

            {/* Message */}
            <p
              style={{
                color: 'var(--text-primary)',
                fontSize: 16,
                lineHeight: 1.6,
                marginBottom: 28,
                whiteSpace: 'pre-line',
              }}
            >
              {'카더라의 더 많은 정보를 보려면\n로그인이 필요합니다'}
            </p>

            {/* Login button */}
            <button
              onClick={handleLogin}
              style={{
                width: '100%',
                padding: '12px 0',
                background: 'var(--brand)',
                color: 'var(--text-inverse)',
                border: 'none',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              로그인
            </button>
          </div>
        </div>
      )}
    </>
  );
}

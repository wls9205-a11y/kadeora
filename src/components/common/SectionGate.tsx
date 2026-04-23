'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';

export type GateLevel = 'free' | 'login' | 'premium';

export function SectionGate({
  sectionKey,
  level,
  children,
  previewLines = 3,
  ctaName,
  ctaText,
  redirectPath,
  isLoggedIn,
  isPremium,
  isBot,
}: {
  sectionKey: string;
  level: GateLevel;
  children: React.ReactNode;
  previewLines?: number;
  ctaName: string;
  ctaText: string;
  redirectPath: string;
  isLoggedIn: boolean;
  isPremium: boolean;
  isBot: boolean;
}) {
  if (isBot) return <>{children}</>;
  if (level === 'free') return <>{children}</>;
  if (level === 'login' && isLoggedIn) return <>{children}</>;
  if (level === 'premium' && isPremium) return <>{children}</>;

  const isPremiumGate = level === 'premium';
  const previewHeight = Math.max(60, previewLines * 28);

  return (
    <GatedSection
      sectionKey={sectionKey}
      level={level}
      previewHeight={previewHeight}
      ctaName={ctaName}
      ctaText={ctaText}
      redirectPath={redirectPath}
      isPremiumGate={isPremiumGate}
    >
      {children}
    </GatedSection>
  );
}

function GatedSection({
  sectionKey,
  level,
  previewHeight,
  ctaName,
  ctaText,
  redirectPath,
  isPremiumGate,
  children,
}: {
  sectionKey: string;
  level: GateLevel;
  previewHeight: number;
  ctaName: string;
  ctaText: string;
  redirectPath: string;
  isPremiumGate: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const viewed = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || viewed.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || viewed.current) return;
        viewed.current = true;
        const body = JSON.stringify({
          event_type: 'cta_view',
          cta_name: ctaName,
          category: 'signup',
          page_path: typeof window !== 'undefined' ? window.location.pathname : '',
          gate_section: sectionKey,
        });
        try {
          if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            navigator.sendBeacon('/api/events/cta', new Blob([body], { type: 'application/json' }));
          } else {
            fetch('/api/events/cta', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
              keepalive: true,
            }).catch(() => {});
          }
        } catch {}
        obs.disconnect();
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ctaName, sectionKey]);

  const loginUrl =
    `/login?redirect=${encodeURIComponent(redirectPath)}&source=${ctaName}`;
  const premiumUrl = `/premium?from=${ctaName}`;
  const targetUrl = isPremiumGate ? premiumUrl : loginUrl;

  return (
    <section
      ref={ref}
      className="kadeora-paywall"
      data-gate-section={sectionKey}
      data-gate-level={level}
      style={{ margin: '24px 0' }}
    >
      <div
        style={{
          position: 'relative',
          maxHeight: previewHeight,
          overflow: 'hidden',
        }}
      >
        {children}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 'auto 0 0 0',
            height: 120,
            background:
              'linear-gradient(to top, var(--bg-base, #0b1220) 20%, rgba(11,18,32,0) 100%)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <div
        role="group"
        style={{
          marginTop: 12,
          padding: '18px 20px 16px',
          borderRadius: 14,
          background: isPremiumGate ? 'rgba(236,72,153,0.06)' : 'rgba(251,191,36,0.06)',
          border: `2px solid ${isPremiumGate ? '#EC4899' : '#FBBF24'}`,
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary, #94a3b8)',
            marginBottom: 6,
          }}
        >
          🔒 {isPremiumGate ? '프리미엄 회원 전용' : '로그인 후 전체 보기'}
        </div>
        <Link
          href={targetUrl}
          onClick={() => {
            try {
              const body = JSON.stringify({
                event_type: 'cta_click',
                cta_name: ctaName,
                category: 'signup',
                page_path:
                  typeof window !== 'undefined' ? window.location.pathname : '',
                gate_section: sectionKey,
              });
              if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                navigator.sendBeacon(
                  '/api/events/cta',
                  new Blob([body], { type: 'application/json' })
                );
              } else {
                fetch('/api/events/cta', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body,
                  keepalive: true,
                }).catch(() => {});
              }
            } catch {}
          }}
          style={{
            display: 'inline-block',
            background: isPremiumGate ? '#EC4899' : '#FEE500',
            color: isPremiumGate ? '#fff' : '#000',
            fontWeight: 800,
            fontSize: 15,
            padding: '12px 28px',
            borderRadius: 10,
            textDecoration: 'none',
            minWidth: 220,
            boxShadow: '0 6px 14px rgba(0,0,0,0.2)',
          }}
        >
          {ctaText}
        </Link>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary, #94a3b8)',
            marginTop: 10,
          }}
        >
          가입 즉시 100P 지급 · 언제든 해지 가능
        </div>
      </div>
    </section>
  );
}

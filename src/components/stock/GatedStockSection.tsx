'use client';

/**
 * GatedStockSection — 주식 페이지 섹션별 로그인/프리미엄 게이트.
 *
 * DB:
 *   get_stock_gate_config('symbol'|'compare'|'daily-report') 섹션 설정
 *   get_my_access_level() 현재 사용자 권한
 *
 * 첫 마운트 시 (1회) 두 RPC 를 호출해 window 전역 캐시에 저장 → 여러 섹션이 네트워크 중복 제거.
 * 로그인/프리미엄 자동 개방 (RPC 가 Toss 미연동 상태에서도 is_premium=true 반환).
 * view 이벤트는 IntersectionObserver (threshold 0.3) 로 cta_view 1회 발송.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { trackCtaClick } from '@/lib/cta-track';

interface GateRow {
  section_key: string;
  display_name: string | null;
  display_order: number | null;
  gate_level: 'free' | 'login' | 'premium';
  preview_lines: number | null;
  cta_name: string | null;
  cta_text: string | null;
}

interface AccessLevel {
  is_authenticated: boolean;
  is_premium: boolean;
  is_admin?: boolean;
  premium_system_active?: boolean;
}

interface CacheShape {
  access: AccessLevel;
  gates: Record<string, GateRow[]>;
  promise?: Promise<void>;
}

declare global {
  interface Window { __kdStockGateCache?: CacheShape }
}

async function ensureLoaded(pageType: string): Promise<CacheShape> {
  if (typeof window === 'undefined') {
    return { access: { is_authenticated: false, is_premium: false }, gates: {} };
  }
  const cache = (window.__kdStockGateCache ||= { access: { is_authenticated: false, is_premium: false }, gates: {} });
  if (cache.gates[pageType]) return cache;
  if (!cache.promise) {
    cache.promise = (async () => {
      const sb = createSupabaseBrowser();
      const [accessRes, cfgRes] = await Promise.all([
        (sb.rpc as any)('get_my_access_level'),
        (sb.rpc as any)('get_stock_gate_config', { p_page_type: pageType }),
      ]);
      if (accessRes?.data && typeof accessRes.data === 'object') {
        const a = accessRes.data as any;
        cache.access = {
          is_authenticated: !!a.is_authenticated,
          is_premium: !!a.is_premium,
          is_admin: !!a.is_admin,
          premium_system_active: !!a.premium_system_active,
        };
      }
      const rows: GateRow[] = Array.isArray(cfgRes?.data) ? cfgRes.data as GateRow[] : [];
      cache.gates[pageType] = rows;
    })();
  }
  try { await cache.promise; } catch { /* silent */ }
  cache.promise = undefined;
  if (!cache.gates[pageType]) cache.gates[pageType] = [];
  return cache;
}

interface Props {
  sectionKey: string;
  pageType?: 'symbol' | 'compare' | 'daily-report';
  children: React.ReactNode;
  /** 폴백 헤더 (preview 렌더 시 노출). gate.display_name 우선. */
  fallbackTitle?: string;
}

export default function GatedStockSection({ sectionKey, pageType = 'symbol', children, fallbackTitle }: Props) {
  const [gate, setGate] = useState<GateRow | null>(null);
  const [access, setAccess] = useState<AccessLevel>({ is_authenticated: false, is_premium: false });
  const [loaded, setLoaded] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const viewSent = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cache = await ensureLoaded(pageType);
      if (cancelled) return;
      setAccess(cache.access);
      const rows = cache.gates[pageType] || [];
      const found = rows.find((r) => r.section_key === sectionKey) || null;
      setGate(found);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [pageType, sectionKey]);

  const locked = useMemo(() => {
    if (!loaded || !gate) return false; // 초기/미설정 → 미잠금 (SSR 출력 유지)
    if (gate.gate_level === 'free') return false;
    if (gate.gate_level === 'login') return !access.is_authenticated;
    if (gate.gate_level === 'premium') return !access.is_premium;
    return false;
  }, [loaded, gate, access]);

  // cta_view 1회 발송 (locked 진입 시)
  useEffect(() => {
    if (!locked || !gate || !sectionRef.current || viewSent.current) return;
    const target = sectionRef.current;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || viewSent.current) return;
      viewSent.current = true;
      const body = JSON.stringify({
        event_type: 'cta_view',
        cta_name: gate.cta_name || `stock_gate_${sectionKey}`,
        category: 'signup',
        page_path: window.location.pathname,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/events/cta', new Blob([body], { type: 'application/json' }));
        } else {
          fetch('/api/events/cta', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
        }
      } catch { /* silent */ }
      io.disconnect();
    }, { threshold: 0.3 });
    io.observe(target);
    return () => io.disconnect();
  }, [locked, gate, sectionKey]);

  const handleClick = () => {
    const cta = gate?.cta_name || `stock_gate_${sectionKey}`;
    trackCtaClick({ cta_name: cta, category: 'signup', page_path: typeof window !== 'undefined' ? window.location.pathname : undefined });
    if (typeof window === 'undefined') return;
    const dest = gate?.gate_level === 'premium'
      ? `/premium?from=stock_gate&redirect=${encodeURIComponent(window.location.pathname)}`
      : `/login?redirect=${encodeURIComponent(window.location.pathname)}&source=${cta}`;
    window.location.href = dest;
  };

  if (!locked) return <>{children}</>;

  const isPremium = gate?.gate_level === 'premium';
  const previewPx = Math.max(40, Math.min(300, (gate?.preview_lines ?? 2) * 40));

  return (
    <section ref={sectionRef} style={{ margin: '20px 0' }}>
      {(gate?.display_name || fallbackTitle) && (
        <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px', color: 'var(--text-primary, #e5e7eb)' }}>
          {gate?.display_name || fallbackTitle}
        </h3>
      )}
      <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ maxHeight: previewPx, overflow: 'hidden', filter: 'blur(1px)', opacity: 0.55 }}>
          {children}
        </div>
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 'auto 0 0 0', height: 120,
            background: 'linear-gradient(to top, var(--bg-base, #0b1220) 20%, rgba(11,18,32,0) 100%)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 12,
          padding: '20px 20px 18px',
          borderRadius: 14,
          background: 'rgba(251,191,36,0.08)',
          border: `2px solid ${isPremium ? '#EC4899' : '#FBBF24'}`,
          textAlign: 'center',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-tertiary, #94a3b8)', marginBottom: 6 }}>
          🔒 {isPremium ? '프리미엄 회원 전용' : '로그인 후 전체 열람'}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: 'var(--text-primary, #e5e7eb)', wordBreak: 'keep-all' }}>
          {gate?.cta_text || '로그인하고 전체 정보 보기'}
        </div>
        <button
          onClick={handleClick}
          style={{
            background: isPremium ? '#EC4899' : '#FEE500',
            color: isPremium ? '#fff' : '#000',
            fontWeight: 800, fontSize: 15,
            padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
            minWidth: 220, boxShadow: '0 6px 14px rgba(0,0,0,0.2)',
          }}
        >
          {isPremium ? '프리미엄 가입하기' : '카카오로 1초 로그인'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #94a3b8)', marginTop: 10 }}>
          가입 즉시 100P 지급 · 언제든 해지 가능
        </div>
      </div>
    </section>
  );
}

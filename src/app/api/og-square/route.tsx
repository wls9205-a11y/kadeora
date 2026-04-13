import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';
export const maxDuration = 30;

// og-square: 630×630 — 네이버 모바일 1:1 크롭 전용
// 모든 핵심 정보가 중앙 100%에 집중 → 크롭 손실 없음

const CAT: Record<string, { color: string; dim: string; bg: [string,string,string]; label: string; icon: string; en: string }> = {
  apt:     { color: '#00FF87', dim: 'rgba(0,255,135,0.15)',   bg: ['#010804','#031509','#05230E'], label: '청약·분양',   icon: '🏢', en: 'APT' },
  stock:   { color: '#00E5FF', dim: 'rgba(0,229,255,0.15)',   bg: ['#010508','#031020','#051830'], label: '주식·시세',   icon: '📈', en: 'STOCK' },
  finance: { color: '#FFE000', dim: 'rgba(255,224,0,0.15)',   bg: ['#070500','#140E00','#201500'], label: '재테크·절세', icon: '💰', en: 'FINANCE' },
  unsold:  { color: '#FF6B1A', dim: 'rgba(255,107,26,0.15)',  bg: ['#070100','#140500','#210900'], label: '미분양',      icon: '⚠️', en: 'UNSOLD' },
  general: { color: '#C084FC', dim: 'rgba(192,132,252,0.15)', bg: ['#030108','#080518','#0D0825'], label: '생활정보',   icon: '📰', en: 'INFO' },
  blog:    { color: '#C084FC', dim: 'rgba(192,132,252,0.15)', bg: ['#030108','#080518','#0D0825'], label: '블로그',      icon: '✍️', en: 'BLOG' },
  local:   { color: '#FFD43B', dim: 'rgba(255,212,59,0.15)',  bg: ['#080700','#141000','#201800'], label: '우리동네',   icon: '📍', en: 'LOCAL' },
  free:    { color: '#F472B6', dim: 'rgba(244,114,182,0.15)', bg: ['#080210','#130820','#1E0F30'], label: '자유',        icon: '💬', en: 'FREE' },
};

// 카테고리별 대표 수치 (제목 없이 수치를 자동 표시)
const CAT_KPI: Record<string, { kw: string; kwv: string }> = {
  apt:     { kw: '분양데이터', kwv: '5,500건+' },
  stock:   { kw: '종목수',     kwv: '1,800종목+' },
  finance: { kw: '절세가이드', kwv: '7,600편+' },
  unsold:  { kw: '미분양데이터', kwv: '전국현황' },
  blog:    { kw: '블로그',     kwv: '7,600편+' },
  general: { kw: '정보',       kwv: '실시간' },
  local:   { kw: '지역정보',   kwv: '우리동네' },
  free:    { kw: '커뮤니티',   kwv: '실시간' },
};

import { SITE_URL as SITE } from '@/lib/constants';

/* ── 폰트: Node.js fs.readFileSync — 100% 확실 ── */
let _fontCache: ArrayBuffer | null = null;
function loadFont(): ArrayBuffer | null {
  if (_fontCache) return _fontCache;
  try {
    const buf = readFileSync(join(process.cwd(), 'public/fonts/NotoSansKR-Bold.woff'));
    _fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return _fontCache;
  } catch { return null; }
}

function LogoSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72">
      <defs>
        <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F1B3E" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect width="72" height="72" rx="18" fill="url(#lg)" />
      <circle cx="18" cy="36" r="7" fill="white" />
      <circle cx="36" cy="36" r="7" fill="white" />
      <circle cx="54" cy="36" r="7" fill="white" />
    </svg>
  );
}

export async function GET(req: NextRequest) {
  try {
    const fontData = loadFont();
    const ff = fontData ? 'NK, sans-serif' : 'sans-serif';
    const opts = fontData ? { fonts: [{ name: 'NK', data: fontData, style: 'normal' as const, weight: 700 as const }] } : {};
    const CACHE = {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Origin': '*',
    };

    const sp       = new URL(req.url).searchParams;
    const title    = sp.get('title') ?? '';
    const category = sp.get('category') ?? 'blog';

    const C   = CAT[category] ?? CAT.blog;
    const KPI = CAT_KPI[category] ?? CAT_KPI.blog;

    // 제목 처리 — 정사각형은 짧게 (최대 20자 × 2줄)
    const titleLine1 = title.length > 18 ? title.slice(0, 18) : title;
    const titleLine2 = title.length > 18 ? (title.slice(18, 36).length > 18 ? title.slice(18, 35) + '…' : title.slice(18)) : '';

    const _sqImg = new ImageResponse(
      /* ──────────────────────────────────────────────────────────
         630×630 수평 스트라이프 (1:1 전용)
         ┌──────────────────────────────────────┐
         │ [컬러 헤더] 카더라   카테고리.이모지  │ ← 13%
         ├──────────────────────────────────────┤
         │ [수치 띠]  핵심수치 대형              │ ← 20%
         ├──────────────────────────────────────┤
         │                                      │
         │  제목 (대형, 900 weight)              │ ← 35%
         │                                      │
         ├──────────────────────────────────────┤
         │ [KPI 3개 수평]                        │ ← 18%
         └──────────────────────────────────────┘
      ────────────────────────────────────────────────────────── */
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050505', fontFamily: ff }}>

        {/* 스트라이프 1: 컬러 헤더 */}
        <div style={{ background: C.color, padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, height: 72 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LogoSVG size={26} />
            <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#000' }}>카더라</span>
          </div>
          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: '#000', letterSpacing: 1 }}>{C.icon}  {C.en}</span>
        </div>

        {/* 스트라이프 2: 핵심 수치 */}
        <div style={{ background: '#0D0D0D', padding: '0 32px', display: 'flex', alignItems: 'center', gap: '4%', flexShrink: 0, height: 120, borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: C.color, fontWeight: 700, letterSpacing: 2 }}>{KPI.kw.toUpperCase()}</span>
            <span style={{ fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 0.85, letterSpacing: -3 }}>{KPI.kwv}</span>
          </div>
          <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${C.color}80, transparent)`, borderRadius: 99 }} />
          <span style={{ fontSize: 52 }}>{C.icon}</span>
        </div>

        {/* 스트라이프 3: 제목 (메인 중앙) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 32px' }}>
          <div style={{ fontSize: title ? 38 : 44, fontWeight: 900, color: '#ffffff', lineHeight: 1.18, letterSpacing: -1.5, wordBreak: 'keep-all' }}>
            {title ? (
              titleLine2 ? (
                <>{titleLine1}<br />{titleLine2}</>
              ) : titleLine1
            ) : (
              C.label
            )}
          </div>
          {!title && (
            <div style={{ fontSize: 16, color: '#6b7280', marginTop: 12 }}>카더라에서 확인하세요</div>
          )}
        </div>

        {/* 스트라이프 4: KPI 하단 */}
        <div style={{ background: C.dim, borderTop: `0.5px solid ${C.color}35`, padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexShrink: 0, height: 90 }}>
          {[
            { n: '7,600편+', l: '블로그' },
            { n: '실시간',    l: '업데이트' },
            { n: '무료',      l: '이용' },
          ].map((k, i, a) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 900, color: C.color, lineHeight: 1 }}>{k.n}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: 1 }}>{k.l}</span>
            </div>
          ))}
        </div>

      </div>,
      { width: 630, height: 630, ...opts }
    );
    const _sqBuf = await _sqImg.arrayBuffer();
    return new Response(_sqBuf, { headers: { 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff', ...CACHE } });

  } catch {
    return Response.redirect(`${SITE}/images/brand/kadeora-hero.png`, 302);
  }
}

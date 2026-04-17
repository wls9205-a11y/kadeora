/**
 * /api/og-calc — 계산기 결과 OG 이미지
 *
 * 카카오톡 / 네이버 블로그 / 페이스북 공유 시 결과값이 큰 이미지로 노출
 * → 자연 백링크 + CTR 폭증
 *
 * Edge runtime 대신 Node 런타임 사용 (한글 폰트 fs.readFileSync)
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let fontDataCache: Buffer | null = null;
let fontDataBoldCache: Buffer | null = null;

function loadFonts() {
  if (!fontDataCache) {
    try {
      const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Pretendard-Medium.otf');
      if (fs.existsSync(fontPath)) fontDataCache = fs.readFileSync(fontPath);
    } catch {}
  }
  if (!fontDataBoldCache) {
    try {
      const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Pretendard-Bold.otf');
      if (fs.existsSync(fontPath)) fontDataBoldCache = fs.readFileSync(fontPath);
    } catch {}
  }
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl;
  const slug = u.searchParams.get('slug') || 'calc';
  const result = u.searchParams.get('result') || '';
  const label = u.searchParams.get('label') || '계산 결과';
  const category = u.searchParams.get('category') || 'real-estate';

  loadFonts();
  const fonts: any[] = [];
  if (fontDataCache) fonts.push({ name: 'Pretendard', data: fontDataCache, weight: 500, style: 'normal' });
  if (fontDataBoldCache) fonts.push({ name: 'Pretendard', data: fontDataBoldCache, weight: 800, style: 'normal' });

  // 카테고리별 컬러
  const themeMap: Record<string, { bg: string; accent: string; emoji: string }> = {
    'real-estate':    { bg: '#0f172a', accent: '#3b82f6', emoji: '🏠' },
    'property-tax':   { bg: '#0f172a', accent: '#3b82f6', emoji: '🏠' },
    'income-tax':     { bg: '#1a0e2c', accent: '#a855f7', emoji: '💼' },
    'finance-tax':    { bg: '#0a1f1c', accent: '#10b981', emoji: '📈' },
    'investment':     { bg: '#0a1f1c', accent: '#10b981', emoji: '📊' },
    'salary':         { bg: '#1f0a0a', accent: '#f59e0b', emoji: '💰' },
    'loan':           { bg: '#0a1929', accent: '#06b6d4', emoji: '🏦' },
    'inheritance':    { bg: '#1a0a1a', accent: '#ec4899', emoji: '🎁' },
    'pension':        { bg: '#1a160a', accent: '#eab308', emoji: '👴' },
  };
  const t = themeMap[category] || themeMap['real-estate'];

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', width: '100%', height: '100%',
        background: t.bg, color: '#fff', flexDirection: 'column', padding: 60,
        fontFamily: 'Pretendard, sans-serif', position: 'relative',
      }}>
        {/* 그라디언트 오버레이 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: `radial-gradient(ellipse at top right, ${t.accent}30, transparent 60%)`,
        }} />

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, color: t.accent, fontWeight: 800 }}>
          <span style={{ fontSize: 36 }}>{t.emoji}</span>
          <span>카더라 계산기</span>
        </div>

        {/* 라벨 */}
        <div style={{ fontSize: 32, fontWeight: 500, color: '#cbd5e1', marginTop: 30, lineHeight: 1.3 }}>
          {label}
        </div>

        {/* 결과 (큰 강조) */}
        <div style={{
          fontSize: result.length > 12 ? 88 : 120,
          fontWeight: 800, color: t.accent, marginTop: 16,
          letterSpacing: '-2px', lineHeight: 1.1,
          textShadow: `0 4px 20px ${t.accent}40`,
        }}>
          {result}
        </div>

        {/* 하단 */}
        <div style={{
          marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 22, color: '#94a3b8',
        }}>
          <span>📊 무료 · 회원가입 불필요 · 145종</span>
          <span style={{ fontWeight: 800, color: '#f1f5f9' }}>kadeora.app</span>
        </div>
      </div>
    ),
    {
      width: 1200, height: 630,
      fonts: fonts.length > 0 ? fonts : undefined,
    }
  );
}

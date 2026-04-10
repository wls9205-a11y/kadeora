'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * SmartSectionGate v3 — 완전 불투명 게이트
 * - 본문 1~2줄만 보여주고 → 그라데이션 → 불투명 배경
 * - CTA는 불투명 영역 안에 독립 배치 (겹침 없음)
 */

function trackCTA(action: string, label: string, extra?: Record<string, string>) {
  try { fetch('/api/analytics/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: `cta_${action}`, label, ...extra }) }).catch(() => {}); } catch {}
}

interface Props { htmlContent: string; slug: string; category: string; }

export default function SmartSectionGate({ htmlContent, slug, category }: Props) {
  const pathname = usePathname();
  const [shouldGate, setShouldGate] = useState(false);

  useEffect(() => {
    setShouldGate(true);
  }, [slug]);

  useEffect(() => { if (shouldGate) trackCTA('view', 'content_gate', { category }); }, [shouldGate, category]);

  if (!shouldGate) {
    return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
  }

  // 게이트 위치: 첫 H2 이후 콘텐츠 분할
  const match = htmlContent.match(/<h2[^>]*>.*?<\/h2>/i);
  let visibleSection: string;
  let gatedExists = true;

  if (match && match.index !== undefined) {
    const afterH2 = htmlContent.indexOf('</h2>', match.index) + 5;
    const nextBlock = htmlContent.indexOf('<', afterH2 + 100);
    const splitAt = nextBlock > 0 ? nextBlock : afterH2 + 200;
    visibleSection = htmlContent.slice(0, splitAt);
  } else {
    const splitAt = Math.min(htmlContent.length, 600);
    visibleSection = htmlContent.slice(0, splitAt);
  }

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=content_gate`;

  return (
    <>
      {/* 보이는 콘텐츠 */}
      <div dangerouslySetInnerHTML={{ __html: visibleSection }} />

      {/* 페이드 → 불투명 → CTA */}
      <div style={{ position: 'relative', marginTop: -20 }}>
        {/* 그라데이션 페이드 */}
        <div style={{
          height: 40,
          background: 'linear-gradient(to bottom, rgba(5,10,24,0) 0%, rgba(5,10,24,1) 100%)',
          pointerEvents: 'none',
        }} />

        {/* 불투명 CTA 영역 */}
        <div style={{
          background: '#050a18',
          padding: '24px 20px 20px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(59,123,246,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, margin: '0 auto 12px',
          }}>🔒</div>

          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            나머지 분석을 확인하세요
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            가입하면 전체 분석 + 청약 알림까지 무료
          </div>

          <a
            href={loginUrl}
            onClick={() => trackCTA('click', 'content_gate', { category })}
            style={{
              display: 'block', width: '100%', padding: '12px', borderRadius: 8,
              background: '#FEE500', color: '#191919', fontSize: 14, fontWeight: 600,
              textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box',
            }}
          >
            카카오로 3초 만에 열기
          </a>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
            가입 즉시 전체 열람 · 스팸 없음
          </div>
        </div>
      </div>
    </>
  );
}

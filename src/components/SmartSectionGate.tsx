'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

function trackCTA(action: string, label: string, extra?: Record<string, string>) {
  try {
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: `cta_${action}`, cta_name: label, category: extra?.category || '' }) }).catch(() => {});
  } catch {}
}

interface Props { htmlContent: string; slug: string; category: string; userCount?: number; todaySignups?: number; }

export default function SmartSectionGate({ htmlContent, slug, category, userCount = 66, todaySignups = 0 }: Props) {
  const pathname = usePathname();
  const [shouldGate, setShouldGate] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setShouldGate(true); }, [slug]);
  useEffect(() => { if (shouldGate) trackCTA('view', 'content_gate', { category }); }, [shouldGate, category]);

  if (!shouldGate) return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;

  // 게이트 위치: 본문 55% 지점 (충분히 읽혀서 궁금증 유발)
  const cutPoint = Math.floor(htmlContent.length * 0.55);
  // H2/H3 태그 경계에서 자르기 (깔끔하게)
  const headingAfterCut = htmlContent.slice(cutPoint).match(/<h[23][^>]*>/i);
  const actualCut = headingAfterCut?.index ? cutPoint + headingAfterCut.index : cutPoint;
  const visibleSection = htmlContent.slice(0, actualCut);

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=content_gate`;

  // 카테고리별 맞춤 메시지
  const ctaConfig = {
    apt: { icon: '🏠', title: '나머지 분석 이어서 읽기', desc: '무료 가입하면 전체 분석 + 청약 알림까지', tags: ['전체분석', '청약알림', '실거래가'] },
    stock: { icon: '📈', title: '나머지 분석 이어서 읽기', desc: '무료 가입하면 전체 분석 + AI 브리핑까지', tags: ['전체분석', '종목알림', 'AI분석'] },
    finance: { icon: '💰', title: '나머지 분석 이어서 읽기', desc: '무료 가입하면 전체 분석 + 투자 인사이트까지', tags: ['전체분석', '계산기', '절세전략'] },
  }[category] || { icon: '📊', title: '나머지 분석 이어서 읽기', desc: '무료 가입하면 모든 분석 + 커뮤니티 이용 가능', tags: ['전체분석', '무료가입', '3초완료'] };

  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: visibleSection }} />

      <div style={{ position: 'relative', marginTop: -30 }}>
        {/* 그라데이션 페이드 — 더 길게 */}
        <div style={{ height: 80, background: 'linear-gradient(to bottom, rgba(5,10,24,0) 0%, rgba(5,10,24,1) 100%)', pointerEvents: 'none' }} />

        {/* 메인 CTA 영역 */}
        <div style={{ background: '#050a18', padding: '0 16px 24px', textAlign: 'center' }}>

          {/* 프리미엄 카드 */}
          <div style={{
            maxWidth: 380, margin: '0 auto', padding: '28px 24px 24px',
            borderRadius: 16, border: '1px solid rgba(59,123,246,0.2)',
            background: 'linear-gradient(135deg, rgba(12,21,40,0.98), rgba(20,30,50,0.98))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* 상단 그라데이션 바 */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #3b7bf6, #22c55e)' }} />

            {/* 아이콘 */}
            <div style={{ fontSize: 32, marginBottom: 12 }}>{ctaConfig.icon}</div>

            {/* 제목 */}
            <div style={{ fontSize: 18, fontWeight: 800, color: '#e8e6e3', marginBottom: 6, lineHeight: 1.3 }}>
              {ctaConfig.title}
            </div>

            {/* 설명 */}
            <div style={{ fontSize: 13, color: '#8b95a5', lineHeight: 1.6, marginBottom: 14 }}>
              {ctaConfig.desc}
            </div>

            {/* 태그 */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
              {ctaConfig.tags.map(t => (
                <span key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(59,123,246,0.08)', color: '#6da0f0', border: '0.5px solid rgba(59,123,246,0.15)' }}>{t}</span>
              ))}
            </div>

            {/* 카카오 버튼 (원클릭) */}
            <a
              href={loginUrl}
              onClick={() => trackCTA('click', 'content_gate', { category })}
              style={{
                display: 'flex', width: '100%', padding: '13px', borderRadius: 10,
                background: '#FEE500', color: '#191919', fontSize: 15, fontWeight: 700,
                textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 512 512" fill="#191919"><path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z"/></svg>
              카카오로 이어서 읽기
            </a>

            {/* 소셜 프루프 */}
            <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              ✅ {userCount.toLocaleString()}명의 투자자가 사용 중{todaySignups > 0 ? ` · 오늘 ${todaySignups}명 가입` : ''}
            </div>

            {/* 하단: 구글 로그인 + 공유 */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
              <a href={loginUrl} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Google로 시작</a>
              <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
              <button onClick={handleCopy} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer' }}>
                {copied ? '✅ 복사됨' : '📋 링크복사'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

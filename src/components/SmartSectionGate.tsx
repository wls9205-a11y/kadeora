'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { trackCTA } from '@/lib/analytics';

interface Props { htmlContent: string; slug: string; category: string; userCount?: number; todaySignups?: number; }

export default function SmartSectionGate({ htmlContent, slug, category, userCount = 66, todaySignups = 0 }: Props) {
  const pathname = usePathname();
  const [shouldGate, setShouldGate] = useState(false);

  useEffect(() => { setShouldGate(true); }, [slug]);
  useEffect(() => { if (shouldGate) trackCTA('view', 'content_gate'); }, [shouldGate, category]);

  if (!shouldGate) return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;

  const cutPoint = Math.floor(htmlContent.length * 0.55);
  const headingAfterCut = htmlContent.slice(cutPoint).match(/<h[23][^>]*>/i);
  const actualCut = headingAfterCut?.index ? cutPoint + headingAfterCut.index : cutPoint;
  const visibleSection = htmlContent.slice(0, actualCut);

  const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}&source=content_gate`;

  const ctaText: Record<string, string> = {
    apt: '핵심 분석과 시세 전망',
    stock: '핵심 분석과 AI 브리핑',
    finance: '핵심 분석과 절세 전략',
  };
  const label = ctaText[category] || '핵심 분석과 전망';

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: visibleSection }} />

      <div style={{ position: 'relative', marginTop: -30 }}>
        <div style={{
          height: 80, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(5,10,24,0) 0%, rgba(5,10,24,1) 100%)',
        }} />

        <div style={{ background: '#050a18', padding: '0 16px 24px', textAlign: 'center' }}>
          <div style={{
            maxWidth: 400, width: '100%', margin: '0 auto',
            padding: '20px', borderRadius: 16, boxSizing: 'border-box' as const,
            borderTop: '2px solid rgba(254,229,0,0.3)',
            background: 'linear-gradient(135deg, rgba(12,21,40,0.98), rgba(20,30,50,0.98))',
          }}>
            <p style={{ fontSize: 13, color: 'rgba(224,232,240,0.5)', lineHeight: 1.6, marginBottom: 14 }}>
              이 글의 <span style={{ color: '#FEE500', fontWeight: 700 }}>{label}</span>을 보려면<br />
              카카오 3초 가입으로 잠금 해제하세요
            </p>

            <a
              href={loginUrl}
              onClick={() => trackCTA('click', 'content_gate')}
              style={{
                display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#FEE500', color: '#191919', borderRadius: 10,
                padding: '12px 0', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 0 20px rgba(254,229,0,0.12)', boxSizing: 'border-box' as const,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 512 512" fill="#191919"><path d="M255.5 48C141.1 48 48 126.1 48 222.4c0 62.2 38.7 116.7 97 149.8l-24.1 89.7c-2.1 7.9 6.8 14.4 13.7 9.9l101.2-65.2c7.2 1 14.6 1.5 22.2 1.5 114.4 0 207.5-78.1 207.5-174.4S369.9 48 255.5 48z" /></svg>
              카카오로 전체 글 보기
            </a>

            <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(224,232,240,0.25)', lineHeight: 1.5 }}>
              또는 <a href={loginUrl} style={{ color: 'rgba(224,232,240,0.4)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>이메일로 가입</a>
              {' · '}
              {userCount.toLocaleString()}명 이용 중{todaySignups > 0 ? ` · 오늘 ${todaySignups}명` : ''}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

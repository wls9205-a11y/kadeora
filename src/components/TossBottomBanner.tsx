'use client';
import { useEffect, useState } from 'react';
import { isTossMode, openInBrowser } from '@/lib/toss-mode';
import { usePathname } from 'next/navigation';

/**
 * TossBottomBanner — 토스 미니앱 하단 고정 CTA 배너
 * 현재 페이지에 맞는 메시지 + 외부 브라우저 열기 버튼
 * layout.tsx에 삽입 — 모든 페이지에서 표시
 */
export default function TossBottomBanner() {
  const [show, setShow] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setShow(isTossMode());
  }, []);

  if (!show) return null;

  // 페이지별 CTA 메시지
  const getCtaInfo = () => {
    if (pathname.startsWith('/stock')) return {
      label: '전체 종목 보기',
      sub: '국내외 주요 종목 실시간 시세',
      path: '/stock',
    };
    if (pathname.startsWith('/apt')) return {
      label: '부동산 전체 보기',
      sub: '청약·분양·미분양·재개발',
      path: '/apt',
    };
    if (pathname.startsWith('/blog')) return {
      label: '블로그 전체 보기',
      sub: '투자 정보 블로그',
      path: pathname,
    };
    if (pathname.startsWith('/feed')) return {
      label: '커뮤니티 참여하기',
      sub: '글쓰기·댓글·토론',
      path: '/feed',
    };
    return {
      label: '카더라 열기',
      sub: '주식·청약·부동산 올인원',
      path: '/',
    };
  };

  const cta = getCtaInfo();

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      padding: '10px 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 10,
      background: '#191F28',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.2)',
    }}>
      {/* 로고 + 텍스트 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, #3182F6, #1B64DA)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          📊
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            color: '#fff', fontWeight: 800, fontSize: 13,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {cta.sub}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 }}>
            카더라 · 무료
          </div>
        </div>
      </div>

      {/* CTA 버튼 */}
      <button
        onClick={() => openInBrowser(cta.path)}
        style={{
          padding: '10px 18px', borderRadius: 'var(--radius-md)', border: 'none',
          background: '#3182F6', color: '#fff', fontWeight: 800,
          fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}
      >
        {cta.label}
      </button>
    </div>
  );
}

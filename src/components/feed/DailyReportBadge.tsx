'use client';
import Link from 'next/link';

/**
 * 헤더 내 데일리 리포트 뱃지 — 펄싱 도트 + '데일리 리포트' 링크
 * 위치: Navigation.tsx 로고 직후
 *
 * s170: /daily 바레 route 가 서버에서 region 판단 후 /daily/[region] 으로 리다이렉트.
 *   클라이언트 localStorage 의존 제거 → 링크 단순화.
 */
export default function DailyReportBadge() {
  return (
    <Link
      href="/daily"
      aria-label="데일리 리포트"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', borderRadius: 14,
        background: 'rgba(212,168,83,0.1)',
        border: '1px solid rgba(212,168,83,0.35)',
        color: '#D4A853',
        fontSize: 10.5, fontWeight: 600, lineHeight: 1,
        textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: '#D4A853',
        animation: 'kdBadgePulse 1.6s ease-in-out infinite',
      }} />
      데일리 리포트
      <style jsx>{`
        @keyframes kdBadgePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </Link>
  );
}

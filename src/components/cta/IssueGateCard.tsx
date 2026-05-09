'use client';
// s262 Phase C — IssueGateCard.
// /stock 이슈 정렬 6번째 자리에 노출 (비로그인 only). 클릭 시 /login?source=issue_gate_stock.
// useAuth 로 로그인 여부 판정 — 로그인 상태면 렌더 0.

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { trackCtaClick } from '@/lib/cta-track';

type Props = {
  source?: string;        // tracking source (default 'issue_gate_stock')
  redirect?: string;      // login redirect target
  totalCount?: number;    // "27개" 같은 카피용
};

export default function IssueGateCard({
  source = 'issue_gate_stock',
  redirect = '/stock',
  totalCount,
}: Props) {
  const { userId } = useAuth();
  if (userId) return null;

  const href = `/login?source=${encodeURIComponent(source)}&redirect=${encodeURIComponent(redirect)}`;
  const subtitle = totalCount
    ? `상위 5개 미리보기 끝 / 로그인하면 이슈 종목 ${totalCount}개 + 푸시 알림`
    : '상위 5개 미리보기 끝 / 로그인하면 이슈 종목 전체 + 푸시 알림';

  return (
    <Link
      href={href}
      onClick={() => trackCtaClick({ cta_name: source, category: 'signup' })}
      style={{
        display: 'block',
        margin: 3,
        padding: '14px 12px',
        borderRadius: 6,
        background: 'linear-gradient(180deg, #FEF3C7 0%, #FFFFFF 100%)',
        border: '1px solid #FCD34D',
        textDecoration: 'none',
        color: '#111827',
      }}
      aria-label="가입하고 전체 이슈 종목 보기"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden style={{ fontSize: 24 }}>🔓</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
            전체 이슈 종목 보기
          </div>
          <div style={{ fontSize: 11.5, color: '#374151', lineHeight: 1.4 }}>
            {subtitle}
          </div>
        </div>
        <span
          style={{
            background: '#FEE500', // kakao yellow
            color: '#000000',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          카카오로 3초 로그인
        </span>
      </div>
    </Link>
  );
}

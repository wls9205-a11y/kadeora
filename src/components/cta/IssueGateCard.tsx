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
        borderRadius: 'var(--radius-sm)',
        // ⚠️ DS-3-1 — 앰버 그라디언트(#FEF3C7→#FFFFFF)와 금색 테두리(#FCD34D)를 걷었다.
        //    이 카드의 「이슈」는 «콘텐츠 종류»(이슈 종목)지 «경고 상태» 가 아니다.
        //    즉 앰버는 의미색이 아니라 «유인 장식» 이었고 대응하는 의미 토큰이 없다.
        //    중단점 C 단서대로 중립 계열로 흡수한다 — S7-3 「회원 CTA = 흰 카드」와 같은 방향.
        //    ⚠️ 이 카드만은 «미세 변화가 아니다». 6폭 보고에 명시한다.
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        // 틴트가 빠진 만큼 배경에 묻히지 않도록 그림자로 분리한다(DS ④ signup 과 같은 처리).
        boxShadow: 'var(--shadow-sm)',
        textDecoration: 'none',
        color: 'var(--text-primary)',
      }}
      aria-label="가입하고 전체 이슈 종목 보기"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)' }}>
        <span aria-hidden style={{ fontSize: 24 }}>🔓</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            전체 이슈 종목 보기
          </div>
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {subtitle}
          </div>
        </div>
        <span
          style={{
            background: 'var(--kakao-bg)',
            color: 'var(--kakao-text)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--fs-2xs)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          카카오로 3초 로그인
        </span>
      </div>
    </Link>
  );
}

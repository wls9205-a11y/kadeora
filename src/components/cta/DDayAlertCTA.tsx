'use client';
// s262 Phase C — DDayAlertCTA.
// /apt 마감임박 블록 끝에 노출 (비로그인 only). 클릭 시 /login?source=apt_dday_alert.
// 기존 apt_alert_cta 정체 우회 — 같은 자리지만 새 source 로 측정 baseline 확보.

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { trackCtaClick } from '@/lib/cta-track';

type Props = {
  source?: string;
  redirect?: string;
};

export default function DDayAlertCTA({
  source = 'apt_dday_alert',
  redirect = '/apt',
}: Props) {
  const { userId } = useAuth();
  if (userId) return null;

  const href = `/login?source=${encodeURIComponent(source)}&redirect=${encodeURIComponent(redirect)}`;

  return (
    <Link
      href={href}
      onClick={() => trackCtaClick({ cta_name: source, category: 'signup' })}
      style={{
        display: 'block',
        margin: '6px 3px 3px',
        padding: '10px 12px',
        borderRadius: 6,
        background: '#FEF2F2',
        border: '1px solid #FCA5A5',
        textDecoration: 'none',
        color: '#111827',
      }}
      aria-label="관심 단지 D-day 푸시 받기"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden style={{ fontSize: 18 }}>🔔</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7F1D1D' }}>
            관심 단지 D-day 푸시 받기
          </div>
          <div style={{ fontSize: 11, color: '#991B1B', lineHeight: 1.4 }}>
            로그인하면 마감 3일 전 카카오 알림
          </div>
        </div>
        <span
          style={{
            background: '#DC2626',
            color: '#FFFFFF',
            padding: '4px 10px',
            borderRadius: 4,
            fontSize: 11.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          알림 받기
        </span>
      </div>
    </Link>
  );
}

'use client';

// r4-P9-4 — 부동산 계산기에서만 나오는 상담 진입점.
//
// 왜 여기만인가: 30일 계산기 방문자 522명 중 다른 섹션으로 넘어간 사람이 14명(2.7%)이고,
// 웹 리드폼 90일 리드가 1건이다. 그런데 상위 계산기(주택채권 매입금 51명 · 분양권 양도세 23명 ·
// 등기 비용 13명 · 취득세 11명)는 전부 '집을 사는 사람이 하는 계산'인데
// /calc 어디에도 상담으로 이어지는 경로가 없었다.
//
// 급여·군인·법률 계산기에는 붙이지 않는다. CalcNextSteps 가 세워둔 원칙 그대로 —
// 억지 연결은 클릭도 안 되고 신뢰만 깎는다.
//
// 폼을 인라인으로 펼치지 않는다. 계산기는 도구 화면이고, 입력칸이 뜨면 도구가 아니게 된다.
// 한 줄 + 버튼 하나로 끝내고 실제 폼은 현장 상세(/apt/[id])의 LeadForm 이 받는다.

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { trackCTA } from '@/lib/analytics';

/** 집을 사는 맥락의 계산기만. 이 목록을 넓히지 말 것. */
export const LEAD_CTA_CATEGORIES = ['real-estate', 'property-tax', 'loan'] as const;

export function hasLeadCta(category: string): boolean {
  return (LEAD_CTA_CATEGORIES as readonly string[]).includes(category);
}

type Props = {
  category: string;
  /** 어느 계산기에서 왔는지 — 목적지 URL 과 계측에 함께 싣는다. */
  slug: string;
};

export default function CalcLeadCta({ category, slug }: Props) {
  const pathname = usePathname();

  // 훅은 early return 보다 앞에 와야 하므로, 렌더 조건을 effect 안에서 다시 본다.
  // 이게 없으면 CTA 가 안 나오는 카테고리에서도 view 가 찍혀 노출 수가 부풀려진다.
  useEffect(() => {
    if (!hasLeadCta(category)) return;
    trackCTA('view', 'calc_lead_cta', { page_path: pathname, category, calc: slug });
  }, [pathname, category, slug]);

  if (!hasLeadCta(category)) return null;

  // LeadForm 은 현장 상세에만 있고 siteSlug 가 필수라 계산기에서 바로 띄울 수 없다.
  // 청약 허브로 보내 현장을 고르게 한다. from=calc 는 유입 출처 구분용.
  const href = `/apt?from=calc&calc=${encodeURIComponent(slug)}`;

  return (
    <section
      aria-labelledby="calc-lead-heading"
      style={{
        marginTop: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--kd-accent-bg)',
        border: '1px solid var(--kd-accent-border)',
      }}
    >
      <h2
        id="calc-lead-heading"
        style={{
          margin: 0,
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          color: 'var(--kd-accent)',
          lineHeight: 1.5,
          minWidth: 0,
          wordBreak: 'keep-all',
        }}
      >
        지금 보시는 조건으로 분양 상담을 받아보실 수 있습니다
      </h2>
      <Link
        href={href}
        onClick={() => trackCTA('click', 'calc_lead_cta', { page_path: pathname, category, calc: slug })}
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--kd-accent)',
          color: 'var(--text-inverse)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        분양 정보 안내 신청 →
      </Link>
    </section>
  );
}

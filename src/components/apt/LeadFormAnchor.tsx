'use client';

// S4-2 — 상단 컴팩트 진입 바.
//
// 상단에 폼 전체를 얹지 않는 이유: 카더라 상세는 조감도·스펙·분양가가 먼저 나와야 하는
// 정보 페이지다. 입력칸 4개 + 동의 2개가 히어로 바로 아래에 오면 본문이 한 화면 아래로
// 밀려 SEO 상 불리하고, 구조가 리드팜과 같아진다. 그래서 여기서는 한 줄짜리 진입점만 두고
// 실제 폼은 하단(FAQ 아래)에 유지한 뒤 스크롤로 연결한다.

import { useCallback } from 'react';
import { LEAD_FORM_ID } from '@/components/apt/LeadForm';

// LeadForm 과 같은 조건으로 사라져야 한다 — 눌러도 갈 곳이 없는 버튼을 만들지 않는다.
const ENDPOINT = process.env.NEXT_PUBLIC_LEAD_ENDPOINT || '';

export default function LeadFormAnchor() {
  const jump = useCallback(() => {
    const form = document.getElementById(LEAD_FORM_ID);
    if (!form) return;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 스크롤이 끝난 뒤 포커스를 준다. 지금 바로 focus() 하면 브라우저가 즉시 점프시켜
    // smooth 스크롤이 잘린다.
    window.setTimeout(() => {
      document.getElementById('kd-lead-name')?.focus({ preventScroll: true });
    }, 600);
  }, []);

  if (!ENDPOINT) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        background: 'var(--kd-accent-bg)',
        border: '1px solid var(--kd-accent-border)',
        borderRadius: 'var(--radius-md)',
        padding: '9px 12px',
        margin: '10px 0',
      }}
    >
      <style>{`
        .kd-lead-anchor-full { display: inline; }
        .kd-lead-anchor-short { display: none; }
        @media (max-width: 480px) {
          .kd-lead-anchor-full { display: none; }
          .kd-lead-anchor-short { display: inline; }
        }
      `}</style>
      <span
        style={{
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          color: 'var(--kd-accent)',
          lineHeight: 1.5,
          minWidth: 0,
          wordBreak: 'keep-all',
        }}
      >
        <span className="kd-lead-anchor-full">분양가·일정 변동을 가장 먼저 받아보세요</span>
        <span className="kd-lead-anchor-short">분양가·일정 알림 받기</span>
      </span>
      <button
        type="button"
        onClick={jump}
        className="kd-btn kd-btn-sm"
        style={{
          flexShrink: 0,
          background: 'var(--kd-accent)',
          borderColor: 'var(--kd-accent)',
          color: 'var(--text-inverse)',
          fontWeight: 700,
        }}
      >
        알림 신청 →
      </button>
    </div>
  );
}

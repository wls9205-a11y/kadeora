// DS-2 표준 ④-a — CTA 2종.
//
// S7-3 확정을 코드로 옮긴 것이다:
//   lead   리드폼 진입 — «틴트 색면». 브랜드 톤을 옅게 깔고 그 위에 브랜드 글자.
//   signup 회원 가입   — «흰 카드». 카카오 노랑은 버튼에만, 면 전체에 쓰지 않는다.
//
// ⛔ 두 종을 «인접 배치하지 않는다»(S7-3). 같은 화면에서 둘이 붙어 있으면
//    「무엇을 눌러야 하나」가 생기고, 둘 다 안 눌린다.
//    이 규칙은 주석이 아니라 «개발 중 경고» 로도 걸어 둔다 — 아래 useAdjacencyWarning.
//
// ⚠️ 카카오 노랑은 --kakao-bg / --kakao-text 토큰만 쓴다. #FEE500 하드코딩 금지.
//    그 색은 이 저장소에서 대비 사고를 두 번 냈다(틴트 위 1.24 · 1.26).
//    노랑 «면» 위 검정 글자는 13.5:1 로 안전하지만, 노랑을 «글자» 로 쓰면 즉시 미달이다.

'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export type CtaKind = 'lead' | 'signup';

export interface CtaPanelProps {
  kind: CtaKind;
  title: string;
  /** 한 줄 설명. 없으면 제목만. */
  lede?: string;
  /** 행동 버튼 자리. */
  action: ReactNode;
  /** 상단 라벨 밴드(「분양 정보 안내 · 무료」 같은). */
  band?: string;
}

/**
 * 인접 배치 감시. 개발/프리뷰에서만 경고한다.
 * ⚠️ 프로덕션에서는 아무 일도 하지 않는다 — 사용자에게 보이는 동작을 바꾸지 않는다.
 */
function useAdjacencyWarning(ref: React.RefObject<HTMLDivElement | null>, kind: CtaKind) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const el = ref.current;
    if (!el) return;
    for (const sib of [el.previousElementSibling, el.nextElementSibling]) {
      const other = sib?.getAttribute?.('data-ds-cta');
      if (other && other !== kind) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DS] CTA 2종이 인접 배치됐다 (${kind} ↔ ${other}). S7-3 확정: 붙여 놓으면 둘 다 안 눌린다.`,
        );
      }
    }
  }, [ref, kind]);
}

export default function CtaPanel({ kind, title, lede, action, band }: CtaPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  useAdjacencyWarning(ref, kind);

  const isLead = kind === 'lead';
  return (
    <div
      ref={ref}
      data-ds="cta"
      data-ds-cta={kind}
      style={{
        // lead = 틴트 색면 / signup = 흰 카드. 면의 성격이 두 종을 가른다.
        background: isLead ? 'var(--brand-bg)' : 'var(--bg-surface)',
        border: `1px solid var(${isLead ? '--brand-border' : '--border'})`,
        borderRadius: 'var(--radius-card)',
        padding: 'var(--sp-lg)',
        boxShadow: isLead ? 'none' : 'var(--shadow-sm)',
      }}
    >
      {band && (
        <div
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            color: `var(${isLead ? '--brand' : '--text-tertiary'})`,
            marginBottom: 6,
          }}
        >
          {band}
        </div>
      )}
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
        {title}
      </div>
      {lede && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '6px 0 0' }}>
          {lede}
        </p>
      )}
      <div style={{ marginTop: 'var(--sp-md)' }}>{action}</div>
    </div>
  );
}

/** 카카오 버튼 — 노랑은 «면» 에만. 글자는 항상 --kakao-text. */
export function KakaoActionButton({ children, href, onClick }: { children: ReactNode; href?: string; onClick?: () => void }) {
  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    minHeight: 48,
    borderRadius: 'var(--radius-md)',
    background: 'var(--kakao-bg)',
    color: 'var(--kakao-text)',
    border: 'none',
    fontSize: 'var(--fs-sm)',
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
  } as const;
  if (href) return <a href={href} style={style} data-ds="kakao-btn">{children}</a>;
  return <button type="button" onClick={onClick} style={style} data-ds="kakao-btn">{children}</button>;
}

// DS-2 표준 ⑧ — 빈 상태 · 스켈레톤.
//
// 빈 상태 규칙(설계서 §2 카피):
//   ⛔ 사과하지 않는다. 「죄송합니다」는 사용자가 할 일을 하나도 알려 주지 않는다.
//   ⛔ 모호하게 쓰지 않는다. 「데이터가 없습니다」는 «없는 것인지 못 불러온 것인지» 를 안 가른다.
//   ✅ «다음 행동» 을 말한다. 그리고 가능하면 그 행동으로 가는 길을 같이 준다.
//
// ⚠️ 「비어 있음」과 「못 불러옴」은 «다른 상태» 다. 같은 화면을 쓰면 사용자는 새로고침을
//    해야 할 때 포기하고, 포기해야 할 때 새로고침을 반복한다. kind 로 가른다.
// ⚠️ 0건이면 «섹션째 렌더하지 않는» 쪽이 맞을 때가 많다(RecentObservations 가 그렇게 한다).
//    이 컴포넌트는 「이 자리에 무언가 있어야 한다」가 참일 때만 쓴다.

import type { ReactNode } from 'react';

export type EmptyKind = 'empty' | 'error' | 'search';

export interface EmptyStateProps {
  kind?: EmptyKind;
  /** 무슨 일이 일어났는지. 한 줄. */
  title: string;
  /** 다음에 무엇을 하면 되는지. 사과·변명이 아니라 «행동». */
  action?: ReactNode;
  /** 보조 설명. 필요할 때만. */
  hint?: string;
}

export default function EmptyState({ kind = 'empty', title, action, hint }: EmptyStateProps) {
  return (
    <div
      data-ds="empty-state"
      data-ds-kind={kind}
      // 못 불러온 것은 «알림» 이다. 비어 있는 것은 그냥 사실이라 조용히 둔다.
      role={kind === 'error' ? 'alert' : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--sp-sm)',
        padding: 'var(--sp-2xl) var(--sp-lg)',
        textAlign: 'center',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-card)',
        background: 'var(--bg-surface)',
      }}
    >
      <p style={{ margin: 0, fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5 }}>
        {title}
      </p>
      {hint && (
        <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{hint}</p>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}

/**
 * 스켈레톤 — «올 것의 모양» 을 미리 그린다.
 *
 * ⚠️ 스피너를 쓰지 않는다. 스피너는 「얼마나 남았나」도 「무엇이 올까」도 안 알려 준다.
 *    행 목록 자리에는 행 모양을, 카드 자리에는 카드 모양을 그린다 — 도착 순간 레이아웃이
 *    흔들리지 않는 것이 실제 이득이다(CLS).
 * ⚠️ `prefers-reduced-motion` 에서는 «움직이지 않는다»(설계서 §2). 반짝임은 장식이다.
 * ⚠️ 보조기술에는 「불러오는 중」 한 번만 알린다. 껍데기 12개를 다 읽어 주면 소음이다.
 */
export function Skeleton({ rows = 3, height = 56 }: { rows?: number; height?: number }) {
  return (
    <div data-ds="skeleton" role="status" aria-live="polite" style={{ display: 'grid', gap: 8 }}>
      <span className="sr-only">불러오는 중</span>
      <style>{`
        @keyframes kd-skel { 0% { opacity: .55 } 50% { opacity: 1 } 100% { opacity: .55 } }
        .kd-skel { animation: kd-skel 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .kd-skel { animation: none; } }
      `}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="kd-skel"
          style={{
            height,
            borderRadius: 'var(--radius-card)',
            background: 'var(--bg-hover)',
            // 여러 줄이 «같은 박자로» 뛰면 기계처럼 보인다. 조금씩 어긋나게 둔다.
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

// DS-2 표준 ② — 배지·칩.
//
// ⛔ 색을 props 로 받지 않는다. 톤(의미)만 받는다.
//    `color="#FEE500"` 을 허용하는 순간 대비 감사가 «감사할 표» 를 잃는다.
// ⛔ hex 를 여기 쓰지 않는다. tone.ts 의 토큰 이름만 통과시킨다.
//
// 배지(badge)와 칩(chip)의 차이는 «누를 수 있는가» 하나다.
//   badge — 상태 표시. 클릭 없음. 44px 규칙 대상 아님.
//   chip  — 필터·태그. 누를 수 있으면 44px 터치 타깃을 지킨다.

import type { CSSProperties, ReactNode } from 'react';
import { TONE, type Tone } from '@/components/ds/tone';

export interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  /** 촘촘한 목록 행 안에서 쓰는 작은 치수. */
  size?: 'sm' | 'md';
  /** 스크린리더용 보충 설명. 색만으로 의미를 전달하지 않기 위한 자리다. */
  title?: string;
}

function toneStyle(tone: Tone): CSSProperties {
  const t = TONE[tone];
  return {
    color: `var(${t.fg})`,
    background: `var(${t.bg})`,
    border: t.border ? `1px solid var(${t.border})` : '1px solid transparent',
  };
}

export function Badge({ children, tone = 'neutral', size = 'sm', title }: BadgeProps) {
  return (
    <span
      // 대비 감사가 찾는 표식. 톤을 값으로 실어 「무엇을 재야 하는지」를 DOM 에 남긴다.
      data-ds="badge"
      data-ds-tone={tone}
      title={title}
      style={{
        ...toneStyle(tone),
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: size === 'sm' ? '2px 7px' : '4px 10px',
        borderRadius: 'var(--radius-pill)',
        fontSize: size === 'sm' ? 'var(--fs-xs)' : 'var(--fs-sm)',
        // ⚠️ 굵기 사다리(설계서 §2 TY1): 라벨은 500. 700 은 «희소 수치» 자리다.
        fontWeight: 500,
        lineHeight: 1.35,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </span>
  );
}

export interface ChipProps extends BadgeProps {
  onClick?: () => void;
  href?: string;
  selected?: boolean;
}

export function Chip({ children, tone = 'neutral', title, onClick, href, selected = false }: ChipProps) {
  const style: CSSProperties = {
    ...toneStyle(selected ? 'brand' : tone),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    // ⚠️ 누를 수 있는 것은 44px 이상이어야 한다(설계서 §2 고정값).
    //    시각 높이는 32px 로 두고 나머지를 «투명 패딩» 이 아니라 minHeight 로 확보한다.
    minHeight: 44,
    padding: '0 12px',
    borderRadius: 'var(--radius-pill)',
    fontSize: 'var(--fs-sm)',
    fontWeight: 500,
    lineHeight: 1.35,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    textDecoration: 'none',
  };

  const common = { 'data-ds': 'chip', 'data-ds-tone': selected ? 'brand' : tone, title, style } as const;

  if (href) return <a href={href} {...common}>{children}</a>;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} {...common}>
      {children}
    </button>
  );
}

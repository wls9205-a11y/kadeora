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
  /**
   * 치수. sm/md 는 DS 타입 사다리(--fs-xs/--fs-sm) 위에 있다.
   *
   * ⚠️ 'dense' 는 «사다리 밖» 이다 — 9.5px/800. 기존 목록 칩(.kd-lrow-badge)의 실물
   *    치수를 그대로 흡수하려고 둔다. DS 로 올리면 12px/500 이 되어 폰트 +26% ·
   *    굵기 3단계 하락이라 밀집 행의 리듬이 눈에 띄게 바뀐다.
   * ⛔ 새 화면에 dense 를 쓰지 말 것. 이건 «갈아타는 동안» 밀도를 보존하는 다리이고,
   *    사다리로 올릴지는 실화면 대조 뒤의 «별도 판정» 이다(설계서 §2-1 축).
   */
  size?: 'dense' | 'sm' | 'md';
  /** 스크린리더용 보충 설명. 색만으로 의미를 전달하지 않기 위한 자리다. */
  title?: string;
}

function toneStyle(tone: Tone): CSSProperties {
  const t = TONE[tone];
  return {
    color: `var(${t.fg})`,
    background: `var(${t.bg})`,
    // ⚠️ 테두리를 «항상» 1px 로 둔다(없으면 투명). 있고 없고로 높이가 1px 씩 달라지면
    //    목록에서 칩 바닥선이 흔들린다 — 설계서 §2-2 의 「칩 고정폭 스캔 라인」과 같은 축이다.
    border: t.border
      ? `1px ${t.borderStyle ?? 'solid'} var(${t.border})`
      : '1px solid transparent',
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
        padding: size === 'dense' ? '1px 5px' : size === 'sm' ? '2px 7px' : '4px 10px',
        borderRadius: size === 'dense' ? 3 : 'var(--radius-pill)',
        fontSize: size === 'dense' ? '9.5px' : size === 'sm' ? 'var(--fs-xs)' : 'var(--fs-sm)',
        // ⚠️ 굵기 사다리(설계서 §2 TY1): 라벨은 500. 700 은 «희소 수치» 자리다.
        //    dense 만 800 인데, 그건 흡수한 기존 목록 칩의 값이다(위 size 주석).
        fontWeight: size === 'dense' ? 800 : 500,
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

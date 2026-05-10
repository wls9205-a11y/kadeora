// s265 — Cascade tier badge.
// L1=region 매칭 (chip 표시 안 함, 기본 상태)
// L2=D-30 또는 시간 확장 (amber)
// L3=인접 지역 포함 (coral)
// L4=전국 (blue)

export type CascadeTier = 'L1' | 'L2' | 'L3' | 'L4';

const TIER_STYLE: Record<Exclude<CascadeTier, 'L1'>, { bg: string; fg: string; label: string }> = {
  L2: { bg: '#FAEEDA', fg: '#854F0B', label: 'D-30 확장' },
  L3: { bg: '#FAECE7', fg: '#993C1D', label: '인접 지역' },
  L4: { bg: '#E6F1FB', fg: '#0C447C', label: '전국' },
};

export function TierBadge({ tier }: { tier: CascadeTier }) {
  if (tier === 'L1') return null;
  const s = TIER_STYLE[tier];
  return (
    <span
      style={{
        display: 'inline-block',
        marginLeft: 6,
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 4,
        background: s.bg,
        color: s.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

// 헤더에 cascade tier 반영. base 의 괄호 표기 (예: "(D-7)") 는 L2/L3/L4 에서 제거.
export function headerForTier(base: string, tier: CascadeTier): string {
  const stripped = base.replace(/\s*\([^)]*\)\s*/g, '').trim();
  switch (tier) {
    case 'L1': return base;
    case 'L2': return `최근 ${stripped}`;
    case 'L3': return `${stripped} (인접 지역 포함)`;
    case 'L4': return `전국 ${stripped}`;
  }
}

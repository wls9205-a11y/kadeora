/**
 * 포맷터·헬퍼 모음
 *
 * 모든 탭이 공유하는 숫자·날짜·색상 변환 함수.
 */

import type { BadgeKind, ToneKind } from './types';

/* ============================================================
 * 가격 포맷
 * ============================================================ */

/**
 * 원 단위 → "1.24억" / "8,200만" / "1,234"
 */
export function formatKrwShort(won: number | null | undefined): string {
  if (won == null || isNaN(won)) return '-';
  if (won >= 1e8) {
    const eok = won / 1e8;
    return `${eok.toFixed(eok < 10 ? 2 : 1)}억`;
  }
  if (won >= 1e4) {
    return `${Math.round(won / 1e4).toLocaleString('ko-KR')}만`;
  }
  return won.toLocaleString('ko-KR');
}

/**
 * 평당 단가 → "1.45억" (원/평)
 */
export function formatPyeong(wonPerPyeong: number | null | undefined): string {
  return formatKrwShort(wonPerPyeong);
}

/* ============================================================
 * 변동률 포맷
 * ============================================================ */

/**
 * +1.5 / -3.2 → "+1.5%" / "-3.2%"
 */
export function formatPercent(
  pct: number | null | undefined,
  options: { includeSign?: boolean; decimals?: number } = {}
): string {
  const { includeSign = true, decimals = 1 } = options;
  if (pct == null || isNaN(pct)) return '-';
  const sign = includeSign && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

/**
 * 양수→positive, 음수→negative, 0/null→neutral
 */
export function deltaTone(value: number | null | undefined): ToneKind {
  if (value == null || isNaN(value)) return 'neutral';
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

/* ============================================================
 * 날짜 포맷
 * ============================================================ */

/**
 * ISO → "04.25"
 */
export function formatDateShort(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '-';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}.${day}`;
}

/**
 * ISO → "2026-10-25"
 */
export function formatDateISO(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '-';
  return d.toISOString().slice(0, 10);
}

/**
 * deadline ISO → days from now
 */
export function dDayFrom(iso: string | Date | null | undefined): number {
  if (!iso) return 0;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

/* ============================================================
 * 배지 컬러 매핑
 * ============================================================ */

export const BADGE_VARS: Record<BadgeKind, { bg: string; fg: string }> = {
  pink: { bg: 'var(--aptr-badge-pink-bg)', fg: 'var(--aptr-badge-pink-fg)' },
  amber: { bg: 'var(--aptr-badge-amber-bg)', fg: 'var(--aptr-badge-amber-fg)' },
  green: { bg: 'var(--aptr-badge-green-bg)', fg: 'var(--aptr-badge-green-fg)' },
  gray: { bg: 'var(--aptr-badge-gray-bg)', fg: 'var(--aptr-badge-gray-fg)' },
  red: { bg: 'var(--aptr-badge-red-bg)', fg: 'var(--aptr-badge-red-fg)' },
  blue: { bg: 'var(--aptr-badge-blue-bg)', fg: 'var(--aptr-badge-blue-fg)' },
};

/**
 * D-day 숫자 → 배지 종류
 *  D-3 이내 = pink, D-10 이내 = amber, 이상 = gray
 */
export function dDayBadgeKind(dDay: number): BadgeKind {
  if (dDay <= 3) return 'pink';
  if (dDay <= 10) return 'amber';
  return 'gray';
}

/**
 * tone → CSS color var
 */
export function toneToColor(tone: ToneKind | undefined): string {
  switch (tone) {
    case 'positive':
      return 'var(--aptr-positive)';
    case 'negative':
      return 'var(--aptr-negative)';
    default:
      return 'var(--aptr-text-primary)';
  }
}

/* ============================================================
 * 재개발 단계
 * ============================================================ */

export const REDEV_PHASES = [
  { id: 'planning', label: '정비계획' },
  { id: 'union', label: '조합설립' },
  { id: 'project', label: '사업시행' },
  { id: 'management', label: '관리처분' },
  { id: 'demolition', label: '이주·철거' },
  { id: 'construction', label: '착공' },
  { id: 'completion', label: '완공' },
] as const;

export function phaseIndex(phaseId: string): number {
  return REDEV_PHASES.findIndex((p) => p.id === phaseId);
}

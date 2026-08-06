// src/lib/apt/subscription-badge.ts — s273
// 청약 상태 배지의 표시 토큰. Architecture Rule #83: 컴포넌트 안에 hex 직접 사용 금지.
// Rule #94: hex 는 소문자 + var() 우선.

import type { CSSProperties } from 'react';
import {
  STATUS_LABEL,
  STATUS_TONE,
  type SubscriptionStatus,
} from '@/lib/apt/subscription-status';

type Tone = (typeof STATUS_TONE)[SubscriptionStatus];

const TONE_STYLE: Record<Tone, { bg: string; fg: string; border: string }> = {
  red:    { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
  amber:  { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  blue:   { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  green:  { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' },
  purple: { bg: '#f5f3ff', fg: '#6d28d9', border: '#ddd6fe' },
  gray:   { bg: '#f9fafb', fg: '#4b5563', border: '#e5e7eb' },
};

export function statusBadgeStyle(status: SubscriptionStatus): CSSProperties {
  const t = TONE_STYLE[STATUS_TONE[status]];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 7px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.border}`,
  };
}

export function statusLabel(status: SubscriptionStatus): string {
  return STATUS_LABEL[status];
}

/**
 * D-day 라벨. 상태마다 세는 대상이 달라 접미사를 붙여 무엇까지 남았는지 드러낸다.
 * ("D-4" 만 있으면 접수 시작인지 마감인지 알 수 없다.)
 */
export function ddayLabel(status: SubscriptionStatus, dday: number | null): string | null {
  if (dday === null || dday === undefined) return null;

  const suffix: Partial<Record<SubscriptionStatus, string>> = {
    open: '마감',
    upcoming: '접수',
    scheduled: '접수',
    announced_wait: '발표',
    contract: '계약마감',
  };
  const what = suffix[status];
  if (!what) return null;

  if (dday < 0) return null;
  if (dday === 0) return `오늘 ${what}`;
  return `${what} D-${dday}`;
}

/** D-day 가 임박할수록 강한 톤. 카드 우측 D-day 칩에 사용. */
export function ddayStyle(dday: number | null): CSSProperties {
  const urgent = dday !== null && dday <= 3;
  const soon = dday !== null && dday <= 7;
  return {
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    color: urgent ? '#b91c1c' : soon ? '#b45309' : 'var(--text-secondary, #6b7280)',
  };
}

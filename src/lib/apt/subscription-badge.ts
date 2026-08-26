// src/lib/apt/subscription-badge.ts — s273
// 청약 상태 배지의 표시 토큰. Architecture Rule #83: 컴포넌트 안에 hex 직접 사용 금지.
// Rule #94: hex 는 소문자 + var() 우선.

import type { CSSProperties } from 'react';
import {
  STATUS_LABEL,
  type SubscriptionStatus,
} from '@/lib/apt/subscription-status';

/**
 * s2 — 배지 색을 토큰으로. hex 직접 사용 0건 (Architecture Rule #83).
 * 상태 토큰 매핑: 접수중 --status-open · 임박 --status-soon ·
 * 선착순(무순위) --status-fcfs · 마감 --status-closed.
 */
const STATUS_STYLE: Record<SubscriptionStatus, { bg: string; fg: string; border: string }> = {
  open:           { bg: 'var(--accent-green-bg)',  fg: 'var(--status-open)',   border: 'var(--accent-green-border)' },
  upcoming:       { bg: 'var(--accent-orange-bg)', fg: 'var(--status-soon)',   border: 'var(--border)' },
  scheduled:      { bg: 'var(--accent-blue-bg)',   fg: 'var(--accent-blue)',   border: 'var(--border)' },
  announced_wait: { bg: 'var(--accent-purple-bg)', fg: 'var(--accent-purple)', border: 'var(--border)' },
  contract:       { bg: 'var(--accent-green-bg)',  fg: 'var(--accent-green)',  border: 'var(--accent-green-border)' },
  leftover:       { bg: 'var(--brand-bg)',         fg: 'var(--status-fcfs)',   border: 'var(--brand-border)' },
  closed:         { bg: 'var(--bg-elevated)',      fg: 'var(--status-closed)', border: 'var(--border)' },
};

export function statusBadgeStyle(status: SubscriptionStatus): CSSProperties {
  const t = STATUS_STYLE[status];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 7px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
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
    fontWeight: 500,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
    color: urgent ? 'var(--accent-red)' : soon ? 'var(--status-soon)' : 'var(--text-secondary)',
  };
}

/**
 * v3 커밋5 — 목록 행 좌측 상태 칩 (.kd-lrow-k).
 *
 * 기존 D-day 칩은 8건 중 5건이 '상시' 라 정보가 0이었다. 상태를 먼저 말하고,
 * 실제로 날짜가 임박한 건에서만 D-n 으로 바꾼다.
 *
 * 반환 tone 은 .kd-lrow-k 의 변형 클래스명과 1:1 이다 (is-hot/is-on/is-rest/is-soon).
 */
export function rowStatusChip(
  status: SubscriptionStatus,
  dday: number | null,
): { label: string; tone: '' | 'is-hot' | 'is-on' | 'is-rest' | 'is-soon' } {
  // 무순위·선착순은 날짜가 아니라 성격이 정보다.
  if (status === 'leftover') return { label: '무순', tone: 'is-rest' };

  const near = dday !== null && dday >= 0 && dday <= 7;
  if (near) {
    const label = dday === 0 ? 'D-Day' : `D-${dday}`;
    return { label, tone: dday! <= 3 ? 'is-hot' : 'is-soon' };
  }

  if (status === 'open') return { label: '접수중', tone: 'is-on' };
  if (status === 'upcoming' || status === 'scheduled') return { label: '예정', tone: 'is-soon' };
  if (status === 'announced_wait') return { label: '발표', tone: 'is-soon' };
  if (status === 'contract') return { label: '계약', tone: 'is-on' };
  return { label: '마감', tone: '' };
}

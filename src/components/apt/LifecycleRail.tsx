// s2 — 분양 진행 눈금자(레일).
//
// 단계 판정은 저장값을 그대로 믿지 않는다.
//   1) apt_subscriptions 날짜가 있으면 날짜에서 파생 (아래 deriveStageFromDates)
//   2) 없으면 apt_sites.lifecycle_stage 사용
//   3) 둘 다 없으면 렌더하지 않는다 (빈 레일 금지)
//
// lifecycle_stage 는 매일 06:23 KST 크론(lifecycle-stage-refresh)이 갱신하지만
// 하루 한 번이라 접수 마감 당일 같은 경계에서 최대 24시간 어긋난다.
// 날짜가 있으면 날짜가 항상 더 정확하다.
//
// 날짜 비교는 전부 'YYYY-MM-DD' 문자열 사전순. Date 객체는 UTC/KST 하루 밀림이 있다
// (src/lib/apt/subscription-status.ts 규약과 동일).

import React from 'react';
import { toDateKey, todayKST } from '@/lib/apt/subscription-status';

/** 표시 7칸. 내부 단계는 이보다 많고, STAGE_CELL 로 칸에 접힌다. */
const CELLS = ['계획', '예고', '모델', '청약', '발표', '계약', '입주'] as const;

/** 내부 단계 → 표시 칸 인덱스. 여기 없는 단계는 청약 라인이 아니므로 레일 미표시. */
const STAGE_CELL: Record<string, number> = {
  site_planning: 0,
  pre_announcement: 1,
  model_house_open: 2,
  special_supply: 3,
  subscription_open: 3,
  award_announced: 4,
  contract_signing: 5,
  move_in_ready: 6,
  move_in_started: 6,
  post_move_in: 6,
};

/**
 * 청약 라인이 아닌 site_type — 레일을 그리지 않는다.
 * 미분양/랜드마크/실거래/재개발은 "분양 진행 단계"라는 축 자체가 없다.
 */
const NON_SUBSCRIPTION_STAGES = new Set([
  'unsold_active',
  'landmark_active',
  'active_trade',
  'redevelopment_active',
]);

export interface RailDates {
  rcept_bgnde?: string | null;         // 1순위 접수 시작
  rcept_endde?: string | null;         // 접수 마감
  spsply_rcept_bgnde?: string | null;  // 특별공급 접수 시작
  przwner_presnatn_de?: string | null; // 당첨자 발표일
  cntrct_cncls_bgnde?: string | null;  // 계약 시작
  cntrct_cncls_endde?: string | null;  // 계약 종료
  mvn_prearnge_ym?: string | null;     // 입주예정월 (YYYYMM / YYYY-MM / YYYY-MM-DD)
}

/** 입주예정월을 'YYYY-MM' 으로 정규화. 6자리(YYYYMM) 표기도 수용. */
export function toMonthKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{6}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
  const head = s.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(head) ? head : null;
}

/**
 * 날짜 → 단계. DB 함수(lifecycle-stage-refresh)와 동일 규칙.
 * 판정 순서가 곧 우선순위다.
 */
export function deriveStageFromDates(
  dates: RailDates,
  today: string = todayKST(),
): string | null {
  const thisMonth = today.slice(0, 7);
  const moveIn = toMonthKey(dates.mvn_prearnge_ym);
  const rcept1 = toDateKey(dates.rcept_bgnde);
  const special = toDateKey(dates.spsply_rcept_bgnde);
  const start = rcept1 && special ? (special < rcept1 ? special : rcept1) : (rcept1 ?? special);
  const announce = toDateKey(dates.przwner_presnatn_de);
  const contractStart = toDateKey(dates.cntrct_cncls_bgnde);
  const contractEnd = toDateKey(dates.cntrct_cncls_endde);
  const end = toDateKey(dates.rcept_endde);

  if (moveIn && moveIn < thisMonth) return 'post_move_in';
  if (moveIn && moveIn === thisMonth) return 'move_in_started';
  if (contractEnd && today > contractEnd) return 'move_in_ready';
  if (contractStart && today >= contractStart) return 'contract_signing';
  if (announce && today >= announce) return 'award_announced';
  if (start && today < start) return 'pre_announcement';

  // 그 외 = 접수기간 중. 단, 판정 근거가 될 날짜가 하나도 없으면 파생 불가.
  if (!start && !end && !announce && !contractStart && !contractEnd) return null;

  // 접수는 끝났는데 발표·계약·입주 날짜가 하나도 없으면 그 뒤를 알 수 없다.
  // 여기서 subscription_open 을 반환하면 마감된 단지를 '청약중'으로 칠하게 되므로
  // 파생을 포기하고 저장된 lifecycle_stage 로 넘긴다.
  if (end && today > end && !announce && !contractStart && !contractEnd && !moveIn) return null;

  return 'subscription_open';
}

/** 최종 단계 결정. 날짜 우선, 없으면 저장된 lifecycle_stage. */
export function resolveStage(
  stage: string | null | undefined,
  dates?: RailDates,
  today: string = todayKST(),
): string | null {
  const derived = dates ? deriveStageFromDates(dates, today) : null;
  return derived ?? (stage || null);
}

export interface LifecycleRailProps {
  /** apt_sites.lifecycle_stage. 날짜가 없을 때만 쓰인다. */
  stage: string | null;
  /** apt_subscriptions 날짜. 있으면 이쪽에서 파생한 단계가 우선. */
  dates?: RailDates;
  size?: 'mini' | 'full';
  /** 입주 칸 라벨 대체 (예: '26년 3월'). 미지정 시 '입주'. */
  moveInLabel?: string;
}

export default function LifecycleRail({
  stage,
  dates,
  size = 'mini',
  moveInLabel,
}: LifecycleRailProps) {
  const resolved = resolveStage(stage, dates);

  // 빈 레일 금지 — 단계를 모르거나 청약 라인이 아니면 아무것도 그리지 않는다.
  if (!resolved) return null;
  if (NON_SUBSCRIPTION_STAGES.has(resolved)) return null;

  const active = STAGE_CELL[resolved];
  if (active === undefined) return null;

  const labels = CELLS.map((c, i) => (i === CELLS.length - 1 && moveInLabel ? moveInLabel : c));
  const height = size === 'full' ? 'var(--rail-h-lg)' : 'var(--rail-h)';
  const ariaLabel = `분양 진행 단계: ${CELLS[active]} (${CELLS.length}단계 중 ${active + 1}번째)`;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="lc-rail"
      style={{ display: 'flex', flexDirection: 'column', gap: size === 'full' ? 6 : 4 }}
    >
      <div style={{ display: 'flex', gap: 3 }} aria-hidden="true">
        {CELLS.map((c, i) => (
          <span
            key={c}
            className="lc-rail-seg"
            style={{
              flex: 1,
              height,
              borderRadius: 1,
              background:
                i < active
                  ? 'var(--rail-done)'
                  : i === active
                    ? 'var(--rail-now)'
                    : 'var(--rail-todo)',
            }}
          />
        ))}
      </div>

      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: size === 'full' ? 10.5 : 9.5,
          letterSpacing: '.02em',
          color: 'var(--text-tertiary)',
        }}
      >
        {size === 'full' ? (
          labels.map((label, i) => (
            <span
              key={CELLS[i]}
              style={{
                flex: 1,
                textAlign: i === 0 ? 'left' : i === labels.length - 1 ? 'right' : 'center',
                color: i === active ? 'var(--rail-now)' : undefined,
                fontWeight: i === active ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          ))
        ) : (
          <>
            <span style={{ color: active === 0 ? 'var(--rail-now)' : undefined }}>{labels[0]}</span>
            <span style={{ color: active === CELLS.length - 1 ? 'var(--rail-now)' : undefined }}>
              {labels[labels.length - 1]}
            </span>
          </>
        )}
      </div>

      <style>{`
        .lc-rail-seg { transition: background 0.2s ease; }
        @media (prefers-reduced-motion: reduce) {
          .lc-rail-seg { transition: none; }
        }
      `}</style>
    </div>
  );
}

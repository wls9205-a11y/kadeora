// [S10-2] admin_alerts 심각도 정규화 — 표시 전용.
//
// DB 의 severity 어휘는 info·low·medium·high·warning·error·critical 7종으로 깨져 있다.
// 쓰는 쪽이 DB 함수 2개(check_seo_automation_health / check_signup_zero_alert)와
// cron-logger 로 나뉘어 있어 어휘가 갈렸다.
//
// ⚠️ admin_alerts 행을 UPDATE 해서 값을 정리하지 말 것. 크론 쓰기 코드도 손대지 않는다.
//    정규화는 표시 계층에서만 한다 — DB 를 건드리면 과거 경보의 원래 심각도가 사라진다.
//
// ⚠️ 트리아지 신호는 `archived` 다. `is_read` 는 1,009건 전량 미읽음이라 정보량이 0이고,
//    아카이브 크론 2개(04:13 / 18:36)가 14일 경과분을 archived 로 넘긴다.

export type AlertLevel = 'critical' | 'warning' | 'info';

/** 정규화 레벨 → DB 원본 severity 값. info 는 catch-all 이라 목록이 아니라 여집합으로 다룬다. */
export const SEVERITY_RAW: Record<Exclude<AlertLevel, 'info'>, string[]> = {
  critical: ['critical', 'error', 'high'],
  warning: ['warning', 'medium'],
};

/** critical·warning 에 속하는 모든 원본 값. info 필터는 이 집합의 여집합으로 만든다. */
export const NON_INFO_RAW = [...SEVERITY_RAW.critical, ...SEVERITY_RAW.warning];

export function normalizeSeverity(raw: string | null): AlertLevel {
  const s = (raw ?? '').toLowerCase();
  if (SEVERITY_RAW.critical.includes(s)) return 'critical';
  if (SEVERITY_RAW.warning.includes(s)) return 'warning';
  return 'info'; // info, low, 그 외 미지의 값
}

export function isAlertLevel(v: string | null): v is AlertLevel {
  return v === 'critical' || v === 'warning' || v === 'info';
}

/** 배지 표기 — globals.css 에 정의된 토큰만 쓴다 (신설 금지). */
export const LEVEL_STYLE: Record<AlertLevel, { label: string; color: string; bg: string }> = {
  critical: { label: '심각', color: 'var(--accent-red)', bg: 'var(--accent-red-bg)' },
  warning: { label: '주의', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  info: { label: '정보', color: 'var(--text-tertiary)', bg: 'var(--bg-hover)' },
};

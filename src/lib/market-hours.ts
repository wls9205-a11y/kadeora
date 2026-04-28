// KST(Asia/Seoul) 기준 요일 / 주말 / 시장 운영 판정.
// 클라이언트(브라우저 TZ) 또는 서버(UTC)에서도 항상 KST 로 환산해 같은 결과를 낸다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toKstDate(d: Date = new Date()): Date {
  return new Date(d.getTime() + (d.getTimezoneOffset() * 60_000) + KST_OFFSET_MS);
}

/** KST 요일 (0=일, 1=월, ..., 6=토) */
export function kstWeekday(d: Date = new Date()): number {
  return toKstDate(d).getUTCDay();
}

/** KST 기준 주말 여부 — 일(0) 또는 토(6) 만 true */
export function isKstWeekend(d: Date = new Date()): boolean {
  const w = kstWeekday(d);
  return w === 0 || w === 6;
}

/** KST 기준 평일 여부 (월~금) */
export function isKstWeekday(d: Date = new Date()): boolean {
  return !isKstWeekend(d);
}

/** KST 요일 한글 ('일'..'토') */
export function kstWeekdayLabel(d: Date = new Date()): string {
  return ['일', '월', '화', '수', '목', '금', '토'][kstWeekday(d)];
}

/** 한국(KOSPI/KOSDAQ) 정규장 운영 여부 — 평일 09:00~15:30 KST. 공휴일은 별도 처리 안 함. */
export function isKrxOpen(d: Date = new Date()): boolean {
  if (isKstWeekend(d)) return false;
  const k = toKstDate(d);
  const h = k.getUTCHours();
  const m = k.getUTCMinutes();
  const minutes = h * 60 + m;
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 30;
}

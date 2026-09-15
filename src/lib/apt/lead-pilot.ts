/**
 * E-12 — 리드폼 선택 필드 파일럿 (판정회신 ABG 증분 6 §2 · 2026-09-15).
 *
 * 무엇: 실험군 현장의 폼에만 «선택 입력» 두 칸(예산 범위 · 통화 가능 시간)을 더한다.
 * 배정: 현장 slug 해시 절반 — 같은 현장은 누구에게나 같은 군이다(방문자 해시로 가르면 같은 현장 응대가 섞인다).
 * 판정 축: user_events apt_lead_form 의 lead_form_start → lead_form_submit 전환율(properties.pilot_arm).
 * 회수: DB fn_e12_pilot_guard(pg_cron 182)가 3일 연속 20%p+ 열세면 app_config e12.pilot_enabled=false.
 *
 * ⛔ 필수화 금지(마찰 최소). ⛔ 값은 시트로 보내지 않는다 — Apps Script 가 모르는 필드는 버려진다. 자체 테이블(leadRef 키)만.
 * ⚠️ 홈 폼(slug 없음)은 파일럿 밖이다.
 */

export type LeadPilotArm = 'exp' | 'ctrl';

export const LEAD_PILOT_API = '/api/lead-pilot';

export const BUDGET_CHOICES = ['3억 미만', '3억~5억', '5억~7억', '7억~10억', '10억 이상', '아직 모르겠어요'] as const;
export const CALL_TIME_CHOICES = ['오전(9~12시)', '오후(12~18시)', '저녁(18~21시)', '언제든 괜찮아요'] as const;

/** FNV-1a 32bit — 현장 slug → 군. 결정적이고 서버·클라이언트가 같은 값을 낸다. */
export function leadPilotArm(slug: string | null | undefined): LeadPilotArm | null {
  if (!slug) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 2 === 0 ? 'exp' : 'ctrl';
}

export const isBudgetChoice = (v: unknown): v is (typeof BUDGET_CHOICES)[number] => typeof v === 'string' && (BUDGET_CHOICES as readonly string[]).includes(v);
export const isCallTimeChoice = (v: unknown): v is (typeof CALL_TIME_CHOICES)[number] => typeof v === 'string' && (CALL_TIME_CHOICES as readonly string[]).includes(v);

/**
 * A2 (2026-08-27) — 크론의 «조용한 DB 실패» 를 보이게 한다.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────────
 * supabase-js 는 DB 오류에 «예외를 던지지 않는다». `{ data, error }` 를 돌려줄 뿐이다.
 * 그래서 이렇게 쓰면 실패가 흔적 없이 사라진다.
 *
 *     await sb.from('issue_alerts').update({ ... }).eq('id', id);   // ← error 를 안 받는다
 *
 * 크론은 그대로 「성공」으로 끝나고 cron_logs 에도 아무것도 안 남는다.
 * 이 저장소는 같은 침묵으로 넉 달을 잃은 이력이 있다(`contact_tel` 133건 전량).
 * 이슈 파이프라인의 ai_failed 1,892건이 무기록인 것도 같은 계열이다.
 *
 * ── 무엇을 바꾸지 «않는가» ───────────────────────────────────────────────────
 * ⛔ 반환값도 흐름도 그대로다. dbw() 는 받은 것을 그대로 돌려준다.
 *    실패해도 던지지 않는다 — 던지면 동작이 바뀐다. 「보이게 만들기」만 한다.
 *
 * ── 수집 범위 ────────────────────────────────────────────────────────────────
 * ⚠️ 수집기는 «크론 이름별» 모듈 전역이다. 서버리스 인스턴스 하나에서 같은 크론이
 *    동시에 두 번 돌면 오류가 섞일 수 있다. 그래도 «어느 크론인지» 는 틀리지 않는다.
 *    실행 단위 정밀도보다 「실패가 보이는 것」이 먼저다.
 */

type Res = { error?: { message?: string; code?: string } | null } | null | undefined;

const buckets = new Map<string, string[]>();

/** withCronLogging 시작 시 호출 — 이전 실행의 잔여를 버린다. */
export function resetDbErrors(cronName: string): void {
  buckets.delete(cronName);
}

/** 수집된 오류를 꺼내 간다(꺼내면 비운다). */
export function takeDbErrors(cronName: string): string[] {
  const v = buckets.get(cronName) ?? [];
  buckets.delete(cronName);
  return v;
}

/**
 * DB 쓰기 결과를 «통과시키면서» 오류만 기록한다.
 *
 *     dbw('issue-draft', 'issue_alerts.update@533', await sb.from(...).update(...))
 *
 * @param label 어디서 났는지. `테이블.동작@줄번호` 로 적는다 — 줄 번호가 있어야
 *              로그만 보고 코드로 바로 간다.
 */
export function dbw<T extends Res>(cronName: string, label: string, res: T): T {
  const err = res?.error;
  if (err) {
    const msg = `${label}: ${String(err.code ?? '')} ${String(err.message ?? '')}`.trim().slice(0, 200);
    console.error(`[${cronName}] db-write 실패 — ${msg}`);
    const arr = buckets.get(cronName) ?? [];
    if (arr.length < 20) arr.push(msg);          // 폭주 방어. 20개면 패턴은 이미 보인다
    buckets.set(cronName, arr);
  }
  return res;
}

/**
 * OAuth 시작 행 기록 — 두 진입점(/login · SignupNudgeModal)이 «같은 순서» 로 쓰게 한다.
 *
 * SU A-2 (2026-09-05): 순서가 결함이었다.
 *   기존: fetch(track-attempt) 를 던지고 곧바로 signInWithOAuth → 리디렉트가 먼저
 *   일어나 시작 행이 늦게 앉거나 유실 → 콜백이 못 찾고 새 행을 만든다(고아 콜백 3/8).
 *   지금: 응답을 «기다렸다가» 리디렉트한다. 응답에 실린 Set-Cookie(kd_att) 가
 *   콜백의 1순위 매칭 키다.
 *
 * ⛔ 무한정 기다리지 않는다. 상한 안에 응답이 없으면 쿠키 없이 진행하고 콜백의
 *    폴백 매처(provider·ip_hash·15분)가 받는다. 계측이 로그인을 막으면 안 된다.
 * ⛔ abort 하지 않는다 — abort 는 서버의 insert 자체를 죽여 «고치려던 결함» 을
 *    다시 만든다. keepalive 로 백그라운드에 남겨 두고 우리만 먼저 간다.
 */
const WAIT_MS = 300;

export interface SignupAttemptPayload {
  provider: 'kakao' | 'google';
  source: string;
  redirect_path?: string;
  success?: boolean;
  error_message?: string;
}

export async function startSignupAttempt(p: SignupAttemptPayload): Promise<void> {
  if (typeof window === 'undefined') return;
  const req = fetch('/api/auth/track-attempt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ success: false, ...p }),
  }).catch(() => {});
  await Promise.race([req, new Promise<void>((r) => setTimeout(r, WAIT_MS))]);
}

/** 실패 사유 등 «시작 이후» 기록 — 리디렉트가 없으므로 기다리지 않는다. */
export function reportSignupAttempt(p: SignupAttemptPayload): void {
  if (typeof window === 'undefined') return;
  fetch('/api/auth/track-attempt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ success: false, ...p }),
  }).catch(() => {});
}

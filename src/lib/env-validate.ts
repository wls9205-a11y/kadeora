// 환경변수 검증 — 서버 시작 시 필수 키 누락 감지
const REQUIRED_SERVER = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const OPTIONAL_SERVER = [
  'CRON_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KIS_APP_KEY',
  'KIS_APP_SECRET',
  'NEXT_PUBLIC_KAKAO_JS_KEY',
  'ANTHROPIC_API_KEY',
  'NEXT_PUBLIC_TOSS_CLIENT_KEY',
  'TOSS_SECRET_KEY',
] as const;

let validated = false;

export function validateEnv() {
  if (validated) return;
  validated = true;

  const missing: string[] = [];
  for (const key of REQUIRED_SERVER) {
    if (!process.env[key]) missing.push(key);
  }

  if (missing.length > 0) {
    console.error(`[env] ❌ 필수 환경변수 누락: ${missing.join(', ')}`);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`필수 환경변수 누락: ${missing.join(', ')}`);
    }
  }

  const warnings: string[] = [];
  for (const key of OPTIONAL_SERVER) {
    if (!process.env[key]) warnings.push(key);
  }
  if (warnings.length > 0) {
    console.warn(`[env] ⚠️ 선택 환경변수 미설정: ${warnings.join(', ')}`);
  }
}

// 안전한 환경변수 접근 (! 대신 사용)
export function env(key: string): string {
  const val = process.env[key];
  if (!val) {
    console.error(`[env] 환경변수 "${key}" 없음`);
    return '';
  }
  return val;
}

// 환경변수 검증 — 서버 시작 시 필수 키 누락 감지
const REQUIRED_SERVER = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

// globalThis 사용 — serverless 환경에서도 콜드스타트당 1회만 실행
const VALIDATED_KEY = '__kd_env_validated';

export function validateEnv() {
  if ((globalThis as any)[VALIDATED_KEY]) return;
  (globalThis as any)[VALIDATED_KEY] = true;

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
  // 선택 환경변수는 로깅하지 않음 (serverless 환경에서 매 콜드스타트마다 불필요한 warning 발생)
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

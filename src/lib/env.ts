import { z } from "zod";

/**
 * 환경변수 스키마 정의 — 누락 시 빌드/시작 시점에 즉시 에러
 * Torvalds: "process.env!는 버그를 감추는 행위"
 * Theo: "t3-env 패턴으로 빌드 타임 검증"
 */

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY is required"),
  TOSS_SECRET_KEY: z.string().min(1, "TOSS_SECRET_KEY is required"),
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 chars"),
  UPSTASH_REDIS_REST_URL: z.string().url("UPSTASH_REDIS_REST_URL must be a valid URL"),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, "UPSTASH_REDIS_REST_TOKEN is required"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_SITE_URL: z.string().url("NEXT_PUBLIC_SITE_URL must be a valid URL"),
  NEXT_PUBLIC_KAKAO_JS_KEY: z.string().optional(),
});

/** Validated server environment — use this instead of process.env directly */
function validateServerEnv() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ✗ ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`\n❌ Missing/invalid server environment variables:\n${formatted}\n`);
  }
  return result.data;
}

/** Validated client environment */
function validateClientEnv() {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_KAKAO_JS_KEY: process.env.NEXT_PUBLIC_KAKAO_JS_KEY,
  });
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ✗ ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`\n❌ Missing/invalid client environment variables:\n${formatted}\n`);
  }
  return result.data;
}

export const serverEnv = typeof window === "undefined" ? validateServerEnv() : ({} as z.infer<typeof serverSchema>);
export const clientEnv = validateClientEnv();

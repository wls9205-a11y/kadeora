// ✅ v3.0 — Dr. Kim Zetter 피드백: 인메모리 Map → Upstash Redis
// 서버리스 환경에서 분산 rate limiting 보장
// Lazy init: 빌드 타임에 env 없어도 안전

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

type LimiterKey = "otp" | "otpHourly" | "chat" | "api" | "bugReport" | "search";

const limiterConfigs: Record<LimiterKey, { window: number; unit: string; limit: number; prefix: string }> = {
  otp: { window: 60, unit: "s", limit: 3, prefix: "rl:otp" },
  otpHourly: { window: 3600, unit: "s", limit: 10, prefix: "rl:otp-h" },
  chat: { window: 60, unit: "s", limit: 30, prefix: "rl:chat" },
  api: { window: 60, unit: "s", limit: 60, prefix: "rl:api" },
  bugReport: { window: 60, unit: "s", limit: 5, prefix: "rl:bug" },
  search: { window: 60, unit: "s", limit: 30, prefix: "rl:search" },
};

const _limiters: Partial<Record<LimiterKey, Ratelimit>> = {};

function getLimiter(key: LimiterKey): Ratelimit {
  if (!_limiters[key]) {
    const cfg = limiterConfigs[key];
    _limiters[key] = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(cfg.limit, `${cfg.window} ${cfg.unit}`),
      prefix: cfg.prefix,
    });
  }
  return _limiters[key]!;
}

export async function checkRateLimit(
  limiterKey: LimiterKey,
  identifier: string
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const { success, remaining } = await getLimiter(limiterKey).limit(identifier);
    return { allowed: success, remaining };
  } catch {
    return { allowed: true, remaining: 999 };
  }
}

export async function detectSpam(userId: string, message: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const key = `spam:${userId}`;
    const raw = await redis.get<string>(key);
    const recentMessages: string[] = raw ? JSON.parse(raw) : [];
    const duplicateCount = recentMessages.filter((m) => m === message).length;
    if (duplicateCount >= 3) return true;
    if (recentMessages.length >= 10) return true;
    recentMessages.push(message);
    if (recentMessages.length > 20) recentMessages.shift();
    await redis.set(key, JSON.stringify(recentMessages), { ex: 300 });
    return false;
  } catch {
    return false;
  }
}

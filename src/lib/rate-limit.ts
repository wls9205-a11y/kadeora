// ✅ v3.0 — Dr. Kim Zetter 피드백: 인메모리 Map → Upstash Redis
// 서버리스 환경에서 분산 rate limiting 보장

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const rateLimiters = {
  otp: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "60 s"), prefix: "rl:otp" }),
  otpHourly: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "3600 s"), prefix: "rl:otp-h" }),
  chat: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "60 s"), prefix: "rl:chat" }),
  api: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "60 s"), prefix: "rl:api" }),
  bugReport: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "60 s"), prefix: "rl:bug" }),
  search: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "60 s"), prefix: "rl:search" }),
} as const;

export async function checkRateLimit(
  limiterKey: keyof typeof rateLimiters,
  identifier: string
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const { success, remaining } = await rateLimiters[limiterKey].limit(identifier);
    return { allowed: success, remaining };
  } catch {
    return { allowed: true, remaining: 999 };
  }
}

export async function detectSpam(userId: string, message: string): Promise<boolean> {
  try {
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

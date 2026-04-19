/**
 * [ADMIN] Upstash Redis 크론 lock 일괄 삭제
 *
 * 인증: verifyCronAuth (Bearer CRON_SECRET / PG_CRON_SHARED_SECRET) or requireAdmin
 * 쿼리: ?pattern=cronlock:* (기본) — 필요 시 ?pattern=lock:* 등으로 override
 *
 * 동작:
 *   1) KEYS <pattern> 으로 매칭 key 전부 조회
 *   2) 각 key 개별 DEL (Upstash REST 는 MDEL 미지원)
 *   3) { deleted_count, keys[] } 반환
 *
 * 비상 용도: cron 락 누수로 skipped 가 계속 떨어질 때 수동 clear.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function authGate(req: NextRequest): Promise<{ ok: boolean; via: 'cron' | 'admin'; error?: NextResponse }> {
  if (verifyCronAuth(req as any)) return { ok: true, via: 'cron' };
  const auth = await requireAdmin();
  if ('error' in auth) return { ok: false, via: 'admin', error: auth.error };
  return { ok: true, via: 'admin' };
}

async function handler(req: NextRequest) {
  const gate = await authGate(req);
  if (!gate.ok) return gate.error!;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return NextResponse.json(
      { error: 'UPSTASH_REDIS_REST_URL / _TOKEN 미설정' },
      { status: 500 },
    );
  }

  const pattern = req.nextUrl.searchParams.get('pattern') || 'cronlock:*';
  const dryRun = req.nextUrl.searchParams.get('dry_run') === 'true';

  try {
    // 1) KEYS <pattern>
    const keysRes = await fetch(`${url}/keys/${encodeURIComponent(pattern)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!keysRes.ok) {
      const body = await keysRes.text().catch(() => '');
      return NextResponse.json(
        { error: `KEYS failed: ${keysRes.status}`, body: body.slice(0, 300) },
        { status: 502 },
      );
    }
    const keysBody = await keysRes.json();
    const keys: string[] = Array.isArray(keysBody?.result) ? keysBody.result : [];

    if (keys.length === 0) {
      return NextResponse.json({
        pattern,
        deleted_count: 0,
        keys: [],
        dry_run: dryRun,
        via: gate.via,
        note: 'no matching keys',
      });
    }

    if (dryRun) {
      return NextResponse.json({
        pattern,
        deleted_count: 0,
        keys,
        dry_run: true,
        via: gate.via,
        note: 'dry_run=true → DEL skipped',
      });
    }

    // 2) 각 key 개별 DEL (병렬, 200개 청크)
    const CHUNK = 50;
    let deleted = 0;
    const failures: { key: string; err: string }[] = [];
    for (let i = 0; i < keys.length; i += CHUNK) {
      const chunk = keys.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map(async (key) => {
          const r = await fetch(`${url}/del/${encodeURIComponent(key)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          if (!r.ok) throw new Error(`${r.status}`);
          const b = await r.json().catch(() => ({ result: 0 }));
          return { key, n: Number(b?.result || 0) };
        }),
      );
      for (let k = 0; k < results.length; k++) {
        const r = results[k];
        if (r.status === 'fulfilled') {
          deleted += r.value.n;
        } else {
          failures.push({ key: chunk[k], err: String(r.reason?.message || r.reason || 'unknown').slice(0, 100) });
        }
      }
    }

    return NextResponse.json({
      pattern,
      deleted_count: deleted,
      keys,
      failed: failures.length,
      failures: failures.slice(0, 10),
      dry_run: false,
      via: gate.via,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'unknown', stack: err?.stack?.split('\n').slice(0, 3) },
      { status: 500 },
    );
  }
}

export const GET = handler;
export const POST = handler;

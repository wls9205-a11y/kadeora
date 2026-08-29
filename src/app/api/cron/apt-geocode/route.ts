import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * 신규 현장 «지오코딩» — 좌표 파이프라인의 «첫 칸» (2026-08-29 신설).
 *
 * ── 왜 신설인가 ─────────────────────────────────────────────────────────────
 * 좌표를 «채우는» 크론이 아예 없었다. 있는 것은 전부 «좌표가 이미 있어야» 도는 것들이다:
 *   · apt-enrich-location   `.not('latitude','is',null)`  ← 인근역·학교 보강
 *   · apt-satellite-crawl   `latitude/longitude NOT NULL`  ← 위성 이미지
 * 지오코딩은 scripts/geocode-missing-v2.mjs 라는 «수동 스크립트» 에만 있었다.
 * 그래서 사람이 안 돌리면 새 현장은 좌표 없이 태어나고, 뒤따르는 두 크론이 조용히
 * 건너뛴다 — 「일광 더에스 동일스위트」가 정확히 그 구멍에 빠졌다(2026-08-29 생성, has_geo=false).
 * ⚠️ 실측 636 현장이 좌표 없이 쌓여 있었다(주소 있는 것 391 · 주소도 없는 것 245).
 *
 * ⛔ 이 라우트는 «좌표만» 채운다. 위성·인근시설은 각자의 크론이 이어받는다 —
 *    한 라우트에 셋을 뭉치면 하나가 실패할 때 무엇이 안 됐는지 사라진다.
 *
 * ── 실행 ────────────────────────────────────────────────────────────────────
 *   ?dry=1        조회·지오코딩까지만. DB 에 쓰지 않는다
 *   ?limit=30     이번 실행이 처리할 현장 수
 *   ?slug=...     특정 현장만 (신규 시드 직후 즉시 채울 때)
 */
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const DEFAULT_LIMIT = 40;
/** 카카오 로컬 API 분당 제한을 넘지 않게. 사이트당 최대 2콜. */
const THROTTLE_MS = 250;

/** 「부산광역시 기장군 일광읍 …」 처럼 뒤에 붙는 괄호·동호수를 턴다. */
function cleanAddress(addr: string): string {
  return addr
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+(\d+동|\d+호)\s*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ⛔ 실패를 «삼키지 않는다». 2026-08-29 에 이 함수의 첫 판이 `if (!res.ok) return null`
 *    이었고, 그래서 「키가 거부됐다(403)」와 「결과가 없다」가 구분되지 않았다.
 *    41/41 이 실패했는데 원인을 알 수 없었고, 프로덕션 응답만 보고는 데이터 탓으로 읽힌다.
 *    ⚠️ 같은 병이 apt-enrich-location 에 있었고 «엿새 동안» success 로 보고됐다.
 */
type KakaoOut = { hit: { lat: number; lng: number } | null; err: string | null };

async function kakao(path: string, query: string): Promise<KakaoOut> {
  if (!KAKAO_KEY) return { hit: null, err: 'NO_KEY' };
  if (!query) return { hit: null, err: null };
  try {
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/${path}.json?query=${encodeURIComponent(query)}&size=1`, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      const body = await res.text();
      // 「서비스가 꺼져 있다」는 데이터 문제가 아니라 «사람이 콘솔에서 켜야 하는» 것이다.
      const kind = /disabled .*service/i.test(body) ? 'SERVICE_DISABLED' : `HTTP_${res.status}`;
      return { hit: null, err: kind };
    }
    const j = await res.json();
    const d = j?.documents?.[0];
    if (!d?.x || !d?.y) return { hit: null, err: null };   // 진짜 «결과 없음»
    return { hit: { lat: Number(d.y), lng: Number(d.x) }, err: null };
  } catch (e) {
    return { hit: null, err: String(e).slice(0, 40) };
  }
}

async function handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dryRun = sp.get('dry') === '1';
  const slug = sp.get('slug');
  const limit = Math.max(1, Math.min(200, Number(sp.get('limit')) || DEFAULT_LIMIT));

  if (!KAKAO_KEY) {
    // ⚠️ 「키가 없다」와 「돌았는데 0건」은 다른 사실이다.
    return { processed: 0, metadata: { skipped: 'KAKAO_REST_API_KEY not set' } };
  }

  const admin = getSupabaseAdmin();
  let q = (admin as any)
    .from('apt_sites')
    .select('id, slug, name, address, latitude')
    .is('latitude', null)
    .not('address', 'is', null)
    .limit(limit);
  if (slug) q = q.eq('slug', slug);
  const { data: sites, error } = await q;
  if (error) return { processed: 0, failed: 1, metadata: { error: String(error.message ?? error) } };

  const rows = (sites ?? []) as Array<{ id: string; slug: string; name: string; address: string }>;
  let filled = 0, byAddress = 0, byName = 0, missed = 0, calls = 0;
  let blocked = false;
  /** ⚠️ 「결과 없음」과 「호출이 거부됨」을 «가른다». 이 둘이 섞이면 데이터 탓으로 읽힌다. */
  const apiErrors: Record<string, number> = {};
  const unresolved: string[] = [];

  for (const s of rows) {
    const addr = cleanAddress(s.address ?? '');
    // ① 지번/도로명 주소 → ② 앞 4토막(동까지) → ③ 현장명 키워드 검색
    let r = await kakao('address', addr); calls++;
    if (r.err) apiErrors[r.err] = (apiErrors[r.err] ?? 0) + 1;
    let hit = r.hit;
    let how: 'address' | 'name' = 'address';
    if (!hit && addr) {
      await new Promise((x) => setTimeout(x, THROTTLE_MS));
      r = await kakao('address', addr.split(' ').slice(0, 4).join(' ')); calls++;
      if (r.err) apiErrors[r.err] = (apiErrors[r.err] ?? 0) + 1;
      hit = r.hit;
    }
    if (!hit) {
      await new Promise((x) => setTimeout(x, THROTTLE_MS));
      r = await kakao('keyword', s.name); calls++;
      if (r.err) apiErrors[r.err] = (apiErrors[r.err] ?? 0) + 1;
      hit = r.hit;
      how = 'name';
    }
    // ⛔ 자격·서비스 문제면 남은 현장을 계속 두드려 봐야 «같은 답» 이다. 즉시 멈춘다.
    if (apiErrors.SERVICE_DISABLED || apiErrors.NO_KEY || (apiErrors.HTTP_401 ?? 0) > 0) { blocked = true; break; }
    if (!hit) {
      missed++;
      // ⚠️ 못 찾은 «위치» 를 남긴다. 세기만 하면 어느 현장이었는지 모른다.
      if (unresolved.length < 20) unresolved.push(`${s.slug}:${addr.slice(0, 30)}`);
      continue;
    }
    if (how === 'address') byAddress++; else byName++;

    if (!dryRun) {
      const { error: upErr } = await (admin as any)
        .from('apt_sites')
        .update({ latitude: hit.lat, longitude: hit.lng })
        .eq('id', s.id);
      if (upErr) { missed++; continue; }
    }
    filled++;
    await new Promise((r) => setTimeout(r, THROTTLE_MS));
  }

  // 남은 잔량 — 「이번에 N개」만 남기면 모집단을 모른다(오늘의 공리).
  const { count: remaining } = await (admin as any)
    .from('apt_sites')
    .select('id', { count: 'exact', head: true })
    .is('latitude', null)
    .not('address', 'is', null);

  return {
    processed: rows.length,
    created: filled,
    // ⚠️ 호출이 막힌 것은 «처리 실패» 다. 0 으로 보고하면 6일 내내 success 가 된다.
    failed: missed + (blocked ? rows.length - filled - missed : 0),
    metadata: {
      dry_run: dryRun,
      candidates: rows.length,
      filled,
      by_address: byAddress,
      by_name: byName,
      missed,
      unresolved,
      remaining_with_address: remaining ?? null,
      kakao_calls: calls,
      // ⛔ 여기가 비어 있어야 「데이터가 안 잡힌다」로 읽을 수 있다.
      api_errors: apiErrors,
      blocked,
      blocked_reason: apiErrors.SERVICE_DISABLED
        ? '카카오 개발자 콘솔에서 OPEN_MAP_AND_LOCAL(로컬) 서비스가 꺼져 있다 — 사람이 켜야 한다'
        : apiErrors.NO_KEY ? 'KAKAO_REST_API_KEY 미설정' : null,
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await withCronLogging('apt-geocode', () => handler(req));
  return NextResponse.json(result);
}

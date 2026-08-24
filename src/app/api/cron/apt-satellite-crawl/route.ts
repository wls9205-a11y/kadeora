/**
 * [CI-v1 Task 7] apt-satellite-crawl — VWorld 위성사진 → Storage 업로드 → apt_sites 링크
 *
 * 30m. apt_sites WHERE satellite_image_url IS NULL AND latitude/longitude NOT NULL LIMIT 30/run
 * VWorld WMTS Satellite zoom 17 단일 타일 PNG fetch → sharp webp 변환 → Storage: satellite/{id}.webp
 * → UPDATE apt_sites.satellite_image_url = public URL
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LOCK_KEY = 'apt-satellite-crawl';
const BATCH_SIZE = 30;
const PREEMPT_MS = 260_000;
const STORAGE_BUCKET = 'images';

const VWORLD_KEY = process.env.VWORLD_API_KEY || process.env.VWORLD_KEY || '';

/** lat/lng → WMTS tile (zoom, x, y) (Web Mercator EPSG:3857) */
function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/**
 * ADDENDUM §3-3 — 줌을 단지 규모에 맞춘다.
 *
 * 지금까지 전 현장이 zoom 17 고정이었다. WMTS 한 타일은 항상 같은 픽셀 수인데
 * 줌이 1 내려갈 때마다 타일이 덮는 실제 면적은 **4배**가 된다. 그래서 고정 줌이면
 *   큰 단지(2,000세대) → 단지가 타일 밖으로 잘린다
 *   작은 단지(100세대) → 단지는 점만 하고 주변 도로·산이 화면을 채운다
 * 둘 다 "얼룩" 으로 보이는 원인이다. 조감도가 없는 4,483건이 여기 해당한다.
 *
 * 세대수로 부지 크기를 대략 추정한다. 정밀할 필요가 없다 — 한 단계만 맞아도
 * 단지가 프레임 안에 들어온다.
 *   ~300세대    z18  (약 0.6km 폭)
 *   ~1,200세대  z17  (약 1.2km) ← 기존 기본값
 *   ~3,000세대  z16  (약 2.4km)
 *   그 이상      z15
 * ⚠️ 세대수를 모르면 **기존 17 을 그대로 쓴다.** 추정으로 더 나빠지게 하지 않는다.
 * ⚠️ complex_units(단지 전체) 를 우선 본다. total_units 는 일반분양 수치인 경우가 많아
 *    단지 규모를 과소평가한다.
 */
function zoomForUnits(units: unknown): number {
  const n = Number(units);
  if (!Number.isFinite(n) || n <= 0) return 17;
  if (n <= 300) return 18;
  if (n <= 1200) return 17;
  if (n <= 3000) return 16;
  return 15;
}

async function fetchVworldTile(lat: number, lon: number, zoom = 17): Promise<Buffer | null> {
  if (!VWORLD_KEY) return null;
  const { x, y } = lonLatToTile(lon, lat, zoom);
  // VWorld WMTS Satellite: https://api.vworld.kr/req/wmts/1.0.0/{key}/Satellite/{z}/{y}/{x}.jpeg
  const url = `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Satellite/${zoom}/${y}/${x}.jpeg`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KadeoraSatellite/1.0)' },
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 1500) return null; // 작은 응답(빈 타일) 거부
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!VWORLD_KEY) {
    return NextResponse.json({ success: false, error: 'VWORLD_API_KEY missing' }, { status: 500 });
  }

  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 300,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const { data: sites } = await (admin as any)
      .from('apt_sites')
      .select('id, name, latitude, longitude, complex_units, total_units')
      .is('satellite_image_url', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(BATCH_SIZE);

    if (!sites || sites.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'nothing to crawl' });
    }

    const stats = { processed: 0, uploaded: 0, failed: 0, skipped: 0 };
    const failures: string[] = [];

    for (const site of sites as any[]) {
      if (Date.now() - start > PREEMPT_MS) break;
      stats.processed++;
      const lat = Number(site.latitude);
      const lon = Number(site.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        stats.skipped++;
        continue;
      }

      const buf = await fetchVworldTile(lat, lon, zoomForUnits(site.complex_units ?? site.total_units));
      if (!buf) {
        stats.failed++;
        failures.push(`${site.id}:fetch`);
        continue;
      }

      let webp: Buffer;
      try {
        webp = await sharp(buf, { failOn: 'none' })
          .resize({ width: 1024, height: 1024, fit: 'cover' })
          .webp({ quality: 85, effort: 4 })
          .toBuffer();
      } catch (e: any) {
        stats.failed++;
        failures.push(`${site.id}:sharp:${e?.message || ''}`);
        continue;
      }

      const path = `satellite/${site.id}.webp`;
      const { error: upErr } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(path, webp, {
          contentType: 'image/webp',
          upsert: true,
          cacheControl: 'public, max-age=31536000, immutable',
        });
      if (upErr) {
        stats.failed++;
        failures.push(`${site.id}:upload:${upErr.message || ''}`.slice(0, 120));
        continue;
      }
      const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) {
        stats.failed++;
        failures.push(`${site.id}:no_public_url`);
        continue;
      }

      await (admin as any)
        .from('apt_sites')
        .update({ satellite_image_url: publicUrl })
        .eq('id', site.id);
      stats.uploaded++;
    }

    return NextResponse.json({
      success: true,
      ...stats,
      sample_failures: failures.slice(0, 5),
      elapsed_ms: Date.now() - start,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;

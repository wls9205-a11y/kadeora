/**
 * [§3 / 패치 P1] apt-card-build — /api/og-apt 브랜드 카드를 «사전에» 구워 Storage 에 올린다.
 *
 * 왜 사전에 굽나 —
 *   카드는 위성과 달리 Storage 정적 webp 가 아니라 `/api/og-apt` 함수 호출이다.
 *   목록 20 행이면 satori 20 회고, /api/og 의 D2~D6 원인이 미해결이라 그대로 두면
 *   목록에서 그대로 재현된다(R1). 그래서 위성과 같은 구조 — 미리 구워 URL 을 박아둔다.
 *
 * 대상 (패치 P1 §3 으로 5,845 → 1,414 로 축소) —
 *   1 순위  hero_image_url 이 없고 기축(post_move_in·landmark_active)이 아닌 것
 *           → sq(1:1) · hero(21:9) · heroM(4:3) 3 종
 *   2 순위  기축인데 위성도 실사도 없는 것
 *           → sq 만
 *
 *   기축 4,483 건 중 4,459 건은 이미 위성을 갖고 있어 카드가 필요 없다. 준공 단지에서
 *   항공 사진은 '없어서 대신 넣는 그림' 이 아니라 그 자체가 정보다. 원 지시의
 *   "2 순위 5,104 건 × thumb(구 규격)" 는 철회됐다 — 5,080 건은 굽지 않는다.
 *
 * 재생성 —
 *   display_name·lifecycle_stage·curated_status·sigungu·세대수가 바뀌면 DB 쪽에서
 *   card_image_built_at 을 null 로 되돌린다. 여기서는 null 인 것만 집어간다.
 *   기축으로 바뀌고 위성이 있으면 아래 대상 조건이 알아서 제외한다.
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LOCK_KEY = 'apt-card-build';
const STORAGE_BUCKET = 'images';

/** 한 번에 처리할 현장 수. 1 순위는 3 장씩이라 실제 생성은 최대 3 배다. */
const BATCH_SIZE = 20;

/** maxDuration 300 에 대해 여유를 남기고 끊는다. */
const PREEMPT_MS = 260_000;

const GICHUK = ['post_move_in', 'landmark_active'];

// [패치 P2 §1-1] 규격 재정의 — sq 1:1(목록·기본) / hero 21:9 / heroM 4:3.
// 이전의 thumb 128 · sq 630 · hero 1200×630 은 폐기됐다.
type SizeKey = 'sq' | 'hero' | 'heroM';

/** og-apt 의 SIZE_SPEC 과 같은 값. 받은 PNG 가 정말 그 크기인지 확인하는 데 쓴다. */
const EXPECTED_DIM: Record<SizeKey, { w: number; h: number }> = {
  sq: { w: 512, h: 512 },
  hero: { w: 1260, h: 540 },
  heroM: { w: 1200, h: 900 },
};

/** PNG IHDR 에서 폭·높이를 읽는다. 실패하면 null. */
function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/**
 * og-apt 를 자기 자신에게 호출해 PNG 를 받는다.
 * 카드는 순수 생성 그래픽이라 외부 의존이 없다 — 실패하면 그 현장만 건너뛴다.
 */
async function renderCard(slug: string, size: SizeKey): Promise<Buffer | null> {
  const url = `${SITE_URL}/api/og-apt?slug=${encodeURIComponent(slug)}&size=${size}&card=1`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: 'no-store' });
    if (!res.ok) return null;
    // 폴백 이미지가 오면 굽지 않는다 — 회색 'apt' 카드를 영구 URL 로 박아두면 더 나쁘다.
    if (res.headers.get('X-OG-Fallback') === '1') return null;
    const buf = Buffer.from(await res.arrayBuffer());

    // ⚠️ 받은 그림이 «정말 그 크기인지» 확인한다.
    //   이 크론은 SITE_URL(운영)로 자기 호출을 한다. 롤링 배포 중이라 아직 size 를
    //   모르는 구버전이 응답하면 630×630 이 조용히 돌아오고, 그대로 올리면
    //   card_image_built_at 이 찍혀 «영구히 잘못된 크기» 로 굳는다.
    //   size 키를 새로 판 이유가 정확히 이 조용한 실패였다(card=thumb → NaN → 1).
    //   같은 함정을 여기서 반복하지 않는다.
    const dim = pngSize(buf);
    const want = EXPECTED_DIM[size];
    if (!dim || dim.w !== want.w || dim.h !== want.h) {
      console.warn(`[apt-card-build] 크기 불일치 slug=${slug} size=${size} 기대=${want.w}x${want.h} 실제=${dim ? `${dim.w}x${dim.h}` : 'PNG아님'} → 건너뜀`);
      return null;
    }
    return buf;
  } catch {
    return null;
  }
}

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const holder = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 300,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const cols = 'id, slug, lifecycle_stage, satellite_image_url, hero_image_url';

    // 1 순위 — 분양라인·정비·미분양. 3 종 전부 굽는다.
    // ⚠️ lifecycle_stage 가 NULL 인 행을 «놓치지 않도록» or() 로 명시한다.
    //    PostgREST 의 not.in 은 SQL 3 값 논리를 그대로 따라 NULL 을 조용히 떨어뜨린다.
    //    실측 2026-08-25 — 그 NULL 이 48 건이고 전부 활성이라 목록에 뜬다.
    //    빠뜨리면 그 48 건만 온디맨드 og-apt 호출로 남아 R1 이 그대로 재현된다.
    const { data: tier1, error: e1 } = await (admin as any)
      .from('apt_sites')
      .select(cols)
      .eq('is_active', true)
      .is('hero_image_url', null)
      .is('card_image_built_at', null)
      .or(`lifecycle_stage.is.null,lifecycle_stage.not.in.(${GICHUK.join(',')})`)
      .limit(BATCH_SIZE);
    if (e1) throw new Error(`tier1_query_failed: ${e1.message}`);

    // 2 순위 — 기축인데 위성도 실사도 없는 것. sq 만.
    const remaining = Math.max(0, BATCH_SIZE - (tier1?.length || 0));
    let tier2: any[] = [];
    if (remaining > 0) {
      const { data, error: e2 } = await (admin as any)
        .from('apt_sites')
        .select(cols)
        .eq('is_active', true)
        .in('lifecycle_stage', GICHUK)
        .is('satellite_image_url', null)
        .is('hero_image_url', null)
        .is('card_image_built_at', null)
        .limit(remaining);
      if (e2) throw new Error(`tier2_query_failed: ${e2.message}`);
      tier2 = data || [];
    }

    const jobs: { site: any; sizes: SizeKey[] }[] = [
      // 1순위는 3규격 전부 — 목록(sq) · 데스크탑 히어로(hero) · 모바일 히어로(heroM).
      ...(tier1 || []).map((s: any) => ({ site: s, sizes: ['sq', 'hero', 'heroM'] as SizeKey[] })),
      // 2순위는 목록에만 쓰이므로 sq 만.
      ...tier2.map((s: any) => ({ site: s, sizes: ['sq'] as SizeKey[] })),
    ];

    if (jobs.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'nothing to build' });
    }

    const stats = { processed: 0, uploaded: 0, failed: 0, tier1: tier1?.length || 0, tier2: tier2.length };
    const failures: string[] = [];

    for (const { site, sizes } of jobs) {
      if (Date.now() - start > PREEMPT_MS) break;
      stats.processed++;

      let sqUrl: string | null = null;
      let ok = true;

      for (const size of sizes) {
        const png = await renderCard(site.slug, size);
        if (!png) {
          ok = false;
          failures.push(`${site.id}:${size}:render`);
          break;
        }

        // og-apt 는 PNG 를 낸다. 저장은 webp 로 — 목록 썸네일이라 전송량이 그대로 비용이다.
        let webp: Buffer;
        try {
          webp = await sharp(png, { failOn: 'none' }).webp({ quality: 88, effort: 4 }).toBuffer();
        } catch (e: any) {
          ok = false;
          failures.push(`${site.id}:${size}:sharp:${e?.message || ''}`.slice(0, 120));
          break;
        }

        const path = `card/${site.id}-${size}.webp`;
        const { error: upErr } = await admin.storage
          .from(STORAGE_BUCKET)
          .upload(path, webp, {
            contentType: 'image/webp',
            upsert: true,
            cacheControl: 'public, max-age=31536000, immutable',
          });
        if (upErr) {
          ok = false;
          failures.push(`${site.id}:${size}:upload:${upErr.message || ''}`.slice(0, 120));
          break;
        }
        if (size === 'sq') {
          const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
          sqUrl = pub?.publicUrl || null;
        }
      }

      if (!ok || !sqUrl) {
        stats.failed++;
        // built_at 을 찍지 않는다 — 다음 회차에 다시 잡혀야 한다.
        continue;
      }

      // card_image_url 은 목록이 실제로 읽는 값이라 1:1(sq)을 가리킨다.
      // RPC thumb_url 체인의 3 순위가 바로 이 컬럼이다.
      await (admin as any)
        .from('apt_sites')
        .update({ card_image_url: sqUrl, card_image_built_at: new Date().toISOString() })
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

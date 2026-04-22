/**
 * [image-source] kakao-place-fetch — kakao_place_queue 50건 → Kakao Local API 키워드 검색 →
 *   첫 place_url image fetch → hydrateImage → apt_sites.og_image_url 갱신 + image_source_pool INSERT
 *
 * 15m. verifyCronAuth + acquire_cron_lock + PREEMPT_MS 260s.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { hydrateImage } from '@/lib/image-hydrate';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LOCK_KEY = 'kakao-place-fetch';
const BATCH = 50;
const PREEMPT_MS = 260_000;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const KEY = process.env.KAKAO_REST_API_KEY;
  if (!KEY) return NextResponse.json({ success: false, error: 'KAKAO_REST_API_KEY missing' }, { status: 500 });

  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 300,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const { data: items } = await (admin as any)
      .from('kakao_place_queue')
      .select('id, apt_site_id, apt_name, address, region, sigungu, attempts')
      .eq('status', 'pending').lt('attempts', 3)
      .order('created_at', { ascending: true }).limit(BATCH);
    if (!items || items.length === 0) return NextResponse.json({ success: true, processed: 0, message: 'queue empty' });

    await (admin as any).from('kakao_place_queue').update({ status: 'processing' }).in('id', items.map((i: any) => i.id));

    const stats = { processed: 0, done: 0, failed: 0 };
    const failures: string[] = [];

    for (const it of items as any[]) {
      if (Date.now() - start > PREEMPT_MS) {
        await (admin as any).from('kakao_place_queue').update({ status: 'pending' }).eq('id', it.id);
        continue;
      }
      stats.processed++;
      const nextAttempts = (it.attempts ?? 0) + 1;
      try {
        const query = [it.apt_name, it.sigungu || it.region].filter(Boolean).join(' ').slice(0, 60);
        const searchRes = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
          { headers: { Authorization: `KakaoAK ${KEY}` }, signal: AbortSignal.timeout(8000) },
        );
        if (!searchRes.ok) throw new Error(`kakao_search_${searchRes.status}`);
        const search = await searchRes.json();
        const doc = Array.isArray(search?.documents) && search.documents[0];
        if (!doc?.place_url) throw new Error('no_place_url');
        // 썸네일 이미지는 place 상세 페이지 HTML 파싱이 필요한데 비용·안정성 문제.
        // 대안: Kakao Maps Static image (장소 중심 위성 1024x768)
        const lat = Number(doc.y);
        const lng = Number(doc.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('bad_coord');
        const staticImgUrl = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}`;
        // static image 가 Kakao REST API 기준 제공되지 않는다 — 대신 place_url HTML 의 og:image 를 사용.
        const placeHtmlRes = await fetch(String(doc.place_url), {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0 (KadeoraKakaoFetcher/1.0)' },
        });
        if (!placeHtmlRes.ok) throw new Error(`place_html_${placeHtmlRes.status}`);
        const html = await placeHtmlRes.text();
        const og = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
        const imgUrl = og?.[1] || null;
        if (!imgUrl) throw new Error('og_image_not_found');

        const hy = await hydrateImage(admin, imgUrl, { subdir: `kakao/${it.apt_site_id || it.id}`, quality: 82 });
        if (!hy.ok) throw new Error(`hydrate_${hy.reason}`);

        // apt_sites.og_image_url 갱신 (이미 real image 있으면 덮어쓰기 금지 — 단지 없을 때만)
        if (it.apt_site_id) {
          await (admin as any)
            .from('apt_sites')
            .update({ og_image_url: hy.url })
            .eq('id', it.apt_site_id)
            .or('og_image_url.is.null,og_image_url.ilike.%/api/og%');
        }
        // image_source_pool INSERT
        try {
          await (admin as any).from('image_source_pool').insert({
            source_type: 'kakao_place',
            category: 'apt',
            subject_key: String(it.apt_name || '').slice(0, 120),
            image_url: hy.url,
            storage_path: hy.storagePath,
            quality_score: 70,
            width: hy.width,
            height: hy.height,
            metadata: { place_url: doc.place_url, apt_site_id: it.apt_site_id },
            is_active: true,
          });
        } catch { /* dup OK */ }

        await (admin as any).from('kakao_place_queue').update({
          status: 'done', result_url: hy.url, storage_path: hy.storagePath,
          processed_at: new Date().toISOString(), attempts: nextAttempts, error_message: null,
        }).eq('id', it.id);
        stats.done++;
      } catch (err: any) {
        await (admin as any).from('kakao_place_queue').update({
          status: 'failed', error_message: String(err?.message || err).slice(0, 500), attempts: nextAttempts,
        }).eq('id', it.id);
        stats.failed++;
        failures.push(`${it.id}:${String(err?.message || err).slice(0, 100)}`);
      }
    }

    return NextResponse.json({ success: true, ...stats, sample_failures: failures.slice(0, 5), elapsed_ms: Date.now() - start });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;

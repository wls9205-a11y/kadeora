/**
 * [image-source] unsplash-fetch — unsplash_fetch_queue 의 pending 1건 처리 →
 *  Unsplash search API 호출 → hydrateImage 병렬 → curated_image_pool INSERT.
 *
 * 2h 크론. rate limit 50 req/hr 보호 위해 1 query 만 처리.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { hydrateImage } from '@/lib/image-hydrate';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LOCK_KEY = 'unsplash-fetch';
const PREEMPT_MS = 260_000;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const KEY = process.env.UNSPLASH_ACCESS_KEY;
  if (!KEY) return NextResponse.json({ success: false, error: 'UNSPLASH_ACCESS_KEY missing' }, { status: 500 });

  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 300,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const { data: items } = await (admin as any)
      .from('unsplash_fetch_queue')
      .select('id, category, search_query, target_count, fetched_count')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);
    if (!items || items.length === 0) return NextResponse.json({ success: true, processed: 0, message: 'queue empty' });

    const q = items[0];
    await (admin as any).from('unsplash_fetch_queue').update({ status: 'processing' }).eq('id', q.id);

    const target = Math.min(30, Math.max(5, (q.target_count ?? 20) - (q.fetched_count ?? 0)));
    const searchRes = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q.search_query)}&per_page=${target}&orientation=landscape`,
      {
        headers: { Authorization: `Client-ID ${KEY}`, 'Accept-Version': 'v1' },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!searchRes.ok) {
      const txt = await searchRes.text().catch(() => '');
      await (admin as any).from('unsplash_fetch_queue').update({
        status: 'failed',
      }).eq('id', q.id);
      throw new Error(`unsplash_${searchRes.status}:${txt.slice(0, 200)}`);
    }
    const data = await searchRes.json();
    const photos: any[] = Array.isArray(data?.results) ? data.results : [];

    let inserted = 0;
    const failures: string[] = [];

    for (const p of photos) {
      if (Date.now() - start > PREEMPT_MS) break;
      const urlRaw = p?.urls?.regular || p?.urls?.full;
      if (!urlRaw) continue;
      try {
        const hy = await hydrateImage(admin, urlRaw, {
          subdir: `unsplash/${String(q.category || 'general').slice(0, 20)}`,
          quality: 85,
        });
        if (!hy.ok) {
          failures.push(`${p?.id}:${hy.reason}`);
          continue;
        }
        await (admin as any).from('curated_image_pool').insert({
          category: q.category,
          image_url: hy.url,
          storage_path: hy.storagePath,
          quality_score: 75,
          source: 'unsplash',
          tags: Array.isArray(p?.tags) ? p.tags.slice(0, 8).map((t: any) => String(t?.title || t)).filter(Boolean) : [],
          width: hy.width,
          height: hy.height,
          photographer: p?.user?.name ? String(p.user.name).slice(0, 80) : null,
          license: 'Unsplash License',
        });
        inserted++;
      } catch (e: any) {
        failures.push(`${p?.id}:${String(e?.message || e).slice(0, 80)}`);
      }
    }

    const fetchedCount = (q.fetched_count ?? 0) + inserted;
    const done = fetchedCount >= (q.target_count ?? inserted);
    await (admin as any).from('unsplash_fetch_queue').update({
      status: done ? 'done' : 'pending',
      fetched_count: fetchedCount,
      processed_at: new Date().toISOString(),
    }).eq('id', q.id);

    return NextResponse.json({
      success: true,
      query: q.search_query,
      returned: photos.length,
      inserted,
      fetched_cumulative: fetchedCount,
      target: q.target_count,
      done,
      sample_failures: failures.slice(0, 5),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;

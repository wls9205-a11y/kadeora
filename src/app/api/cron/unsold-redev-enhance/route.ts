/**
 * [image-source] unsold-redev-enhance — unsold_apts / redevelopment_projects 의
 *  thumbnail_url LIKE '%api/og%' 인 row 를 curated_image_pool 매칭 이미지로 교체.
 *
 * 1h. verifyCronAuth + acquire_cron_lock. 100 row/run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 120;

const LOCK_KEY = 'unsold-redev-enhance';
const BATCH = 50;

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 120,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    async function pickCurated(category: string): Promise<string | null> {
      const { data } = await (admin as any)
        .from('curated_image_pool')
        .select('id, image_url, used_count')
        .eq('category', category)
        .order('used_count', { ascending: true, nullsFirst: true })
        .limit(20);
      if (!Array.isArray(data) || data.length === 0) return null;
      const pick = data[Math.floor(Math.random() * data.length)];
      if (!pick?.image_url) return null;
      try {
        await (admin as any).from('curated_image_pool').update({
          used_count: (pick.used_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        }).eq('id', pick.id);
      } catch { /* ignore */ }
      return pick.image_url;
    }

    const { data: unsold } = await (admin as any)
      .from('unsold_apts')
      .select('id, house_nm, thumbnail_url')
      .or('thumbnail_url.ilike.%/api/og%,thumbnail_url.is.null')
      .limit(BATCH);
    const { data: redev } = await (admin as any)
      .from('redevelopment_projects')
      .select('id, district_name, thumbnail_url')
      .or('thumbnail_url.ilike.%/api/og%,thumbnail_url.is.null')
      .limit(BATCH);

    const stats = { unsold_updated: 0, redev_updated: 0, skipped: 0, failed: 0 };
    const failures: string[] = [];

    for (const u of (unsold || []) as any[]) {
      try {
        const url = await pickCurated('unsold');
        if (!url) { stats.skipped++; continue; }
        await (admin as any).from('unsold_apts').update({ thumbnail_url: url }).eq('id', u.id);
        stats.unsold_updated++;
      } catch (e: any) {
        stats.failed++;
        failures.push(`unsold:${u.id}:${String(e?.message || e).slice(0, 80)}`);
      }
    }
    for (const r of (redev || []) as any[]) {
      try {
        const url = await pickCurated('redev');
        if (!url) { stats.skipped++; continue; }
        await (admin as any).from('redevelopment_projects').update({ thumbnail_url: url }).eq('id', r.id);
        stats.redev_updated++;
      } catch (e: any) {
        stats.failed++;
        failures.push(`redev:${r.id}:${String(e?.message || e).slice(0, 80)}`);
      }
    }

    return NextResponse.json({ success: true, ...stats, sample_failures: failures.slice(0, 5) });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

export const GET = handler;
export const POST = handler;

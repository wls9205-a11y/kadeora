/**
 * [CI-v1] image-relevance-replace — relevance_score<50 인 blog_post_images 를
 *  OG 생성 이미지로 교체 (image_kind='og_placeholder_replaced').
 *
 * 주 1회 일요일 새벽 실행. 100건/run. verifyCronAuth + acquire_cron_lock.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { SITE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 120;

const LOCK_KEY = 'image-relevance-replace';
const BATCH = 100;
const SITE = SITE_URL.replace(/\/$/, '') || 'https://kadeora.app';

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 120,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    // blog_post_images.relevance_score < 50 AND image_kind='storage_real'
    //   → 관련성 낮은 실사진만 대상 (이미 og_placeholder 는 제외)
    const { data: rows, error } = await (admin as any)
      .from('blog_post_images')
      .select('id, post_id, image_url, alt_text, relevance_score')
      .lt('relevance_score', 50)
      .eq('image_kind', 'storage_real')
      .order('relevance_score', { ascending: true })
      .limit(BATCH);
    if (error) throw error;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, replaced: 0, message: 'no low-relevance images' });
    }

    // post_id → title/category 캐시
    const postIds: number[] = Array.from(new Set(rows.map((r: any) => Number(r.post_id)).filter((n: number) => Number.isFinite(n) && n > 0)));
    const { data: posts } = await admin
      .from('blog_posts')
      .select('id, title, category')
      .in('id', postIds);
    const postMap = new Map<number, { title: string; category: string }>();
    for (const p of (posts || []) as any[]) postMap.set(p.id, { title: p.title, category: p.category });

    let replaced = 0;
    const failures: string[] = [];

    for (const r of rows as any[]) {
      const p = postMap.get(r.post_id);
      const title = p?.title || r.alt_text || 'kadeora';
      const category = p?.category || 'general';
      const design = 1 + (Math.abs(hashStr(title)) % 6);
      const newUrl = `${SITE}/api/og?title=${encodeURIComponent(String(title).slice(0, 50))}&category=${category}&design=${design}`;
      try {
        const { error: upErr } = await (admin as any)
          .from('blog_post_images')
          .update({
            image_url: newUrl,
            image_kind: 'og_placeholder_replaced',
            source_origin: 'og_generated',
            storage_path: null,
          })
          .eq('id', r.id);
        if (upErr) throw upErr;
        replaced++;
      } catch (err: any) {
        failures.push(`${r.id}:${String(err?.message || err).slice(0, 100)}`);
      }
    }

    return NextResponse.json({
      success: true,
      replaced,
      total: rows.length,
      sample_failures: failures.slice(0, 5),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'internal' }, { status: 500 });
  } finally {
    await (admin as any).rpc('release_cron_lock', { p_lock_key: LOCK_KEY, p_holder: holder });
  }
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}

export const GET = handler;
export const POST = handler;

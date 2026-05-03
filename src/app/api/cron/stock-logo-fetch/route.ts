/**
 * [image-source] stock-logo-fetch — stock_logo_queue 50건 → Clearbit/Yahoo/Naver 순 폴백 →
 *   hydrateImage → stock_logo_pool UPSERT + stock_images position 0 교체.
 *
 * 1h. verifyCronAuth + acquire_cron_lock.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/cron-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { hydrateImage } from '@/lib/image-hydrate';

export const runtime = 'nodejs';
export const maxDuration = 300;

const LOCK_KEY = 'stock-logo-fetch';
const BATCH = 50;
const PREEMPT_MS = 260_000;

function buildSources(symbol: string, domain: string | null): Array<{ source: string; url: string }> {
  const out: Array<{ source: string; url: string }> = [];
  const cleanDomain = domain ? domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null;
  if (cleanDomain) out.push({ source: 'clearbit', url: `https://logo.clearbit.com/${cleanDomain}` });

  // KOSPI/KOSDAQ 6자리 숫자 심볼 — s205-W7: fallback chain 보강 (1,317건 모두 logo NULL 회복)
  if (/^\d{6}$/.test(symbol)) {
    out.push({ source: 'naver_pstatic_icons', url: `https://ssl.pstatic.net/imgstock/icons/${symbol}.png` });
    out.push({ source: 'naver_pstatic_logo', url: `https://ssl.pstatic.net/imgstock/item/logo/${symbol}.png` });
    if (cleanDomain) {
      out.push({ source: 'google_favicon', url: `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128` });
      out.push({ source: 'duckduckgo_favicon', url: `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico` });
    }
  } else {
    // US ticker
    out.push({ source: 'stocklight', url: `https://logo.stocklight.com/ko/${symbol}.png` });
    out.push({ source: 'yahoo', url: `https://financialmodelingprep.com/image-stock/${symbol}.png` });
    if (cleanDomain) {
      out.push({ source: 'google_favicon', url: `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128` });
    }
  }
  return out;
}

async function handler(req: NextRequest) {
  if (!verifyCronAuth(req as any)) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const holder = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = Date.now();

  const { data: lockOk } = await (admin as any).rpc('acquire_cron_lock', {
    p_lock_key: LOCK_KEY, p_holder: holder, p_ttl_seconds: 300,
  });
  if (!lockOk) return NextResponse.json({ success: true, skipped: true, reason: 'pg_lock_held' });

  try {
    const { data: items } = await (admin as any)
      .from('stock_logo_queue')
      .select('id, symbol, company_name, company_domain, attempts')
      .eq('status', 'pending').lt('attempts', 3)
      .order('created_at', { ascending: true }).limit(BATCH);
    if (!items || items.length === 0) return NextResponse.json({ success: true, processed: 0, message: 'queue empty' });

    await (admin as any).from('stock_logo_queue').update({ status: 'processing' }).in('id', items.map((i: any) => i.id));

    const stats = { processed: 0, done: 0, failed: 0 };
    const failures: string[] = [];

    for (const it of items as any[]) {
      if (Date.now() - start > PREEMPT_MS) {
        await (admin as any).from('stock_logo_queue').update({ status: 'pending' }).eq('id', it.id);
        continue;
      }
      stats.processed++;
      const nextAttempts = (it.attempts ?? 0) + 1;
      const sources = buildSources(String(it.symbol || ''), it.company_domain || null);

      let successSource: string | null = null;
      let successHydrate: Awaited<ReturnType<typeof hydrateImage>> | null = null;

      for (const s of sources) {
        try {
          const hy = await hydrateImage(admin, s.url, {
            subdir: `stock-logo/${String(it.symbol || 'x').slice(0, 10)}`,
            maxWidth: 512, maxHeight: 512, quality: 88,
          });
          if (hy.ok) {
            successHydrate = hy;
            successSource = s.source;
            break;
          }
        } catch { /* try next */ }
      }

      if (!successHydrate || !successHydrate.ok) {
        await (admin as any).from('stock_logo_queue').update({
          status: 'failed', attempts: nextAttempts,
        }).eq('id', it.id);
        stats.failed++;
        failures.push(`${it.id}:${it.symbol}:all_sources_failed`);
        continue;
      }

      try {
        await (admin as any).from('stock_logo_pool').upsert({
          symbol: it.symbol,
          logo_url: successHydrate.url,
          source: successSource,
          storage_path: successHydrate.storagePath,
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'symbol' });
      } catch { /* ignore */ }

      // stock_images 기존 position 0 교체 (테이블 스키마: post_id 대신 symbol 기반 — 안전 시도)
      try {
        await (admin as any).from('stock_images')
          .update({ image_url: successHydrate.url, source_origin: 'storage', image_kind: 'storage_real' })
          .eq('symbol', it.symbol).eq('position', 0);
      } catch { /* ignore — table/col 없으면 스킵 */ }

      await (admin as any).from('stock_logo_queue').update({
        status: 'done', logo_url: successHydrate.url, storage_path: successHydrate.storagePath, attempts: nextAttempts,
      }).eq('id', it.id);
      stats.done++;
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

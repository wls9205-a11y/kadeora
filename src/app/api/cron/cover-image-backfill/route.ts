import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH = 50;

async function searchKakaoImage(query: string): Promise<{ url: string; thumb: string; caption: string }[]> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(query)}&size=10&sort=accuracy`,
      {
        headers: { Authorization: `KakaoAK ${key}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const docs: any[] = data?.documents || [];
    return docs.slice(0, 5).map((d: any) => ({
      url: (d.image_url || '').replace(/^http:\/\//, 'https://'),
      thumb: (d.thumbnail_url || d.image_url || '').replace(/^http:\/\//, 'https://'),
      caption: query.includes('조감도') ? '조감도' : query.includes('모델하우스') ? '모델하우스' : '',
    })).filter(d => d.url);
  } catch { return []; }
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('cover-image-backfill', async () => {
      const sb = getSupabaseAdmin();

      const { data: targets } = await (sb as any).from('apt_sites')
        .select('id, name, cover_image_url, page_views, images')
        .or('cover_image_url.is.null,cover_image_url.ilike.%kadeora.app/api/og%')
        .order('page_views', { ascending: false, nullsFirst: false })
        .limit(BATCH);

      const sites = (targets || []) as any[];
      let updated = 0;
      const failures: string[] = [];

      for (const site of sites) {
        try {
          const found = await searchKakaoImage(`${site.name} 조감도`);
          if (found.length === 0) continue;

          const existingImages = Array.isArray(site.images) ? site.images : [];
          const newImages = [...found, ...existingImages]; // 조감도 우선
          const { error } = await (sb as any).from('apt_sites')
            .update({ images: newImages })
            .eq('id', site.id);
          if (error) { failures.push(`${site.id}:${error.message}`); continue; }

          // pick_apt_cover_image RPC 재호출
          try {
            await (sb as any).rpc('pick_apt_cover_image', { p_site_id: site.id });
          } catch { /* RPC 없으면 skip */ }

          updated++;
        } catch (e: any) {
          failures.push(`${site.id}:${e?.message ?? 'unknown'}`);
        }
      }

      return {
        processed: sites.length,
        created: 0,
        updated,
        failed: failures.length,
        metadata: { source: 'kakao_image_search', batch: BATCH, sample_failures: failures.slice(0, 5) },
      };
    })
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);

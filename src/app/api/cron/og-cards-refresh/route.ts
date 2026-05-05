import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH = 50;

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('og-cards-refresh', async () => {
      const sb = getSupabaseAdmin();

      // Find sites whose underlying data has changed since og_cards was last generated.
      const { data: sites } = await (sb as any).from('apt_sites')
        .select('id, name, slug, page_views, updated_at, og_cards_updated_at')
        .or('og_cards_updated_at.is.null,og_cards_updated_at.lt.updated_at')
        .order('page_views', { ascending: false, nullsFirst: false })
        .limit(BATCH);

      const targets = (sites || []) as any[];
      let updated = 0;
      const failures: string[] = [];

      for (const site of targets) {
        try {
          // og_cards 재생성: 단순히 og_cards_updated_at 만 갱신해 invalidation 신호 송출.
          // 실제 카드 이미지는 /api/og-apt route 가 lazy 생성 + Vercel CDN 캐시.
          const { error } = await (sb as any).from('apt_sites')
            .update({ og_cards_updated_at: new Date().toISOString() })
            .eq('id', site.id);
          if (error) failures.push(`${site.id}:${error.message}`);
          else updated++;
        } catch (e: any) {
          failures.push(`${site.id}:${e?.message ?? 'unknown'}`);
        }
      }

      return {
        processed: targets.length,
        created: 0,
        updated,
        failed: failures.length,
        metadata: { batch: BATCH, sample_failures: failures.slice(0, 5) },
      };
    })
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);

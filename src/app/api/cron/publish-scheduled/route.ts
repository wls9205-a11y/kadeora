// s272 STATION_APT_NO_PUBLISHER fix
// blog_posts.created_at 이 미래 schedule 인 row 가 created_at <= NOW() 도래 시
// is_published=true 로 flip + published_at 세팅. Architecture Rule #74.
// 일반화: cron_type IN ('station-apt') 한정. 다른 cron 이 미래 schedule 패턴 도입 시 여기 추가.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withCronLogging } from '@/lib/cron-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const SCHEDULE_CRON_TYPES = ['station-apt'] as const;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await withCronLogging('publish-scheduled', async () => {
      const admin = getSupabaseAdmin();
      const nowIso = new Date().toISOString();

      const { data: flipped, error } = await (admin as any)
        .from('blog_posts')
        .update({ is_published: true, published_at: nowIso, updated_at: nowIso })
        .eq('is_published', false)
        .lte('created_at', nowIso)
        .in('cron_type', SCHEDULE_CRON_TYPES as unknown as string[])
        .select('id, slug, cron_type, created_at');

      if (error) {
        console.error('[publish-scheduled] flip error:', error.message);
        throw new Error(error.message);
      }

      const count = flipped?.length ?? 0;
      if (count > 0) {
        console.info(`[publish-scheduled] flipped ${count} posts:`,
          (flipped ?? []).map((r: any) => `${r.id}/${r.slug}`).join(', '));
      }

      return {
        processed: count,
        created: count,
        failed: 0,
        metadata: { cron_types: SCHEDULE_CRON_TYPES, flipped_ids: (flipped ?? []).map((r: any) => r.id) },
      };
    });

    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error('[cron/publish-scheduled]', e?.message ?? e);
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}

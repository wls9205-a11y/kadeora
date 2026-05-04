import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 300;
export const runtime = 'nodejs';

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('region-infer-backfill', async () => {
      const start = Date.now();
      const sb = getSupabaseAdmin();

      const { data: users, error } = await (sb as any)
        .from('profiles')
        .select('id')
        .is('region_text', null)
        .is('residence_city', null)
        .eq('signup_provider', 'kakao')
        .limit(200);

      if (error) {
        return {
          processed: 0,
          failed: 1,
          metadata: { error: error.message || 'select failed', elapsed_ms: Date.now() - start },
        };
      }

      const targets = (users as any[]) || [];
      if (targets.length === 0) {
        return {
          processed: 0,
          metadata: { target_count: 0, elapsed_ms: Date.now() - start },
        };
      }

      let processed = 0;
      let updated = 0;
      let failed = 0;
      let noEvents = 0;
      const errors: Array<{ user_id?: string; msg: string }> = [];

      for (const u of targets) {
        processed++;
        try {
          let regionRows: any[] | null = null;
          try {
            const { data, error: alertsErr } = await (sb as any)
              .from('apt_alerts')
              .select('region')
              .eq('user_id', u.id)
              .not('region', 'is', null);

            if (alertsErr) {
              const code = (alertsErr as any).code || '';
              const msg = (alertsErr as any).message || '';
              if (code === '42P01' || /does not exist|relation .* not exist/i.test(msg)) {
                return {
                  processed,
                  failed,
                  metadata: {
                    no_data_source: true,
                    table: 'apt_alerts',
                    elapsed_ms: Date.now() - start,
                  },
                };
              }
              throw alertsErr;
            }
            regionRows = data as any[] | null;
          } catch (e: any) {
            const msg = e?.message || '';
            if (/does not exist|relation .* not exist/i.test(msg)) {
              return {
                processed,
                failed,
                metadata: {
                  no_data_source: true,
                  table: 'apt_alerts',
                  elapsed_ms: Date.now() - start,
                },
              };
            }
            throw e;
          }

          if (!regionRows || regionRows.length === 0) {
            noEvents++;
            continue;
          }

          const counts = new Map<string, number>();
          for (const r of regionRows) {
            const region = String(r.region || '').trim();
            if (!region) continue;
            counts.set(region, (counts.get(region) || 0) + 1);
          }

          let topRegion: string | null = null;
          let topCount = 0;
          for (const [region, c] of counts.entries()) {
            if (c > topCount) {
              topRegion = region;
              topCount = c;
            }
          }

          if (!topRegion || topCount < 3) {
            noEvents++;
            continue;
          }

          const { error: updErr } = await (sb as any)
            .from('profiles')
            .update({
              region_text: topRegion,
              signup_source: 'inferred',
            })
            .eq('id', u.id);

          if (updErr) {
            failed++;
            errors.push({ user_id: u.id, msg: updErr.message || 'update failed' });
          } else {
            updated++;
          }
        } catch (e) {
          failed++;
          errors.push({ user_id: u.id, msg: (e as Error)?.message || 'unknown' });
        }
      }

      return {
        processed,
        updated,
        failed,
        metadata: {
          target_count: targets.length,
          no_events: noEvents,
          elapsed_ms: Date.now() - start,
          errors: errors.slice(0, 5),
        },
      };
    }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);

import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 30;
export const runtime = 'nodejs';

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('consent-expiry-revoke', async () => {
      const start = Date.now();
      const sb = getSupabaseAdmin();

      const now = new Date();
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const cutoff = twoYearsAgo.toISOString();

      const { data: rows, error } = await (sb as any)
        .from('profiles')
        .select('id, marketing_agreed_at, marketing_consent_renewed_at')
        .eq('marketing_agreed', true)
        .lt('marketing_agreed_at', cutoff);

      if (error) {
        return {
          processed: 0,
          failed: 1,
          metadata: { error: error.message || 'select failed', elapsed_ms: Date.now() - start },
        };
      }

      const targets = ((rows as any[]) || []).filter((r) => {
        return !r.marketing_consent_renewed_at || r.marketing_consent_renewed_at < cutoff;
      });

      let processed = 0;
      let updated = 0;
      let failed = 0;
      const errors: Array<{ user_id?: string; msg: string }> = [];
      const revokedAt = now.toISOString();

      for (const u of targets) {
        processed++;
        try {
          const { error: updErr } = await (sb as any)
            .from('profiles')
            .update({
              marketing_agreed: false,
              marketing_revoked_at: revokedAt,
            })
            .eq('id', u.id);

          if (updErr) {
            failed++;
            errors.push({ user_id: u.id, msg: updErr.message || 'update failed' });
            continue;
          }

          const { error: histErr } = await (sb as any)
            .from('consent_history')
            .insert({
              user_id: u.id,
              action: 'revoked',
              source: 'expiry_auto',
              changed_at: revokedAt,
              metadata: {
                cron: 'consent-expiry-revoke',
                marketing_agreed_at: u.marketing_agreed_at,
                marketing_consent_renewed_at: u.marketing_consent_renewed_at,
              },
            });

          if (histErr) {
            errors.push({ user_id: u.id, msg: `history: ${histErr.message || 'insert failed'}` });
          }
          updated++;
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
          elapsed_ms: Date.now() - start,
          errors: errors.slice(0, 5),
        },
      };
    }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);

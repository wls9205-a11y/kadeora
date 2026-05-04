import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;
export const runtime = 'nodejs';

const INFO_BODY = '마케팅 수신 동의 만료가 14일 남았습니다. 동의 갱신을 부탁드립니다.';

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('consent-renewal-check', async () => {
      const start = Date.now();
      const sb = getSupabaseAdmin();

      const now = new Date();
      const twoYearsAgo = new Date(now);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const twoYearsAgoPlus14 = new Date(twoYearsAgo);
      twoYearsAgoPlus14.setDate(twoYearsAgoPlus14.getDate() + 14);

      const { data: rows, error } = await (sb as any)
        .from('profiles')
        .select('id, marketing_agreed_at, marketing_consent_renewed_at')
        .gte('marketing_agreed_at', twoYearsAgo.toISOString())
        .lte('marketing_agreed_at', twoYearsAgoPlus14.toISOString());

      if (error) {
        return {
          processed: 0,
          failed: 1,
          metadata: { error: error.message || 'select failed', elapsed_ms: Date.now() - start },
        };
      }

      const cutoff = twoYearsAgoPlus14.toISOString();
      const targets = ((rows as any[]) || []).filter((r) => {
        return !r.marketing_consent_renewed_at || r.marketing_consent_renewed_at < cutoff;
      });

      const apiKey = process.env.KAKAO_REST_API_KEY;
      const sentAt = now.toISOString();

      let processed = 0;
      let created = 0;
      let failed = 0;
      let blocked = 0;
      const errors: Array<{ user_id?: string; msg: string }> = [];

      for (const u of targets) {
        processed++;
        try {
          const { data: guard, error: guardErr } = await (sb as any).rpc(
            'kakao_send_guard_check',
            {
              p_user_id: u.id,
              p_message_type: 'info',
              p_send_at: sentAt,
            },
          );

          if (guardErr) {
            failed++;
            errors.push({ user_id: u.id, msg: guardErr.message || 'guard rpc failed' });
            continue;
          }

          const passed = guard === true || guard?.passed === true || guard?.ok === true;
          if (!passed) {
            blocked++;
            await (sb as any).from('kakao_message_send_logs').insert({
              user_id: u.id,
              message_type: 'info',
              body: INFO_BODY,
              delivery_status: 'blocked',
              sent_at: sentAt,
              metadata: { reason: 'guard_failed', guard },
            });
            continue;
          }

          let deliveryStatus: 'mock' | 'delivered' | 'failed' = 'mock';
          if (apiKey) {
            try {
              const res = await fetch('https://kapi.kakao.com/v1/talkchannel/send', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  user_id: u.id,
                  message_type: 'info',
                  text: INFO_BODY,
                }).toString(),
                signal: AbortSignal.timeout(10_000),
              });
              deliveryStatus = res.ok ? 'delivered' : 'failed';
            } catch {
              deliveryStatus = 'failed';
            }
          }

          const { error: insErr } = await (sb as any)
            .from('kakao_message_send_logs')
            .insert({
              user_id: u.id,
              message_type: 'info',
              body: INFO_BODY,
              delivery_status: deliveryStatus,
              sent_at: sentAt,
            });

          if (insErr) {
            failed++;
            errors.push({ user_id: u.id, msg: insErr.message || 'insert failed' });
          } else {
            created++;
          }
        } catch (e) {
          failed++;
          errors.push({ user_id: u.id, msg: (e as Error)?.message || 'unknown' });
        }
      }

      return {
        processed,
        created,
        failed,
        metadata: {
          target_count: targets.length,
          blocked,
          mock: !apiKey,
          elapsed_ms: Date.now() - start,
          errors: errors.slice(0, 5),
        },
      };
    }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
